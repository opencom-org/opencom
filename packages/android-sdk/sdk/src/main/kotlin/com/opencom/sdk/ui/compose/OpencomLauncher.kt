package com.opencom.sdk.ui.compose

import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.opencom.sdk.Opencom

/**
 * Floating action button that opens the Opencom messenger.
 *
 * @param modifier Modifier for the FAB
 * @param onClick Optional custom click handler. If null, opens the messenger.
 */
@Composable
fun OpencomLauncher(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null
) {
    val context = LocalContext.current
    val theme = Opencom.theme

    FloatingActionButton(
        onClick = { onClick?.invoke() ?: Opencom.present(context) },
        modifier = modifier.size(theme.launcherSize.dp),
        shape = CircleShape,
        containerColor = theme.primaryColor,
        contentColor = theme.onPrimaryColor
    ) {
        Icon(
            imageVector = Icons.Default.Chat,
            contentDescription = "Open chat"
        )
    }
}
