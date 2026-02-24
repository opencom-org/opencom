# Mobile SDK Reference

Opencom provides native SDKs for embedding customer messaging into mobile apps. All SDKs share the same backend API surface via `packages/sdk-core`.

| SDK          | Language   | Package                     | Distribution    |
| ------------ | ---------- | --------------------------- | --------------- |
| React Native | TypeScript | `packages/react-native-sdk` | npm             |
| iOS          | Swift      | `packages/ios-sdk`          | SPM + CocoaPods |
| Android      | Kotlin     | `packages/android-sdk`      | Maven / Gradle  |

## Shared Concepts

All SDKs follow the same lifecycle:

1. **Initialize** with `workspaceId` and `convexUrl`.
2. **Identify** the user when they log in (email, userId, customAttributes).
3. **Track events** for analytics and targeting.
4. **Present** the messenger UI.
5. **Register push tokens** for notifications.

All SDKs use signed session tokens (`wst_…`) for visitor authentication, managed automatically by the SDK.

## React Native SDK

Source: `packages/react-native-sdk/`

### Installation

```bash
pnpm add @opencom/react-native-sdk
```

### Provider Setup

```tsx
import { OpencomProvider } from "@opencom/react-native-sdk";

function App() {
  return (
    <OpencomProvider
      config={{
        workspaceId: "your_workspace_id",
        convexUrl: "https://your-project.convex.cloud",
      }}
    >
      <YourApp />
    </OpencomProvider>
  );
}
```

### OpencomSDK Object

```typescript
import { OpencomSDK } from "@opencom/react-native-sdk";

await OpencomSDK.initialize({
  workspaceId: "...",
  convexUrl: "...",
});

await OpencomSDK.identify({
  email: "user@example.com",
  name: "Jane Doe",
  userId: "usr_123",
  customAttributes: { plan: "pro" },
});

await OpencomSDK.trackEvent("feature_used", { feature: "export" });
await OpencomSDK.trackScreenView("Settings");

OpencomSDK.isInitialized();
OpencomSDK.getVisitorState();

await OpencomSDK.registerForPush();
await OpencomSDK.unregisterFromPush();
await OpencomSDK.logout();
await OpencomSDK.reset();
```

### React Native Push Integration Modes

The React Native SDK supports both:

1. **App already has push notifications**
2. **App uses Opencom as the only push path**

Recommended flow in both modes:

1. Initialize Opencom with the workspace `convexUrl`.
2. Register push via `OpencomSDK.registerForPush()` or `usePushNotifications().register()`.
3. Optionally configure listeners with `configurePushNotifications` + `setupNotificationListeners`.

When visitor/session context is missing, registration safely no-ops and does not persist a visitor push token.

```tsx
import {
  OpencomSDK,
  configurePushNotifications,
  setupNotificationListeners,
  usePushNotifications,
} from "@opencom/react-native-sdk";

await OpencomSDK.initialize({ workspaceId: "...", convexUrl: "..." });
await OpencomSDK.registerForPush();
await OpencomSDK.unregisterFromPush();

// Hook alternative
const { register, unregister } = usePushNotifications();
await register();
await unregister();
```

### Push Ownership Model (React Native)

| Concern                                                  | Owner                                    |
| -------------------------------------------------------- | ---------------------------------------- |
| SDK registration mutation destination                    | Opencom Convex deployment at `convexUrl` |
| Visitor token persistence and campaign recipient routing | Opencom backend (`visitorPushTokens`)    |
| APNs/FCM credentials used by Expo delivery               | The app developer's Expo/APNs/FCM setup  |

This means Opencom handles routing and targeting, while the host app's push credentials determine transport-level deliverability.

### Notification Preference and Deduplication Model

Notification delivery is resolved in layers:

1. Workspace default event preferences (`workspaceNotificationDefaults`)
2. Member-level event/channel overrides (`notificationPreferences`)
3. Device token enablement (`pushTokens` / `visitorPushTokens`)

Delivery is idempotent per event-recipient-channel combination. The backend
records dedupe keys and delivery outcomes so retries do not fan out duplicate
pushes.

### Components

```tsx
import {
  Opencom,
  OpencomLauncher,
  OpencomMessenger,
  OpencomHelpCenter,
  OpencomTickets,
  OpencomTicketCreate,
  OpencomTicketDetail,
  OpencomCarousel,
  OpencomSurveyRuntime,
  OpencomOutbound,
  OpencomChecklist,
} from "@opencom/react-native-sdk";
```

