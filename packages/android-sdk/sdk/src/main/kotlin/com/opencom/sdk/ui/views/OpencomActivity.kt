package com.opencom.sdk.ui.views

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.opencom.sdk.Opencom
import com.opencom.sdk.ui.compose.OpencomCarousel
import com.opencom.sdk.ui.compose.OpencomHelpCenter
import com.opencom.sdk.ui.compose.OpencomMessenger

/**
 * Activity wrapper for Opencom UI screens.
 * Use this for View-based apps or when launching from an Intent.
 *
 * Launch with:
 * ```kotlin
 * val intent = Intent(context, OpencomActivity::class.java).apply {
 *     putExtra(OpencomActivity.EXTRA_SCREEN, OpencomActivity.SCREEN_MESSENGER)
 * }
 * startActivity(intent)
 * ```
 */
class OpencomActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val screen = intent.getStringExtra(EXTRA_SCREEN) ?: SCREEN_MESSENGER
        val carouselId = intent.getStringExtra(EXTRA_CAROUSEL_ID)
        val conversationId = intent.getStringExtra(EXTRA_CONVERSATION_ID)

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Opencom.theme.backgroundColor
                ) {
                    when (screen) {
                        SCREEN_MESSENGER -> {
                            OpencomMessenger(
                                onClose = { finish() }
                            )
                        }
                        SCREEN_HELP_CENTER -> {
                            OpencomHelpCenter(
                                onClose = { finish() },
                                onStartConversation = {
                                    // Switch to messenger
                                    intent.putExtra(EXTRA_SCREEN, SCREEN_MESSENGER)
                                    recreate()
                                }
                            )
                        }
                        SCREEN_CAROUSEL -> {
                            if (carouselId != null) {
                                OpencomCarousel(
                                    carouselId = carouselId,
                                    onDismiss = { finish() },
                                    onComplete = { finish() }
                                )
                            } else {
                                finish()
                            }
                        }
                        else -> {
                            OpencomMessenger(
                                onClose = { finish() }
                            )
                        }
                    }
                }
            }
        }
    }

    companion object {
        const val EXTRA_SCREEN = "opencom_screen"
        const val EXTRA_CAROUSEL_ID = "opencom_carousel_id"
        const val EXTRA_CONVERSATION_ID = "opencom_conversation_id"

        const val SCREEN_MESSENGER = "messenger"
        const val SCREEN_HELP_CENTER = "help_center"
        const val SCREEN_CAROUSEL = "carousel"
    }
}
