# Opencom Android SDK

Native Android SDK for integrating Opencom customer messaging into Kotlin/Java apps.

## Requirements

- Android API 21+ (Android 5.0 Lollipop)
- Kotlin 1.9+
- Jetpack Compose 1.5+ (for Compose components)

## Installation

### Gradle (Kotlin DSL)

```kotlin
// build.gradle.kts
dependencies {
    implementation("com.opencom:sdk:1.0.0")
}
```

### Gradle (Groovy)

```groovy
// build.gradle
dependencies {
    implementation 'com.opencom:sdk:1.0.0'
}
```

## Quick Start

### 1. Initialize the SDK

Initialize Opencom when your app starts, typically in your `Application` class:

```kotlin
import com.opencom.sdk.Opencom
import com.opencom.sdk.OpencomConfig

class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()

        lifecycleScope.launch {
            Opencom.initialize(
                context = this@MyApp,
                config = OpencomConfig(
                    workspaceId = "your-workspace-id",
                    convexUrl = "https://your-deployment.convex.cloud",
                    debug = true // Enable debug logging
                )
            )
        }
    }
}
```

### 2. Add the Launcher Button (Jetpack Compose)

```kotlin
import com.opencom.sdk.ui.compose.OpencomLauncher

@Composable
fun MainScreen() {
    Box(modifier = Modifier.fillMaxSize()) {
        // Your app content
        MainContent()

        // Floating launcher button
        OpencomLauncher(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp)
        )
    }
}
```

### 3. Identify Users

When a user logs in, identify them to personalize their experience:

```kotlin
Opencom.identify(
    OpencomUser(
        userId = "user-123",
        email = "user@example.com",
        name = "Jane Doe",
        company = "Acme Inc",
        customAttributes = mapOf("plan" to "pro", "signupDate" to "2024-01-15")
    )
)
```

## Features

### Present Messenger Programmatically

```kotlin
// Open messenger
Opencom.present(context)

// Or use the alias
Opencom.presentMessenger(context)
```

### Help Center

```kotlin
// Open help center
Opencom.presentHelpCenter(context)
```

### Carousels

```kotlin
// Present a specific carousel
Opencom.presentCarousel(context, carouselId = "carousel-id")
```

### Event Tracking

```kotlin
// Track custom events
Opencom.trackEvent("purchase_completed", mapOf(
    "amount" to 99.99,
    "currency" to "USD",
    "productId" to "prod-123"
))
```

### Logout

```kotlin
// Clear user session
Opencom.logout()
```

## Jetpack Compose Components

### OpencomLauncher

Floating action button that opens the messenger:

```kotlin
OpencomLauncher(
    modifier = Modifier.align(Alignment.BottomEnd),
    onClick = { /* optional custom handler */ }
)
```

### OpencomMessenger

Full messenger UI:

```kotlin
var showMessenger by remember { mutableStateOf(false) }

if (showMessenger) {
    OpencomMessenger(
        onClose = { showMessenger = false }
    )
}
```

### OpencomHelpCenter

Help center with article search:

```kotlin
OpencomHelpCenter(
    onClose = { /* handle close */ },
    onStartConversation = { /* switch to messenger */ }
)
```

### OpencomCarousel

Swipeable onboarding carousel:

```kotlin
OpencomCarousel(
    carouselId = "onboarding-carousel",
    onDismiss = { /* handle dismiss */ },
    onComplete = { /* handle completion */ }
)
```

## View-based Support

For View-based apps, use the provided Activity, Fragment, or custom View:

### OpencomActivity

```kotlin
// Launch messenger
val intent = Intent(context, OpencomActivity::class.java).apply {
    putExtra(OpencomActivity.EXTRA_SCREEN, OpencomActivity.SCREEN_MESSENGER)
}
startActivity(intent)

// Launch help center
val intent = Intent(context, OpencomActivity::class.java).apply {
    putExtra(OpencomActivity.EXTRA_SCREEN, OpencomActivity.SCREEN_HELP_CENTER)
}
startActivity(intent)
```

### OpencomFragment

```kotlin
val fragment = OpencomFragment.newInstance(OpencomFragment.SCREEN_MESSENGER)
supportFragmentManager.beginTransaction()
    .replace(R.id.container, fragment)
    .addToBackStack(null)
    .commit()
```

### OpencomLauncherView (XML)

```xml
<com.opencom.sdk.ui.views.OpencomLauncherView
    android:id="@+id/opencom_launcher"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:layout_gravity="bottom|end"
    android:layout_margin="16dp" />
```

## Push Notifications (FCM)

### 1. Add Firebase Messaging

```kotlin
// build.gradle.kts
dependencies {
    implementation("com.google.firebase:firebase-messaging-ktx:23.4.1")
}
```

### 2. Register Token

In your `FirebaseMessagingService`:

```kotlin
class MyMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        if (Opencom.isReady) {
            lifecycleScope.launch {
                Opencom.registerPushToken(token)
            }
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        val handled = Opencom.handlePushNotification(remoteMessage.data)
        if (!handled) {
            // Handle non-Opencom notifications
        }
    }
}
```

Or use the built-in service:

```xml
<service
    android:name="com.opencom.sdk.push.OpencomMessagingService"
    android:exported="false">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>
```

## Theming

Customize the SDK appearance:

```kotlin
val theme = OpencomTheme(
    primaryColor = Color(0xFF6200EE),
    userMessageColor = Color(0xFF6200EE),
    messageBubbleRadius = 20f,
    buttonRadius = 12f
)

Opencom.initialize(
    context = this,
    config = OpencomConfig(
        workspaceId = "your-workspace-id",
        convexUrl = "https://your-deployment.convex.cloud",
        theme = theme
    )
)
```

Or from hex colors:

```kotlin
val theme = OpencomTheme.fromHex(
    primaryColor = "#6200EE",
    userMessageColor = "#6200EE"
)
```

## Debug Mode

Enable debug logging during development:

```kotlin
OpencomConfig(
    workspaceId = "your-workspace-id",
    convexUrl = "https://your-deployment.convex.cloud",
    debug = true
)
```

## Java Interop

The SDK is fully compatible with Java:

```java
// Initialize
Opencom.INSTANCE.initialize(context, config);

// Identify user
OpencomUser user = new OpencomUser(
    "user-123",
    "user@example.com",
    "Jane Doe",
    null,
    Collections.emptyMap()
);
Opencom.INSTANCE.identify(user);

// Present messenger
Opencom.INSTANCE.present(context);
```

## License

GNU Affero General Public License v3.0 (AGPL-3.0).
