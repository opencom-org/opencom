package com.opencom.sdk.push

import com.opencom.sdk.core.Logger
import com.opencom.sdk.core.OpencomAPIClient

internal class PushNotificationManager(
    private val apiClient: OpencomAPIClient
) {
    private var registeredToken: String? = null

    suspend fun registerToken(token: String, visitorId: String) {
        if (token == registeredToken) {
            Logger.d("Token already registered")
            return
        }

        apiClient.registerPushToken(visitorId, token, "android")
        registeredToken = token
        Logger.i("FCM token registered with backend")
    }

    fun handleNotification(data: Map<String, String>): Boolean {
        val source = data["source"] ?: data["opencom_source"]
        if (source != "opencom") {
            return false
        }

        val conversationId = data["conversationId"] ?: data["opencom_conversation_id"]
        val action = data["action"] ?: data["opencom_action"]

        Logger.d("Handling Opencom notification: action=$action, conversationId=$conversationId")

        // Store pending deep link for when app opens
        pendingConversationId = conversationId
        pendingAction = action

        return true
    }

    fun consumePendingDeepLink(): DeepLink? {
        val conversationId = pendingConversationId
        val action = pendingAction

        pendingConversationId = null
        pendingAction = null

        return if (conversationId != null || action != null) {
            DeepLink(conversationId = conversationId, action = action)
        } else {
            null
        }
    }

    data class DeepLink(
        val conversationId: String?,
        val action: String?
    )

    companion object {
        private var pendingConversationId: String? = null
        private var pendingAction: String? = null
    }
}
