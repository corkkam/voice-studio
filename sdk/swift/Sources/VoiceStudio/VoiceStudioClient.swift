import Foundation

public enum VoiceStudioChannel: String, Sendable {
    case web, macos, api, studio
}

/// A provider and model pair, for example `VoiceStudioModel("groq", "llama-3.1-8b-instant")`.
/// `credentialId` names one stored key when a tenant holds several for one provider.
public struct VoiceStudioModel: Sendable {
    public let provider: String
    public let model: String
    public let credentialId: String?

    public init(_ provider: String, _ model: String, credentialId: String? = nil) {
        self.provider = provider
        self.model = model
        self.credentialId = credentialId
    }

    var payload: [String: Any] {
        var body: [String: Any] = ["provider": provider, "model": model]
        if let credentialId { body["credentialId"] = credentialId }
        return body
    }
}

public struct VoiceStudioAgent: Sendable {
    public let id: String
    public let name: String
    public let prompt: String
}

public struct VoiceStudioReply: Sendable {
    public let text: String
    public let llmMs: Int
    public let model: String
    public let provider: String
    /// request, session, agent or platform.
    public let modelSource: String
    public let fallback: Bool
    /// Tools this app has to run. `sendText` runs the registered ones and resolves
    /// with the final reply, so this is only non-empty when a tool has no handler.
    public let toolCalls: [VoiceStudioToolCall]
}

public struct VoiceStudioToolCall: Sendable {
    public let id: String
    public let name: String
    public let arguments: [String: Any]

    public init(id: String, name: String, arguments: [String: Any]) {
        self.id = id
        self.name = name
        self.arguments = arguments
    }
}

extension VoiceStudioToolCall: @unchecked Sendable {}

/// Return a string, or anything `JSONSerialization` accepts. It goes back to the
/// model as the tool result.
public typealias VoiceStudioToolHandler = @Sendable ([String: Any]) async throws -> Any

public struct VoiceStudioProvider: Sendable {
    public let id: String
    public let label: String
    public let open: Bool
    public let models: [String]
    /// False until a key for this provider is stored under Keys.
    public let ready: Bool
}

public final class VoiceStudioClient: @unchecked Sendable {
    private let baseURL: URL
    private let apiKey: String
    private let agentId: String
    private let session: URLSession

    public init(baseURL: URL, apiKey: String, agentId: String, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.apiKey = apiKey
        self.agentId = agentId
        self.session = session
    }

    public func connect(
        channel: VoiceStudioChannel = .macos,
        display: String? = nil,
        model: VoiceStudioModel? = nil
    ) async throws -> VoiceStudioSession {
        var request = URLRequest(url: baseURL.appending(path: "/api/v1/sessions"))
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var body: [String: Any] = [
            "agentId": agentId,
            "channel": channel.rawValue,
        ]
        if let display { body["display"] = display }
        if let model { body["model"] = model.payload }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        try Self.throwIfNeeded(response, data: data)
        let body2 = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard
            let id = body2?["id"] as? String,
            let token = body2?["token"] as? String,
            let complete = body2?["completeUrl"] as? String,
            let hangup = body2?["hangupUrl"] as? String,
            let agentObj = body2?["agent"] as? [String: Any]
        else {
            throw VoiceStudioError.invalidResponse
        }

        return VoiceStudioSession(
            id: id,
            token: token,
            apiKey: apiKey,
            agent: VoiceStudioAgent(
                id: agentObj["id"] as? String ?? "",
                name: agentObj["name"] as? String ?? "",
                prompt: agentObj["prompt"] as? String ?? ""
            ),
            completeURL: URL(string: complete)!,
            hangupURL: URL(string: hangup)!,
            session: session
        )
    }

    /// Providers this tenant can switch to. Secret key only.
    public func models() async throws -> [VoiceStudioProvider] {
        var request = URLRequest(url: baseURL.appending(path: "/api/v1/models"))
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await session.data(for: request)
        try Self.throwIfNeeded(response, data: data)
        let body = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let providers = body?["providers"] as? [[String: Any]] ?? []
        return providers.map { item in
            VoiceStudioProvider(
                id: item["id"] as? String ?? "",
                label: item["label"] as? String ?? "",
                open: item["open"] as? Bool ?? false,
                models: item["models"] as? [String] ?? [],
                ready: item["ready"] as? Bool ?? false
            )
        }
    }

    /// Changes the agent's default, so every session opened after this starts on it.
    /// Passing nil puts the agent back on the platform model.
    public func setAgentModel(_ model: VoiceStudioModel?) async throws {
        var request = URLRequest(url: baseURL.appending(path: "/api/v1/agents/\(agentId)"))
        request.httpMethod = "PATCH"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(
            withJSONObject: ["model": model?.payload ?? NSNull()]
        )
        let (data, response) = try await session.data(for: request)
        try Self.throwIfNeeded(response, data: data)
    }