**`<Opencom>` Props:**

| Prop               | Type          | Default   | Description                         |
| ------------------ | ------------- | --------- | ----------------------------------- |
| `config`           | OpencomConfig | required  | SDK configuration                   |
| `user`             | OpencomUser?  | undefined | Pre-identify user                   |
| `userHash`         | string?       | undefined | HMAC hash for identity verification |
| `enableMessages`   | boolean?      | true      | Enable chat                         |
| `enableHelpCenter` | boolean?      | true      | Enable help articles                |
| `enableTickets`    | boolean?      | true      | Enable ticket submission            |
| `enableTours`      | boolean?      | true      | Enable product tours                |
| `enableChecklists` | boolean?      | true      | Enable checklists                   |
| `enableOutbound`   | boolean?      | true      | Enable outbound messages            |
| `enableSurveys`    | boolean?      | true      | Enable surveys                      |
| `enableCarousels`  | boolean?      | true      | Enable carousels                    |
| `onOpen`           | () => void    | undefined | Callback when messenger opens       |
| `onClose`          | () => void    | undefined | Callback when messenger closes      |

### Hooks

```typescript
import {
  useOpencom,
  useConversations,
  useConversation,
  useCreateConversation,
  useArticles,
  useArticleSearch,
  useArticle,
  useArticleSuggestions,
  useTickets,
  useTicket,
  useAIAgent,
  useOutboundMessages,
  useChecklists,
  useOfficeHours,
  useMessengerSettings,
  useOpencomTheme,
  useAutomationSettings,
  useSurveyDelivery,
  usePushNotifications,
} from "@opencom/react-native-sdk";
```

### Event Listening

```typescript
const unsubscribe = OpencomSDK.addEventListener((event) => {
  switch (event.type) {
    case "message_received":
      // handle new message
      break;
    case "conversation_created":
      // handle new conversation
      break;
  }
});
```

**Event Types:**
`visitor_created`, `visitor_identified`, `conversation_created`, `message_received`, `message_sent`, `push_token_registered`, `carousel_shown`, `carousel_dismissed`, `messenger_opened`, `messenger_closed`, `help_center_opened`, `help_center_closed`, `tickets_opened`, `ticket_opened`, `outbound_message_shown`, `outbound_message_dismissed`, `checklist_completed`, `deep_link_received`

### Example App

```bash
cd packages/react-native-sdk/example
pnpm start
```

## iOS SDK (Swift)

Source: `packages/ios-sdk/`

### Installation

**Swift Package Manager:**

```swift
// Package.swift
dependencies: [
    .package(url: "https://github.com/opencom-org/opencom-ios-sdk", from: "1.0.0")
]
```

**CocoaPods:**

```ruby
pod 'OpencomSDK'
```

### Initialization

```swift
import OpencomSDK

try await Opencom.initialize(
    workspaceId: "your_workspace_id",
    convexUrl: "https://your-project.convex.cloud",
    theme: OpencomTheme(),
    debug: false
)
```

### User Identification

```swift
try await Opencom.identify(user: OpencomUser(
    userId: "usr_123",
    email: "user@example.com",
    name: "Jane Doe",
    company: "Acme Inc",
    customAttributes: ["plan": "pro"]
))
```

### Event Tracking

```swift
try await Opencom.trackEvent("feature_used", properties: [
    "feature": "export",
    "format": "csv"
])
```

### Presenting UI

```swift
Opencom.present()            // Full messenger
Opencom.presentMessenger()   // Messenger only
Opencom.presentHelpCenter()  // Help center only
Opencom.presentCarousel(id: "carousel_123")
Opencom.dismiss()
```

### Push Notifications

```swift
try await Opencom.registerForPush()
Opencom.setDeviceToken(deviceToken)

// In notification delegate
func userNotificationCenter(_ center: UNUserNotificationCenter,
                            didReceive response: UNNotificationResponse) {
    let handled = Opencom.handlePushNotification(userInfo: response.notification.request.content.userInfo)
}
```

### SwiftUI Integration

```swift
import SwiftUI
import OpencomSDK

struct ContentView: View {
    var body: some View {
        Button("Open Messenger") {
            Opencom.present()
        }
    }
}
```

### Configuration

```swift
public struct OpencomConfig {
    let workspaceId: String
    let convexUrl: String
    let theme: OpencomTheme
    let debug: Bool
}

public struct OpencomUser {
    let userId: String?
    let email: String?
    let name: String?
    let company: String?
    let customAttributes: [String: Any]?
}
```

