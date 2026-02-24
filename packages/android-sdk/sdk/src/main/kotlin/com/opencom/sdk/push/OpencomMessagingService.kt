package com.opencom.sdk.push

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.opencom.sdk.Opencom
import com.opencom.sdk.core.Logger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Firebase Messaging Service for handling Opencom push notifications.
 *
 * Add this to your AndroidManifest.xml:
 * ```xml
 * <service
 *     android:name="com.opencom.sdk.push.OpencomMessagingService"
 *     android:exported="false">
 *     <intent-filter>
 *         <action android:name="com.google.firebase.MESSAGING_EVENT" />
 *     </intent-filter>
 * </service>
 * ```
 *
 * Or extend this class in your own service and call super methods.
 */
open class OpencomMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Logger.d("New FCM token received")

        if (Opencom.isReady) {
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    Opencom.registerPushToken(token)
                } catch (e: Exception) {
                    Logger.e("Failed to register push token", e)
                }
            }
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val handled = Opencom.handlePushNotification(remoteMessage.data)
        if (handled) {
            Logger.d("Push notification handled by Opencom")
        }
    }
}
