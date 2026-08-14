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
}

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

    /// `model` runs this one turn elsewhere without changing the session.
    public func sendText(_ text: String, model: VoiceStudioModel? = nil) async throws -> VoiceStudioReply {
        var request = URLRequest(url: completeURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var body: [String: Any] = [
            "sessionId": id,
            "token": token,
            "text": text,
        ]
        if let model {
            body["model"] = model.payload
            // A session token cannot choose a model; the secret key is what authorises it.
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await session.data(for: request)
        try VoiceStudioClient.throwIfNeeded(response, data: data)
        let parsed = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let reply = VoiceStudioReply(
            text: parsed?["reply"] as? String ?? "",
            llmMs: parsed?["llmMs"] as? Int ?? 0,
            model: parsed?["model"] as? String ?? "",
            provider: parsed?["provider"] as? String ?? "",
            modelSource: parsed?["modelSource"] as? String ?? "",
            fallback: parsed?["fallback"] as? Bool ?? false
        )
        onTranscript?(reply)
        return reply
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
