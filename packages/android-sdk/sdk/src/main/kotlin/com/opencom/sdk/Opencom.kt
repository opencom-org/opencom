package com.opencom.sdk

import android.content.Context
import android.content.Intent
import com.opencom.sdk.core.Logger
import com.opencom.sdk.core.OpencomAPIClient
import com.opencom.sdk.core.SessionManager
import com.opencom.sdk.push.PushNotificationManager
import com.opencom.sdk.ui.views.OpencomActivity
import kotlinx.coroutines.*
import java.util.Timer
import java.util.TimerTask

/**
 * Main entry point for the Opencom Android SDK.
 * Use this object to initialize the SDK, identify users, track events, and present UI.
 */
object Opencom {

    private var isInitialized = false
    private var config: OpencomConfig? = null
    private var apiClient: OpencomAPIClient? = null
    private var sessionManager: SessionManager? = null
    private var pushManager: PushNotificationManager? = null
    private var applicationContext: Context? = null
    private var heartbeatTimer: Timer? = null

    private const val HEARTBEAT_INTERVAL_MS = 30_000L

    /**
     * Initialize the SDK with workspace credentials.
     * Call this once when your app starts, typically in your Application class.
     *
     * @param context Application context
     * @param config SDK configuration including workspace ID and Convex URL
     * @throws OpencomError.InvalidWorkspace if the workspace ID is invalid
     */
    suspend fun initialize(context: Context, config: OpencomConfig) {
        if (isInitialized) {
            Logger.w("SDK already initialized")
            return
        }

        this.applicationContext = context.applicationContext
        this.config = config
        Logger.isDebugEnabled = config.debug

        val apiClient = OpencomAPIClient(config)
        this.apiClient = apiClient

        val sessionManager = SessionManager(context.applicationContext, apiClient, config)
        this.sessionManager = sessionManager

        val pushManager = PushNotificationManager(apiClient)
        this.pushManager = pushManager

        sessionManager.initializeSession()

        startHeartbeat()

        isInitialized = true
        Logger.i("SDK initialized successfully")
    }

    /**
     * Identify the current user with their attributes.
     * Call this when a user logs in or when you have user information.
     *
     * @param user User identification data including email, name, and custom attributes
     * @throws OpencomError.NotInitialized if SDK is not initialized
     */
    suspend fun identify(user: OpencomUser) {
        ensureInitialized()
        sessionManager?.identify(user)
        Logger.i("User identified: ${user.userId ?: user.email ?: "anonymous"}")
    }

    /**
     * Get the current session token (for advanced use cases).
     */
    val sessionToken: String?
        get() = sessionManager?.sessionToken

    /**
     * Track a custom event for analytics and targeting.
     *
     * @param name Event name (e.g., "purchase_completed")
     * @param properties Optional map of event properties
     * @throws OpencomError.NotInitialized if SDK is not initialized
     */
    suspend fun trackEvent(name: String, properties: Map<String, Any>? = null) {
        ensureInitialized()
        val visitorId = sessionManager?.visitorId ?: throw OpencomError.NoVisitor
        val sessionId = sessionManager?.sessionId ?: throw OpencomError.NoVisitor
        val token = sessionManager?.sessionToken

        apiClient?.trackEvent(visitorId, token, name, properties, sessionId)
        Logger.i("Event tracked: $name")
    }

    /**
     * Log out the current user and reset the session.
     * A new anonymous visitor will be created.
     *
     * @throws OpencomError.NotInitialized if SDK is not initialized
     */
    suspend fun logout() {
        ensureInitialized()
        stopHeartbeat()
        sessionManager?.logout()
        startHeartbeat()
        Logger.i("User logged out")
    }

    /**
     * Present the messenger UI.
     * Shows the conversation list or active conversation.
     *
     * @param context Activity context to launch from
     */
    fun present(context: Context) {
        presentMessenger(context)
    }

