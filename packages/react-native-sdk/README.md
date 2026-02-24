# @opencom/react-native-sdk

React Native SDK for embedding Opencom in customer mobile apps. Provides native UI components for chat messenger, help center, carousels, and push notifications.

## Installation

```bash
# Install the SDK
npm install @opencom/react-native-sdk
# or
pnpm add @opencom/react-native-sdk

# Install peer dependencies
npx expo install expo-notifications @react-native-async-storage/async-storage
```

## Expo Setup

Add the plugin to your `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "@opencom/react-native-sdk",
        {
          "workspaceId": "your-workspace-id",
          "convexUrl": "https://your-deployment.convex.cloud"
        }
      ]
    ]
  }
}
```

Then rebuild:

```bash
npx expo prebuild
```

## Quick Start (Recommended)

The simplest way to add Opencom to your app is with the `<Opencom />` component:

```tsx
import { Opencom } from "@opencom/react-native-sdk";

function App() {
  return (
    <Opencom
      config={{
        workspaceId: "your-workspace-id",
        convexUrl: "https://your-deployment.convex.cloud",
      }}
      user={{ email: "user@example.com", name: "Jane" }}
      enableMessages={true}
      enableHelpCenter={true}
      enableTickets={true}
      enableChecklists={true}
    >
      <YourAppContent />
    </Opencom>
  );
}
```

This single component provides:

- **Launcher button** - Floating chat button with unread badge
- **Full messenger UI** - Tabbed interface with Home, Messages, Help Center, Tickets, and Tasks
- **Customizable Home** - Welcome header, search, recent conversations, featured articles
- **User identification** - Pass user prop or let users enter email in-app
- **Outbound messages** - Automatic display of targeted messages
- **Theming** - Inherits colors from your workspace settings

### Imperative API

Control the messenger programmatically with a ref:

```tsx
import { Opencom, type OpencomRef } from "@opencom/react-native-sdk";

function App() {
  const opencomRef = useRef<OpencomRef>(null);

  return (
    <Opencom ref={opencomRef} config={config}>
      <Button onPress={() => opencomRef.current?.present()} title="Open Chat" />
      <Button onPress={() => opencomRef.current?.presentHelpCenter()} title="Help" />
    </Opencom>
  );
}
```

Available methods:

- `present()` - Open the messenger
- `dismiss()` - Close the messenger
- `presentHelpCenter()` - Open Help Center tab
- `presentMessages()` - Open Messages tab
- `presentTickets()` - Open Tickets tab
- `presentChecklists()` - Open Checklists tab
- `presentConversation(id)` - Open a specific conversation
- `presentArticle(id)` - Open a specific article
- `identify(user, hash?)` - Identify the current user
- `logout()` - Log out and reset

---

## Advanced Setup (Manual Control)

For more control, use individual components:

### 1. Initialize the SDK

```tsx
import { OpencomSDK } from "@opencom/react-native-sdk";

await OpencomSDK.initialize({
  workspaceId: "your-workspace-id",
  convexUrl: "https://your-deployment.convex.cloud",
  debug: true,
});
```

### 2. Identify Users

```tsx
await OpencomSDK.identify({
  userId: "user-123",
  email: "user@example.com",
  name: "Jane Doe",
  customAttributes: { plan: "pro" },
});
```

### 3. Track Events

```tsx
await OpencomSDK.trackEvent("purchase_completed", {
  amount: 99.99,
  currency: "USD",
});
```

### 4. Show Messenger (Manual)

```tsx
import { OpencomProvider, OpencomMessenger, OpencomLauncher } from "@opencom/react-native-sdk";

function App() {
  const [showMessenger, setShowMessenger] = useState(false);

  return (
    <OpencomProvider config={{ workspaceId: "...", convexUrl: "..." }}>
      <YourApp />
      {showMessenger ? (
        <OpencomMessenger onClose={() => setShowMessenger(false)} />
      ) : (
        <OpencomLauncher onPress={() => setShowMessenger(true)} />
      )}
    </OpencomProvider>
  );
}
```

## Components

### OpencomProvider

Wraps your app and provides SDK context.

```tsx
<OpencomProvider config={{ workspaceId: "...", convexUrl: "..." }}>{children}</OpencomProvider>
```

### OpencomLauncher

Floating button to open the messenger.

```tsx
<OpencomLauncher
  onPress={() => setShowMessenger(true)}
  backgroundColor="#0066FF"
  iconColor="#FFFFFF"
  size={60}
/>
```

### OpencomMessenger

Full chat messenger UI.

```tsx
<OpencomMessenger
  onClose={() => setShowMessenger(false)}
  headerTitle="Messages"
  primaryColor="#0066FF"
/>
```

### OpencomHelpCenter

Help center with article search.

```tsx
<OpencomHelpCenter
  onClose={() => setShowHelpCenter(false)}
  onStartConversation={() => {
    setShowHelpCenter(false);
    setShowMessenger(true);
  }}
  headerTitle="Help Center"
  primaryColor="#0066FF"
/>
```

### OpencomHome

Customizable home page with configurable cards. This component is automatically shown when the Home tab is enabled in your workspace settings.

