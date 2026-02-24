package com.opencom.sdk.ui.views

import android.content.Context
import android.util.AttributeSet
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.AbstractComposeView
import com.opencom.sdk.Opencom
import com.opencom.sdk.ui.compose.OpencomLauncher

/**
 * Custom View wrapper for the Opencom launcher button.
 * Use this in XML layouts or programmatically in View-based apps.
 *
 * XML usage:
 * ```xml
 * <com.opencom.sdk.ui.views.OpencomLauncherView
 *     android:id="@+id/opencom_launcher"
 *     android:layout_width="wrap_content"
 *     android:layout_height="wrap_content"
 *     android:layout_gravity="bottom|end"
 *     android:layout_margin="16dp" />
 * ```
 *
 * Programmatic usage:
 * ```kotlin
 * val launcher = OpencomLauncherView(context)
 * launcher.setOnClickListener { /* custom action */ }
 * container.addView(launcher)
 * ```
 */
class OpencomLauncherView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : AbstractComposeView(context, attrs, defStyleAttr) {

    private var customClickListener: (() -> Unit)? = null

    /**
     * Set a custom click listener. If not set, opens the messenger by default.
     */
    fun setOnLauncherClickListener(listener: () -> Unit) {
        customClickListener = listener
    }

    @Composable
    override fun Content() {
        OpencomLauncher(
            onClick = customClickListener ?: { Opencom.present(context) }
        )
    }
}