    static func throwIfNeeded(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw VoiceStudioError.invalidResponse }
        guard (200 ..< 300).contains(http.statusCode) else {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            throw VoiceStudioError.http(http.statusCode, message ?? "Request failed")
        }
    }
}

public final class VoiceStudioSession: @unchecked Sendable {
    public let id: String
    public let token: String
    public let agent: VoiceStudioAgent
    public var onTranscript: ((VoiceStudioReply) -> Void)?

    private let completeURL: URL
    private let hangupURL: URL
    private let apiKey: String
    private let session: URLSession
    private var tools: [String: VoiceStudioToolHandler] = [:]

    /// Matches MAX_TOOL_STEPS on the server, so the client cannot out-loop the turn.
    private static let maxToolRounds = 3

    init(
        id: String,
        token: String,
        apiKey: String,
        agent: VoiceStudioAgent,
        completeURL: URL,
        hangupURL: URL,
        session: URLSession
    ) {
        self.id = id
        self.token = token
        self.apiKey = apiKey
        self.agent = agent
        self.completeURL = completeURL
        self.hangupURL = hangupURL
        self.session = session
    }

    /// Registers a tool this app can run. The name has to match the tool in the
    /// studio. The handler holds this app's own credentials and data; only what it
    /// returns is sent to the control plane.
    public func tool(_ name: String, _ handler: @escaping VoiceStudioToolHandler) {
        tools[name] = handler
    }

    /// `model` runs this one turn elsewhere without changing the session. If the
    /// model calls a tool registered with `tool(_:_:)`, this runs it and carries on,
    /// so the result is the spoken answer and not a half-finished turn.
    public func sendText(_ text: String, model: VoiceStudioModel? = nil) async throws -> VoiceStudioReply {
        var body: [String: Any] = ["text": text]
        if let model { body["model"] = model.payload }
        var reply = try await post(body, withKey: model != nil)

        for _ in 0..<Self.maxToolRounds {
            let runnable = reply.toolCalls.filter { tools[$0.name] != nil }
            if runnable.isEmpty { break }
            var results: [[String: Any]] = []
            for call in runnable {
                results.append(["id": call.id, "result": await run(call)])
            }
            reply = try await post(["toolResults": results], withKey: false)
        }

        onTranscript?(reply)
        return reply
    }

    private func run(_ call: VoiceStudioToolCall) async -> String {
        guard let handler = tools[call.name] else { return "That tool is not available." }
        do {
            let output = try await handler(call.arguments)
            if let text = output as? String { return text }
            let data = try JSONSerialization.data(withJSONObject: output)
            return String(data: data, encoding: .utf8) ?? ""
        } catch {
            // The model can speak through a failed tool, so this is reported, not thrown.
            return "The tool failed: \(error.localizedDescription)"
        }
    }

    private func post(_ payload: [String: Any], withKey: Bool) async throws -> VoiceStudioReply {
        var request = URLRequest(url: completeURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var body = payload
        body["sessionId"] = id
        body["token"] = token
        if withKey {
            // A session token cannot choose a model; the secret key is what authorises it.
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await session.data(for: request)
        try VoiceStudioClient.throwIfNeeded(response, data: data)
        let parsed = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let rawCalls = parsed?["toolCalls"] as? [[String: Any]] ?? []
        return VoiceStudioReply(
            text: parsed?["reply"] as? String ?? "",
            llmMs: parsed?["llmMs"] as? Int ?? 0,
            model: parsed?["model"] as? String ?? "",
            provider: parsed?["provider"] as? String ?? "",
            modelSource: parsed?["modelSource"] as? String ?? "",
            fallback: parsed?["fallback"] as? Bool ?? false,
            toolCalls: rawCalls.compactMap { entry in
                guard let id = entry["id"] as? String, let name = entry["name"] as? String else {
                    return nil
                }
                return VoiceStudioToolCall(
                    id: id,
                    name: name,
                    arguments: entry["arguments"] as? [String: Any] ?? [:]
                )
            }
        )
    }

    /// Switches the model for every later turn of this session. Passing nil follows
    /// the agent again. The session URL is the same one `hangup` deletes.
    public func setModel(_ model: VoiceStudioModel?) async throws {
        var request = URLRequest(url: hangupURL)
        request.httpMethod = "PATCH"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(
            withJSONObject: ["model": model?.payload ?? NSNull()]
        )
        let (data, response) = try await session.data(for: request)
        try VoiceStudioClient.throwIfNeeded(response, data: data)
    }

    public func hangup() async throws {
        var request = URLRequest(url: hangupURL)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await session.data(for: request)
        try VoiceStudioClient.throwIfNeeded(response, data: data)
    }
}

public enum VoiceStudioError: Error, Sendable {
    case invalidResponse
    case http(Int, String)
}
