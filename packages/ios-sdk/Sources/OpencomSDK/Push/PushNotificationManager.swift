import Foundation
import UserNotifications
import UIKit

/// Manages push notification registration and handling.
actor PushNotificationManager {
    private let apiClient: OpencomAPIClient
    private var deviceToken: String?

    init(apiClient: OpencomAPIClient) {
        self.apiClient = apiClient
    }

    func registerForPushNotifications() async throws {
        let center = UNUserNotificationCenter.current()

        let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])

        guard granted else {
            throw OpencomError.pushNotificationsFailed(
                NSError(domain: "OpencomSDK", code: -1, userInfo: [
                    NSLocalizedDescriptionKey: "User denied push notification permission"
                ])
            )
        }

        await MainActor.run {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    func registerDeviceToken(_ tokenData: Data, visitorId: String) async throws {
        let token = tokenData.map { String(format: "%02.2hhx", $0) }.joined()
        deviceToken = token

        try await apiClient.registerPushToken(
            visitorId: visitorId,
            token: token,
            platform: "ios"
        )
    }

    nonisolated func handleNotification(userInfo: [AnyHashable: Any]) -> Bool {
        guard let opencomData = userInfo["opencom"] as? [String: Any] else {
            return false
        }

        if let conversationId = opencomData["conversationId"] as? String {
            Task { @MainActor in
                OpencomPresenter.shared.presentConversation(id: conversationId)
            }
            return true
        }

        if let carouselId = opencomData["carouselId"] as? String {
            Task { @MainActor in
                OpencomPresenter.shared.presentCarousel(id: carouselId)
            }
            return true
        }

        if let articleId = opencomData["articleId"] as? String {
            Task { @MainActor in
                OpencomPresenter.shared.presentArticle(id: articleId)
            }
            return true
        }

        return false
    }
}
