import SwiftUI
import OpencomSDK

@main
struct OpencomExampleApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    init() {
        Task {
            do {
                // Initialize with your workspace credentials
                // Replace these with your actual values
                try await Opencom.initialize(
                    workspaceId: "your-workspace-id",
                    convexUrl: "https://your-instance.convex.cloud",
                    theme: OpencomTheme(
                        primaryColor: .purple
                    ),
                    debug: true
                )
                print("Opencom SDK initialized successfully")
            } catch {
                print("Failed to initialize Opencom SDK: \(error)")
            }
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task {
            do {
                try await Opencom.setDeviceToken(deviceToken)
                print("Push token registered successfully")
            } catch {
                print("Failed to register push token: \(error)")
            }
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("Failed to register for remote notifications: \(error)")
    }

    // Handle notification when app is in foreground
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .badge])
    }

    // Handle notification tap
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        let handled = Opencom.handlePushNotification(userInfo: response.notification.request.content.userInfo)
        if handled {
            print("Notification handled by Opencom")
        }
        completionHandler()
    }
}