```tsx
import { OpencomHome } from "@opencom/react-native-sdk";

<OpencomHome
  workspaceId="your-workspace-id"
  visitorId={visitorId}
  isIdentified={!!user}
  onStartConversation={() => setActiveTab("messages")}
  onSelectConversation={(id) => navigateToConversation(id)}
  onSelectArticle={(id) => navigateToArticle(id)}
  onSearch={(query) => navigateToSearch(query)}
/>;
```

The Home component displays cards configured in your admin settings:

- **Welcome Header** - Logo, greeting, and team introduction
- **Search Help** - Inline article search with results
- **Recent Conversations** - Last 3 conversations with unread badges
- **Start Conversation** - CTA button to send a message
- **Featured Articles** - Top help center articles
- **Announcements** - Important updates and news

Cards can be configured to show for all users, visitors only, or identified users only.

### OpencomCarousel

Swipeable onboarding/engagement carousel.

```tsx
<OpencomCarousel
  carouselId={carouselId}
  screens={carousel.screens}
  onDismiss={() => setCarousel(null)}
  onComplete={() => setCarousel(null)}
  primaryColor="#0066FF"
/>
```

## Hooks

### useOpencom

Main hook for SDK state and actions.

```tsx
const { isInitialized, visitorState, initialize, identify, trackEvent, logout } = useOpencom();
```

### useConversations

Access conversation list.

```tsx
const { conversations, totalUnread, isLoading } = useConversations();
```

### useConversation

Access single conversation messages.

```tsx
const { messages, isLoading, sendMessage, markAsRead } = useConversation(conversationId);
```

### useArticles

Access help center articles.

```tsx
const { articles, isLoading } = useArticles(workspaceId);
```

### useArticleSearch

Search help center articles.

```tsx
const { results, isLoading } = useArticleSearch(workspaceId, query);
```

## Push Notifications

Push in the React Native SDK supports both integration modes:

1. **Your app already has push notifications**
2. **Your app only uses Opencom push**

In both modes:

- Call `OpencomSDK.initialize(...)` first.
- Register with `OpencomSDK.registerForPush()` (or `usePushNotifications().register()`).
- Registration is a safe no-op when required visitor/session context is missing.

### Ownership and Routing

| Concern                                    | Owned by                                           |
| ------------------------------------------ | -------------------------------------------------- |
| Visitor token registration call            | Opencom SDK → your configured `convexUrl`          |
| Token storage for visitor delivery         | `visitorPushTokens` in your Opencom Convex backend |
| Campaign/support reply routing             | Opencom backend visitor push path                  |
| APNs/FCM credentials used by Expo delivery | The developer's app/project push setup             |

`convexUrl` determines **which Opencom backend** receives token registration and campaign routing metadata.
Push deliverability still depends on the app's own Expo/APNs/FCM project credentials.

### Register with `OpencomSDK` (recommended)

```tsx
import {
  OpencomSDK,
  configurePushNotifications,
  setupNotificationListeners,
} from "@opencom/react-native-sdk";

await OpencomSDK.initialize({
  workspaceId: "your-workspace-id",
  convexUrl: "https://your-deployment.convex.cloud",
});

configurePushNotifications({
  onNotificationReceived: (notification) => {
    console.log("Notification received:", notification);
  },
  onNotificationPressed: (notification) => {
    if (notification.data?.conversationId) {
      navigation.navigate("Chat", { conversationId: notification.data.conversationId });
    }
  },
});

const cleanup = await setupNotificationListeners();
const token = await OpencomSDK.registerForPush();
```

### Register with Hook API

```tsx
import { usePushNotifications } from "@opencom/react-native-sdk";

const { register, unregister, token } = usePushNotifications();

await register();
// later
await unregister();
```

### Unregister

```tsx
await OpencomSDK.unregisterFromPush();
```

Use this when a user disables push or logs out of your app-level push preferences.

## Logout

```tsx
// Clear user data and reset session
await OpencomSDK.logout();
```

## TypeScript

The SDK is fully typed. Import types as needed:

```tsx
import type {
  SDKConfig,
  UserIdentification,
  EventProperties,
  VisitorState,
} from "@opencom/react-native-sdk";
```

## Bare React Native (Non-Expo)

For bare React Native projects without Expo:

1. Install dependencies manually:

```bash
npm install @react-native-async-storage/async-storage
# For push notifications, follow react-native-push-notification setup
```

2. Initialize without the Expo plugin:

```tsx
await OpencomSDK.initialize({
  workspaceId: "your-workspace-id",
  convexUrl: "https://your-deployment.convex.cloud",
});
```

## Requirements

- React Native 0.73+
- Expo SDK 49+ (for Expo projects)
- iOS 15+ / Android API 24+

## Breaking Changes (v0.2.0)

- **React Native**: Minimum version increased from 0.72 to 0.73
- **Android**: Minimum SDK increased from 21 to 24 (Android 7.0+)
- **iOS**: Minimum version increased from 13 to 15
- **Build tooling**: Switched from `tsup` to `react-native-builder-bob` for proper React Native library builds

## License

GNU Affero General Public License v3.0 (AGPL-3.0).