### State

```swift
Opencom.isReady      // Bool: SDK initialized and ready
Opencom.visitorId    // String?: Current visitor ID
Opencom.theme        // OpencomTheme: Current theme
```

## Android SDK (Kotlin)

Source: `packages/android-sdk/`

### Installation

```kotlin
// build.gradle.kts
dependencies {
    implementation("com.opencom:sdk:1.0.0")
}
```

### Initialization

```kotlin
import com.opencom.sdk.Opencom
import com.opencom.sdk.OpencomConfig

Opencom.initialize(
    context = applicationContext,
    config = OpencomConfig(
        workspaceId = "your_workspace_id",
        convexUrl = "https://your-project.convex.cloud",
        debug = false
    )
)
```

### User Identification

```kotlin
import com.opencom.sdk.OpencomUser

Opencom.identify(OpencomUser(
    userId = "usr_123",
    email = "user@example.com",
    name = "Jane Doe",
    company = "Acme Inc",
    customAttributes = mapOf("plan" to "pro")
))
```

`OpencomUser` requires at least `userId` or `email`.

### Event Tracking

```kotlin
Opencom.trackEvent("feature_used", mapOf(
    "feature" to "export",
    "format" to "csv"
))
```

### Presenting UI

```kotlin
Opencom.present(context)           // Full messenger
Opencom.presentMessenger(context)  // Messenger only
Opencom.presentHelpCenter(context) // Help center only
Opencom.presentCarousel(context, "carousel_123")
```

### Push Notifications

```kotlin
// In FirebaseMessagingService
override fun onMessageReceived(remoteMessage: RemoteMessage) {
    val handled = Opencom.handlePushNotification(remoteMessage.data)
    if (!handled) {
        // Handle non-Opencom notification
    }
}

override fun onNewToken(token: String) {
    Opencom.registerPushToken(token)
}
```

### Jetpack Compose

```kotlin
import com.opencom.sdk.Opencom

@Composable
fun MessengerButton() {
    val context = LocalContext.current
    Button(onClick = { Opencom.present(context) }) {
        Text("Open Messenger")
    }
}
```

### State

```kotlin
Opencom.isReady        // Boolean: SDK initialized
Opencom.visitorId      // String?: Current visitor ID
Opencom.sessionToken   // String?: Current session token
Opencom.theme          // OpencomTheme: Current theme
```

## SDK Core

Source: `packages/sdk-core/`

The SDK Core package provides shared business logic used by all SDKs:

- **Session management**: `bootSession()`, `refreshSession()`, `revokeSession()` — handles session token lifecycle.
- **State management**: `getVisitorState()`, `setVisitorId()`, `setSessionToken()` — maintains visitor identity.
- **API client**: `identifyVisitor()`, `sendMessage()`, `createConversation()`, `markAsRead()`, `trackEvent()`.
- **Event system**: `emitEvent()`, `addEventListener()` — cross-SDK event bus.

All SDK Core functions accept and forward `sessionToken` for visitor authentication.

## Push Notification Architecture

```
1. User grants notification permission
2. SDK registers visitor device token with backend (visitorPushTokens)
3. When support reply or visitor-targeted push campaign is sent:
   Backend → resolves eligible visitor recipients from visitorPushTokens + audience rules
   Backend → sends payload to Expo Push API
   Expo → APNs / FCM using the app project's push credentials
4. Device receives notification
5. SDK handles tap → opens conversation
```

Preference checks and suppression run before transport:

- sender/session suppression prevents self-notifications
- event/channel preferences are evaluated for each recipient
- token-level disabled states are honored
- delivery outcomes are persisted with status (`delivered`, `suppressed`, `failed`)

## Identity Verification

All SDKs support HMAC identity verification:

1. Generate `userHash` server-side: `HMAC-SHA256(userId, secret)`
2. Pass `userHash` when calling `identify()` (or include it in the user payload used during initialization).
3. Backend validates hash against workspace's HMAC secret.
4. Visitor is marked as `identityVerified: true`.

See [Security docs](security.md) for full HMAC integration details.

## Mobile Security Baseline

Opencom mobile runtimes enforce explicit network and backup posture:

- Android app and SDK examples declare explicit `networkSecurityConfig`
- Android app and SDK examples set `android:allowBackup="false"`
- non-launcher exported components are avoided unless explicitly required
- iOS example policy does not allow local networking by default in production-facing configs

Use this baseline when reviewing or extending mobile SDK/app manifests.
