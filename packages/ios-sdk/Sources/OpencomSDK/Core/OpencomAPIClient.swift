import Foundation
import UIKit

/// HTTP client for communicating with the Convex backend.
actor OpencomAPIClient {
    private let config: OpencomConfig
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(config: OpencomConfig) {
        self.config = config
        self.session = URLSession.shared
        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
    }

    // MARK: - Session APIs

    func bootSession(
        device: DeviceInfo
    ) async throws -> BootSessionResponse {
        let body: [String: Any] = [
            "path": "widgetSessions:boot",
            "args": [
                "workspaceId": config.workspaceId,
                "device": device.toDictionary()
            ]
        ]

        return try await post(body: body)
    }

    func refreshSession(sessionToken: String) async throws -> RefreshSessionResponse {
        let body: [String: Any] = [
            "path": "widgetSessions:refresh",
            "args": [
                "workspaceId": config.workspaceId,
                "sessionToken": sessionToken
            ]
        ]

        return try await post(body: body)
    }

    func revokeSession(sessionToken: String) async throws {
        let body: [String: Any] = [
            "path": "widgetSessions:revoke",
            "args": [
                "workspaceId": config.workspaceId,
                "sessionToken": sessionToken
            ]
        ]

        let _: EmptyResponse = try await post(body: body)
    }

    // MARK: - Visitor APIs

    func identifyVisitor(
        visitorId: String,
        sessionToken: String?,
        user: OpencomUser,
        device: DeviceInfo
    ) async throws {
        var args: [String: Any] = [
            "visitorId": visitorId,
            "device": device.toDictionary()
        ]

        if let sessionToken = sessionToken {
            args["sessionToken"] = sessionToken
        }

        if let email = user.email {
            args["email"] = email
        }
        if let name = user.name {
            args["name"] = name
        }
        if let userId = user.userId {
            args["externalUserId"] = userId
        }

        var customAttributes: [String: Any] = [:]
        if let company = user.company {
            customAttributes["company"] = company
        }
        if let attrs = user.customAttributes {
            for (key, value) in attrs {
                customAttributes[key] = value
            }
        }
        if !customAttributes.isEmpty {
            args["customAttributes"] = customAttributes
        }

        let body: [String: Any] = [
            "path": "visitors:identify",
            "args": args
        ]

        let _: EmptyResponse = try await post(body: body)
    }

    func heartbeat(visitorId: String, sessionToken: String?) async throws {
        var args: [String: Any] = ["visitorId": visitorId]
        if let sessionToken = sessionToken {
            args["sessionToken"] = sessionToken
        }
        let body: [String: Any] = [
            "path": "visitors:heartbeat",
            "args": args
        ]

        let _: EmptyResponse = try await post(body: body)
    }

    // MARK: - Event APIs

    func trackEvent(
        visitorId: String,
        sessionToken: String?,
        name: String,
        properties: [String: Any]?,
        sessionId: String
    ) async throws {
        var args: [String: Any] = [
            "visitorId": visitorId,
            "name": name,
            "sessionId": sessionId
        ]

        if let sessionToken = sessionToken {
            args["sessionToken"] = sessionToken
        }

        if let properties = properties {
            args["properties"] = properties
        }

        let body: [String: Any] = [
            "path": "events:track",
            "args": args
        ]

        let _: EmptyResponse = try await post(body: body)
    }

    // MARK: - Conversation APIs

    func getConversations(visitorId: String, sessionToken: String?, workspaceId: String) async throws -> [ConversationData] {
        var args: [String: Any] = [
            "visitorId": visitorId,
            "workspaceId": workspaceId
        ]
        if let sessionToken = sessionToken {
            args["sessionToken"] = sessionToken
        }
        let body: [String: Any] = [
            "path": "conversations:listByVisitor",
            "args": args
        ]

        let response: ConversationsResponse = try await post(body: body)
        return response.conversations
    }

    func getConversation(conversationId: String) async throws -> ConversationDetailData {
        let body: [String: Any] = [
            "path": "conversations:get",
            "args": ["conversationId": conversationId]
        ]

        return try await post(body: body)
    }

    func createConversation(visitorId: String, sessionToken: String?, workspaceId: String, initialMessage: String) async throws -> ConversationData {
        var args: [String: Any] = [
            "visitorId": visitorId,
            "workspaceId": workspaceId,
            "initialMessage": initialMessage
        ]
        if let sessionToken = sessionToken {
            args["sessionToken"] = sessionToken
        }
        let body: [String: Any] = [
            "path": "conversations:createForVisitor",
            "args": args
        ]

        return try await post(body: body)
    }

    func sendMessage(conversationId: String, content: String, visitorId: String, sessionToken: String?) async throws -> MessageData {
        var args: [String: Any] = [
            "conversationId": conversationId,
            "content": content,
            "senderId": visitorId,
            "senderType": "visitor",
            "visitorId": visitorId
        ]
        if let sessionToken = sessionToken {
            args["sessionToken"] = sessionToken
        }
        let body: [String: Any] = [
            "path": "messages:send",
            "args": args
        ]

        return try await post(body: body)
    }

    func getMessages(conversationId: String, visitorId: String?, sessionToken: String?) async throws -> [MessageData] {
        var args: [String: Any] = ["conversationId": conversationId]
        if let visitorId = visitorId {
            args["visitorId"] = visitorId
        }
        if let sessionToken = sessionToken {
            args["sessionToken"] = sessionToken
        }
        let body: [String: Any] = [
            "path": "messages:list",
            "args": args
        ]

        let response: MessagesResponse = try await post(body: body)
        return response.messages
    }

    // MARK: - Article APIs

    func getArticles(workspaceId: String) async throws -> [ArticleData] {
        let body: [String: Any] = [
            "path": "articles:listPublished",
            "args": ["workspaceId": workspaceId]
        ]

        let response: ArticlesResponse = try await post(body: body)
        return response.articles
    }

    func searchArticles(workspaceId: String, query: String) async throws -> [ArticleData] {
        let body: [String: Any] = [
            "path": "articles:search",
            "args": [
                "workspaceId": workspaceId,
                "query": query
            ]
        ]

        let response: ArticlesResponse = try await post(body: body)
        return response.articles
    }

    func getArticle(articleId: String) async throws -> ArticleData {
        let body: [String: Any] = [
            "path": "articles:get",
            "args": ["articleId": articleId]
        ]

        return try await post(body: body)
    }

    // MARK: - Carousel APIs

    func getCarousel(carouselId: String) async throws -> CarouselData {
        let body: [String: Any] = [
            "path": "carousels:get",
            "args": ["carouselId": carouselId]
        ]

        return try await post(body: body)
    }

    func trackCarouselInteraction(
        carouselId: String,
        visitorId: String,
        action: String,
        screenIndex: Int?
    ) async throws {
        var args: [String: Any] = [
            "carouselId": carouselId,
            "visitorId": visitorId,
            "action": action
        ]

        if let screenIndex = screenIndex {
            args["screenIndex"] = screenIndex
        }

        let body: [String: Any] = [
            "path": "carousels:trackInteraction",
            "args": args
        ]

        let _: EmptyResponse = try await post(body: body)
    }

    // MARK: - Push Notification APIs

    func registerPushToken(visitorId: String, token: String, platform: String) async throws {
        let body: [String: Any] = [
            "path": "pushTokens:register",
            "args": [
                "visitorId": visitorId,
                "token": token,
                "platform": platform
            ]
        ]

        let _: EmptyResponse = try await post(body: body)
    }

    // MARK: - HTTP

    private func post<T: Decodable>(body: [String: Any]) async throws -> T {
        guard let url = URL(string: "\(config.convexUrl)/api/mutation") else {
            throw OpencomError.invalidResponse
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw OpencomError.invalidResponse
        }

        if config.debug {
            print("[OpencomSDK] Response status: \(httpResponse.statusCode)")
            if let responseString = String(data: data, encoding: .utf8) {
                print("[OpencomSDK] Response body: \(responseString)")
            }
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw OpencomError.networkError(
                NSError(domain: "OpencomSDK", code: httpResponse.statusCode)
            )
        }

        return try decoder.decode(T.self, from: data)
    }
}

