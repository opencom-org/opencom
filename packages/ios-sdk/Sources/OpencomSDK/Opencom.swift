import Foundation
import SwiftUI

/// Main entry point for the Opencom iOS SDK.
/// Use this class to initialize the SDK, identify users, track events, and present UI.
@MainActor
public final class Opencom {

    // MARK: - Singleton

    /// Shared instance of the SDK
    public static let shared = Opencom()

    // MARK: - Properties

    private var isInitialized = false
    private var config: OpencomConfig?
    private var apiClient: OpencomAPIClient?
    private var sessionManager: SessionManager?
    private var pushManager: PushNotificationManager?
    private var heartbeatTimer: Timer?
    private var cachedVisitorId: String?
    private var cachedSessionId: String?
    private var cachedSessionToken: String?

    private static let heartbeatInterval: TimeInterval = 30

    // MARK: - Initialization

    private init() {}

    /// Initialize the SDK with workspace credentials.
    /// Call this once when your app starts, typically in `AppDelegate` or `@main` App struct.
    ///
    /// - Parameters:
    ///   - workspaceId: Your Opencom workspace ID
    ///   - convexUrl: The Convex backend URL
    ///   - theme: Optional custom theme for UI components
    ///   - debug: Enable debug logging (default: false)
    public static func initialize(
        workspaceId: String,
        convexUrl: String,
        theme: OpencomTheme? = nil,
        debug: Bool = false
    ) async throws {
        try await shared.initializeInternal(
            workspaceId: workspaceId,
            convexUrl: convexUrl,
            theme: theme,
            debug: debug
        )
    }

    private func initializeInternal(
        workspaceId: String,
        convexUrl: String,
        theme: OpencomTheme?,
        debug: Bool
    ) async throws {
        guard !isInitialized else {
            log("SDK already initialized", level: .warning)
            return
        }

        let config = OpencomConfig(
            workspaceId: workspaceId,
            convexUrl: convexUrl,
            theme: theme ?? OpencomTheme(),
            debug: debug
        )
        self.config = config

        // Initialize API client
        let apiClient = OpencomAPIClient(config: config)
        self.apiClient = apiClient

        // Initialize session manager
        let sessionManager = SessionManager(apiClient: apiClient, config: config)
        self.sessionManager = sessionManager

        // Initialize push manager
        let pushManager = PushNotificationManager(apiClient: apiClient)
        self.pushManager = pushManager

        // Create or retrieve visitor
        try await sessionManager.initializeSession()

        // Cache visitor, session IDs and session token
        cachedVisitorId = await sessionManager.visitorId
        cachedSessionId = await sessionManager.sessionId
        cachedSessionToken = await sessionManager.sessionToken

        // Start heartbeat
        startHeartbeat()

        isInitialized = true
        log("SDK initialized successfully")
    }

    // MARK: - User Identification

    /// Identify the current user with their attributes.
    /// Call this when a user logs in or when you have user information.
    ///
    /// - Parameter user: User identification data including email, name, and custom attributes
    public static func identify(user: OpencomUser) async throws {
        try await shared.identifyInternal(user: user)
    }

    private func identifyInternal(user: OpencomUser) async throws {
        guard isInitialized, let sessionManager = sessionManager else {
            log("SDK not initialized. Call initialize() first.", level: .error)
            throw OpencomError.notInitialized
        }

        try await sessionManager.identify(user: user)
        log("User identified: \(user.userId ?? user.email ?? "anonymous")")
    }

    // MARK: - Event Tracking

    /// Track a custom event for analytics and targeting.
    ///
    /// - Parameters:
    ///   - name: Event name (e.g., "purchase_completed")
    ///   - properties: Optional dictionary of event properties
    public static func trackEvent(_ name: String, properties: [String: Any]? = nil) async throws {
        try await shared.trackEventInternal(name, properties: properties)
    }

    private func trackEventInternal(_ name: String, properties: [String: Any]?) async throws {
        guard isInitialized, let apiClient = apiClient else {
            log("SDK not initialized. Call initialize() first.", level: .error)
            throw OpencomError.notInitialized
        }

        guard let visitorId = cachedVisitorId, let sessionId = cachedSessionId else {
            log("No visitor ID available", level: .error)
            throw OpencomError.noVisitor
        }

        try await apiClient.trackEvent(
            visitorId: visitorId,
            sessionToken: cachedSessionToken,
            name: name,
            properties: properties,
            sessionId: sessionId
        )
        log("Event tracked: \(name)")
    }

    // MARK: - Logout

    /// Log out the current user and reset the session.
    /// A new anonymous visitor will be created.
    public static func logout() async throws {
        try await shared.logoutInternal()
    }

    private func logoutInternal() async throws {
        guard isInitialized, let sessionManager = sessionManager else {
            return
        }

        stopHeartbeat()
        try await sessionManager.logout()

        // Update cached IDs
        cachedVisitorId = await sessionManager.visitorId
        cachedSessionId = await sessionManager.sessionId
        cachedSessionToken = await sessionManager.sessionToken

        startHeartbeat()
        log("User logged out")
    }

    // MARK: - Presentation

    /// Present the messenger UI.
    /// Shows the conversation list or active conversation.
    public static func present() {
        shared.presentInternal()
    }

