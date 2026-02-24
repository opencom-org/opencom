# OpencomSDK for iOS

Native iOS SDK for integrating Opencom customer messaging into Swift/SwiftUI apps.

## Requirements

- iOS 15.0+
- Swift 5.9+
- Xcode 15+

## Installation

### Swift Package Manager (Recommended)

Add the package to your `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/opencom-org/opencom-ios", from: "1.0.0")
]
```

Or in Xcode: File → Add Package Dependencies → Enter the repository URL.

### CocoaPods

Add to your `Podfile`:

```ruby
pod 'OpencomSDK', '~> 1.0'
```

Then run `pod install`.

## Quick Start

### 1. Initialize the SDK

Initialize Opencom when your app starts, typically in your `App` struct or `AppDelegate`:

```swift
import OpencomSDK

@main
struct MyApp: App {
    init() {
        Task {
            try await Opencom.initialize(
                workspaceId: "your-workspace-id",
                convexUrl: "https://your-instance.convex.cloud"
            )
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

### 2. Add the Launcher Button

Add the floating launcher button to your main view:

```swift
import OpencomSDK

struct ContentView: View {
    var body: some View {
        ZStack {
            // Your app content
            MainView()

            // Floating launcher button
            OpencomLauncher()
        }
    }
}
```

### 3. Identify Users

When a user logs in, identify them to personalize their experience:

```swift
try await Opencom.identify(user: OpencomUser(
    userId: "user-123",
    email: "user@example.com",
    name: "Jane Doe",
    company: "Acme Inc",
    customAttributes: ["plan": "pro", "signupDate": "2024-01-15"]
))
```

## Features

### Present Messenger Programmatically

```swift
// Open messenger
Opencom.present()

// Or use the alias
Opencom.presentMessenger()
```

### Help Center

```swift
// Open help center
Opencom.presentHelpCenter()
```

### Carousels

```swift
// Present a specific carousel
Opencom.presentCarousel(id: "carousel-id")
```

### Event Tracking

```swift
// Track custom events
try await Opencom.trackEvent("purchase_completed", properties: [
    "amount": 99.99,
    "currency": "USD",
    "productId": "prod-123"
])
```

### Logout

```swift
// Clear user session
try await Opencom.logout()
```

## Push Notifications

### 1. Enable Push Capabilities

In Xcode, add the Push Notifications capability to your target.

### 2. Register for Push

```swift
try await Opencom.registerForPush()
```

### 3. Handle Device Token

In your `AppDelegate`:

```swift
func application(_ application: UIApplication,
                 didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    Task {
        try await Opencom.setDeviceToken(deviceToken)
    }
}
```

### 4. Handle Notification Taps

```swift
func userNotificationCenter(_ center: UNUserNotificationCenter,
                           didReceive response: UNNotificationResponse,
                           withCompletionHandler completionHandler: @escaping () -> Void) {
    let handled = Opencom.handlePushNotification(userInfo: response.notification.request.content.userInfo)
    completionHandler()
}
```

## UIKit Support

For UIKit-based apps, use the provided view controllers:

```swift
import OpencomSDK

class ViewController: UIViewController {
    @IBAction func openSupport(_ sender: Any) {
        Opencom.present(from: self)
    }

    @IBAction func openHelpCenter(_ sender: Any) {
        Opencom.presentHelpCenter(from: self)
    }
}
```

Or embed the launcher:

```swift
let launcher = OpencomLauncherViewController()
addChild(launcher)
view.addSubview(launcher.view)
launcher.didMove(toParent: self)
```

## Theming

Customize the SDK appearance:

```swift
let theme = OpencomTheme(
    primaryColor: .purple,
    userMessageColor: .purple,
    messageBubbleRadius: 20,
    buttonRadius: 12
)

try await Opencom.initialize(
    workspaceId: "your-workspace-id",
    convexUrl: "https://your-instance.convex.cloud",
    theme: theme
)
```

## Debug Mode

Enable debug logging during development:

```swift
try await Opencom.initialize(
    workspaceId: "your-workspace-id",
    convexUrl: "https://your-instance.convex.cloud",
    debug: true
)
```

## License

GNU Affero General Public License v3.0 (AGPL-3.0). See LICENSE file for details.
