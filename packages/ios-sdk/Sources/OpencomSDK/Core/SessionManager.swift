import Foundation
import Security

/// Manages visitor sessions, signed session tokens, and user identification.
actor SessionManager {
    private let apiClient: OpencomAPIClient
    private let config: OpencomConfig
    private let keychain: KeychainHelper

    private(set) var visitorId: String?
    private(set) var sessionId: String
    private(set) var sessionToken: String?
    private(set) var sessionExpiresAt: Double?
    private(set) var isIdentified: Bool = false
    private(set) var currentUser: OpencomUser?

    private var refreshTask: Task<Void, Never>?

    private static let sessionIdKey = "opencom_session_id"
    private static let visitorIdKey = "opencom_visitor_id"
    private static let sessionTokenKey = "opencom_session_token"
    private static let sessionExpiresAtKey = "opencom_session_expires_at"
    private static let refreshMarginSeconds: Double = 60

    init(apiClient: OpencomAPIClient, config: OpencomConfig) {
        self.apiClient = apiClient
        self.config = config
        self.keychain = KeychainHelper()
        self.sessionId = Self.generateSessionId()
    }

    func initializeSession() async throws {
        // Try to restore session from keychain
        if let storedSessionId = keychain.get(Self.sessionIdKey) {
            sessionId = storedSessionId
        } else {
            sessionId = Self.generateSessionId()
            keychain.set(sessionId, forKey: Self.sessionIdKey)
        }

        // Boot a signed session
        let device = DeviceInfo.current()
        let bootResult = try await apiClient.bootSession(device: device)

        visitorId = bootResult.visitor._id
        sessionToken = bootResult.sessionToken
        sessionExpiresAt = bootResult.expiresAt

        keychain.set(bootResult.visitor._id, forKey: Self.visitorIdKey)
        keychain.set(bootResult.sessionToken, forKey: Self.sessionTokenKey)
        keychain.set(String(bootResult.expiresAt), forKey: Self.sessionExpiresAtKey)

        scheduleRefresh(expiresAt: bootResult.expiresAt)
    }

    func identify(user: OpencomUser) async throws {
        guard let visitorId = visitorId else {
            throw OpencomError.noVisitor
        }

        let device = DeviceInfo.current()
        try await apiClient.identifyVisitor(
            visitorId: visitorId,
            sessionToken: sessionToken,
            user: user,
            device: device
        )

        currentUser = user
        isIdentified = true
    }

    func logout() async throws {
        // Revoke current session
        if let token = sessionToken {
            try? await apiClient.revokeSession(sessionToken: token)
        }

        // Clear current session
        stopRefreshTimer()
        keychain.delete(Self.sessionIdKey)
        keychain.delete(Self.visitorIdKey)
        keychain.delete(Self.sessionTokenKey)
        keychain.delete(Self.sessionExpiresAtKey)

        // Generate new session
        sessionId = Self.generateSessionId()
        keychain.set(sessionId, forKey: Self.sessionIdKey)

        // Boot a new signed session
        let device = DeviceInfo.current()
        let bootResult = try await apiClient.bootSession(device: device)

        visitorId = bootResult.visitor._id
        sessionToken = bootResult.sessionToken
        sessionExpiresAt = bootResult.expiresAt

        keychain.set(bootResult.visitor._id, forKey: Self.visitorIdKey)
        keychain.set(bootResult.sessionToken, forKey: Self.sessionTokenKey)
        keychain.set(String(bootResult.expiresAt), forKey: Self.sessionExpiresAtKey)

        currentUser = nil
        isIdentified = false

        scheduleRefresh(expiresAt: bootResult.expiresAt)
    }

    func reset() {
        stopRefreshTimer()
        keychain.delete(Self.sessionIdKey)
        keychain.delete(Self.visitorIdKey)
        keychain.delete(Self.sessionTokenKey)
        keychain.delete(Self.sessionExpiresAtKey)
        visitorId = nil
        sessionId = Self.generateSessionId()
        sessionToken = nil
        sessionExpiresAt = nil
        currentUser = nil
        isIdentified = false
    }

    // MARK: - Refresh Timer

    private func scheduleRefresh(expiresAt: Double) {
        stopRefreshTimer()
        let delay = max(0, (expiresAt / 1000.0) - Date().timeIntervalSince1970 - Self.refreshMarginSeconds)
        refreshTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            guard !Task.isCancelled else { return }
            await self?.performRefresh()
        }
    }

    private func performRefresh() async {
        guard let token = sessionToken else { return }
        do {
            let result = try await apiClient.refreshSession(sessionToken: token)
            sessionToken = result.sessionToken
            sessionExpiresAt = result.expiresAt
            keychain.set(result.sessionToken, forKey: Self.sessionTokenKey)
            keychain.set(String(result.expiresAt), forKey: Self.sessionExpiresAtKey)
            scheduleRefresh(expiresAt: result.expiresAt)
        } catch {
            if config.debug {
                print("[OpencomSDK] Session refresh failed: \(error)")
            }
        }
    }

    private func stopRefreshTimer() {
        refreshTask?.cancel()
        refreshTask = nil
    }

    private static func generateSessionId() -> String {
        UUID().uuidString.lowercased()
    }
}

// MARK: - Keychain Helper

private final class KeychainHelper {
    private let service = "com.opencom.sdk"

    func get(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let string = String(data: data, encoding: .utf8) else {
            return nil
        }

        return string
    }

    func set(_ value: String, forKey key: String) {
        guard let data = value.data(using: .utf8) else { return }

        // Delete existing item first
        delete(key)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
        ]

        SecItemAdd(query as CFDictionary, nil)
    }

    func delete(_ key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]

        SecItemDelete(query as CFDictionary)
    }
}