    /**
     * Present the messenger UI (alias for present()).
     *
     * @param context Activity context to launch from
     */
    fun presentMessenger(context: Context) {
        if (!isInitialized) {
            Logger.e("SDK not initialized. Call initialize() first.")
            return
        }

        val intent = Intent(context, OpencomActivity::class.java).apply {
            putExtra(OpencomActivity.EXTRA_SCREEN, OpencomActivity.SCREEN_MESSENGER)
        }
        context.startActivity(intent)
    }

    /**
     * Present the help center UI.
     *
     * @param context Activity context to launch from
     */
    fun presentHelpCenter(context: Context) {
        if (!isInitialized) {
            Logger.e("SDK not initialized. Call initialize() first.")
            return
        }

        val intent = Intent(context, OpencomActivity::class.java).apply {
            putExtra(OpencomActivity.EXTRA_SCREEN, OpencomActivity.SCREEN_HELP_CENTER)
        }
        context.startActivity(intent)
    }

    /**
     * Present a specific carousel by ID.
     *
     * @param context Activity context to launch from
     * @param carouselId The carousel ID to display
     */
    fun presentCarousel(context: Context, carouselId: String) {
        if (!isInitialized) {
            Logger.e("SDK not initialized. Call initialize() first.")
            return
        }

        val intent = Intent(context, OpencomActivity::class.java).apply {
            putExtra(OpencomActivity.EXTRA_SCREEN, OpencomActivity.SCREEN_CAROUSEL)
            putExtra(OpencomActivity.EXTRA_CAROUSEL_ID, carouselId)
        }
        context.startActivity(intent)
    }

    /**
     * Handle a received push notification.
     * Call this from your FirebaseMessagingService.
     *
     * @param data The notification data payload
     * @return true if the notification was handled by Opencom, false otherwise
     */
    fun handlePushNotification(data: Map<String, String>): Boolean {
        if (!isInitialized) {
            return false
        }

        return pushManager?.handleNotification(data) ?: false
    }

    /**
     * Register an FCM token with the backend.
     * Call this when you receive a new token in onNewToken.
     *
     * @param token The FCM device token
     * @throws OpencomError.NotInitialized if SDK is not initialized
     */
    suspend fun registerPushToken(token: String) {
        ensureInitialized()
        val visitorId = sessionManager?.visitorId ?: throw OpencomError.NoVisitor
        pushManager?.registerToken(token, visitorId)
        Logger.i("Push token registered")
    }

    /**
     * Check if the SDK is initialized.
     */
    val isReady: Boolean
        get() = isInitialized

    /**
     * Get the current visitor ID.
     */
    val visitorId: String?
        get() = sessionManager?.visitorId

    /**
     * Get the current theme.
     */
    val theme: OpencomTheme
        get() = config?.theme ?: OpencomTheme()

    // Internal accessors for UI components
    internal val apiClientInternal: OpencomAPIClient?
        get() = apiClient

    internal val sessionManagerInternal: SessionManager?
        get() = sessionManager

    internal val configInternal: OpencomConfig?
        get() = config

    internal val contextInternal: Context?
        get() = applicationContext

    private fun ensureInitialized() {
        if (!isInitialized) {
            throw OpencomError.NotInitialized
        }
    }

    private fun startHeartbeat() {
        stopHeartbeat()

        heartbeatTimer = Timer().apply {
            scheduleAtFixedRate(object : TimerTask() {
                override fun run() {
                    CoroutineScope(Dispatchers.IO).launch {
                        sendHeartbeat()
                    }
                }
            }, 0, HEARTBEAT_INTERVAL_MS)
        }
    }

    private fun stopHeartbeat() {
        heartbeatTimer?.cancel()
        heartbeatTimer = null
    }

    private suspend fun sendHeartbeat() {
        val visitorId = sessionManager?.visitorId ?: return
        val token = sessionManager?.sessionToken
        try {
            apiClient?.heartbeat(visitorId, token)
        } catch (e: Exception) {
            Logger.w("Heartbeat failed", e)
        }
    }

    /**
     * Reset the SDK state. For testing purposes only.
     */
    fun reset() {
        stopHeartbeat()
        sessionManager?.reset()
        apiClient = null
        sessionManager = null
        pushManager = null
        config = null
        applicationContext = null
        isInitialized = false
    }
}