    /// Present the messenger UI (alias for present()).
    public static func presentMessenger() {
        present()
    }

    private func presentInternal() {
        guard isInitialized else {
            log("SDK not initialized. Call initialize() first.", level: .error)
            return
        }

        OpencomPresenter.shared.presentMessenger()
    }

    /// Present the help center UI.
    public static func presentHelpCenter() {
        shared.presentHelpCenterInternal()
    }

    private func presentHelpCenterInternal() {
        guard isInitialized else {
            log("SDK not initialized. Call initialize() first.", level: .error)
            return
        }

        OpencomPresenter.shared.presentHelpCenter()
    }

    /// Present a specific carousel by ID.
    ///
    /// - Parameter id: The carousel ID to display
    public static func presentCarousel(id: String) {
        shared.presentCarouselInternal(id: id)
    }

    private func presentCarouselInternal(id: String) {
        guard isInitialized else {
            log("SDK not initialized. Call initialize() first.", level: .error)
            return
        }

        OpencomPresenter.shared.presentCarousel(id: id)
    }

    /// Dismiss any presented Opencom UI.
    public static func dismiss() {
        OpencomPresenter.shared.dismiss()
    }

    // MARK: - Push Notifications

    /// Register for push notifications.
    /// This will request notification permissions and register the device token with Opencom.
    public static func registerForPush() async throws {
        try await shared.registerForPushInternal()
    }

    private func registerForPushInternal() async throws {
        guard isInitialized, let pushManager = pushManager else {
            log("SDK not initialized. Call initialize() first.", level: .error)
            throw OpencomError.notInitialized
        }

        try await pushManager.registerForPushNotifications()
    }

    /// Handle a received push notification.
    /// Call this from your AppDelegate's notification handling methods.
    ///
    /// - Parameter userInfo: The notification payload
    /// - Returns: true if the notification was handled by Opencom, false otherwise
    @discardableResult
    public static func handlePushNotification(userInfo: [AnyHashable: Any]) -> Bool {
        shared.handlePushNotificationInternal(userInfo: userInfo)
    }

    private func handlePushNotificationInternal(userInfo: [AnyHashable: Any]) -> Bool {
        guard isInitialized, let pushManager = pushManager else {
            return false
        }

        return pushManager.handleNotification(userInfo: userInfo)
    }

    /// Set the APNs device token.
    /// Call this from `application(_:didRegisterForRemoteNotificationsWithDeviceToken:)`.
    ///
    /// - Parameter deviceToken: The device token data
    public static func setDeviceToken(_ deviceToken: Data) async throws {
        try await shared.setDeviceTokenInternal(deviceToken)
    }

    private func setDeviceTokenInternal(_ deviceToken: Data) async throws {
        guard isInitialized, let pushManager = pushManager else {
            log("SDK not initialized. Call initialize() first.", level: .error)
            throw OpencomError.notInitialized
        }

        guard let visitorId = cachedVisitorId else {
            log("No visitor ID available", level: .error)
            throw OpencomError.noVisitor
        }

        try await pushManager.registerDeviceToken(deviceToken, visitorId: visitorId)
    }

    // MARK: - State

    /// Check if the SDK is initialized.
    public static var isReady: Bool {
        shared.isInitialized
    }

    /// Get the current visitor ID.
    public static var visitorId: String? {
        shared.cachedVisitorId
    }

    /// Get the current theme.
    public static var theme: OpencomTheme {
        shared.config?.theme ?? OpencomTheme()
    }

    // MARK: - Internal Access

    static var apiClientInternal: OpencomAPIClient? {
        shared.apiClient
    }

    static var sessionManagerInternal: SessionManager? {
        shared.sessionManager
    }

    static var configInternal: OpencomConfig? {
        shared.config
    }

    // MARK: - Heartbeat

    private func startHeartbeat() {
        stopHeartbeat()

        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: Self.heartbeatInterval, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                await self?.sendHeartbeat()
            }
        }

        // Send initial heartbeat
        Task {
            await sendHeartbeat()
        }
    }

    private func stopHeartbeat() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
    }

    private func sendHeartbeat() async {
        guard let apiClient = apiClient, let visitorId = cachedVisitorId else {
            return
        }

        do {
            try await apiClient.heartbeat(visitorId: visitorId, sessionToken: cachedSessionToken)
        } catch {
            log("Heartbeat failed: \(error)", level: .warning)
        }
    }

    // MARK: - Logging

    private func log(_ message: String, level: LogLevel = .info) {
        guard config?.debug == true else { return }
        print("[OpencomSDK] [\(level.rawValue.uppercased())] \(message)")
    }

    private enum LogLevel: String {
        case info
        case warning
        case error
    }

    // MARK: - Reset (Testing)

    /// Reset the SDK state. For testing purposes only.
    public static func reset() async {
        await shared.resetInternal()
    }

    private func resetInternal() async {
        stopHeartbeat()
        if let sessionManager = sessionManager {
            await sessionManager.reset()
        }
        apiClient = nil
        sessionManager = nil
        pushManager = nil
        config = nil
        cachedVisitorId = nil
        cachedSessionId = nil
        cachedSessionToken = nil
        isInitialized = false
    }
}
