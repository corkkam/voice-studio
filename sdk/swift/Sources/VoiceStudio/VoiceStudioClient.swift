import Foundation

public enum VoiceStudioChannel: String, Sendable {
    case web, macos, api, studio
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
    public let fallback: Bool
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
        display: String? = nil
    ) async throws -> VoiceStudioSession {
        var request = URLRequest(url: baseURL.appending(path: "/api/v1/sessions"))
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "agentId": agentId,
            "channel": channel.rawValue,
            "display": display as Any,
        ].compactMapValues { $0 is NSNull ? nil : $0 })

        let (data, response) = try await session.data(for: request)
        try Self.throwIfNeeded(response, data: data)
        let body = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard
            let id = body?["id"] as? String,
            let token = body?["token"] as? String,
            let complete = body?["completeUrl"] as? String,
            let hangup = body?["hangupUrl"] as? String,
            let agentObj = body?["agent"] as? [String: Any]
        else {
            throw VoiceStudioError.invalidResponse
        }

        return VoiceStudioSession(
            id: id,
            token: token,
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
    private let session: URLSession

    init(
        id: String,
        token: String,
        agent: VoiceStudioAgent,
        completeURL: URL,
        hangupURL: URL,
        session: URLSession
    ) {
        self.id = id
        self.token = token
        self.agent = agent
        self.completeURL = completeURL
        self.hangupURL = hangupURL
        self.session = session
    }

    public func sendText(_ text: String) async throws -> VoiceStudioReply {
        var request = URLRequest(url: completeURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "sessionId": id,
            "token": token,
            "text": text,
        ])
        let (data, response) = try await session.data(for: request)
        try VoiceStudioClient.throwIfNeeded(response, data: data)
        let body = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let reply = VoiceStudioReply(
            text: body?["reply"] as? String ?? "",
            llmMs: body?["llmMs"] as? Int ?? 0,
            model: body?["model"] as? String ?? "",
            fallback: body?["fallback"] as? Bool ?? false
        )
        onTranscript?(reply)
        return reply
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