// MARK: - Response Types

struct BootSessionResponse: Codable {
    let visitor: BootVisitor
    let sessionToken: String
    let expiresAt: Double

    struct BootVisitor: Codable {
        let _id: String
    }
}

struct RefreshSessionResponse: Codable {
    let sessionToken: String
    let expiresAt: Double
}

struct EmptyResponse: Codable {}

struct ConversationsResponse: Codable {
    let conversations: [ConversationData]
}

struct MessagesResponse: Codable {
    let messages: [MessageData]
}

struct ArticlesResponse: Codable {
    let articles: [ArticleData]
}

// MARK: - Data Types

public struct ConversationData: Codable, Identifiable {
    public let id: String
    public let lastMessage: String?
    public let lastMessageAt: Double?
    public let unreadCount: Int
    public let createdAt: Double

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case lastMessage
        case lastMessageAt
        case unreadCount
        case createdAt
    }
}

public struct ConversationDetailData: Codable {
    public let id: String
    public let messages: [MessageData]
    public let createdAt: Double

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case messages
        case createdAt
    }
}

public struct MessageData: Codable, Identifiable {
    public let id: String
    public let conversationId: String
    public let senderId: String
    public let senderType: String
    public let content: String
    public let createdAt: Double

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case conversationId
        case senderId
        case senderType
        case content
        case createdAt
    }

    public var isFromVisitor: Bool {
        senderType == "visitor"
    }
}

public struct ArticleData: Codable, Identifiable {
    public let id: String
    public let title: String
    public let content: String
    public let slug: String
    public let summary: String?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case title
        case content
        case slug
        case summary
    }
}

public struct CarouselData: Codable, Identifiable {
    public let id: String
    public let name: String
    public let screens: [CarouselScreen]

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case name
        case screens
    }
}

public struct CarouselScreen: Codable, Identifiable {
    public let id: String
    public let title: String?
    public let body: String?
    public let imageUrl: String?
    public let buttons: [CarouselButton]?
}

public struct CarouselButton: Codable {
    public let text: String
    public let action: String
    public let url: String?
    public let deepLink: String?
}

// MARK: - Device Info

struct DeviceInfo {
    let os: String
    let platform: String
    let deviceType: String
    let appVersion: String?

    static func current() -> DeviceInfo {
        DeviceInfo(
            os: "iOS \(UIDevice.current.systemVersion)",
            platform: "ios",
            deviceType: UIDevice.current.userInterfaceIdiom == .pad ? "tablet" : "mobile",
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String
        )
    }

    func toDictionary() -> [String: Any] {
        var dict: [String: Any] = [
            "os": os,
            "platform": platform,
            "deviceType": deviceType
        ]
        if let appVersion = appVersion {
            dict["appVersion"] = appVersion
        }
        return dict
    }
}
