package com.opencom.sdk

import androidx.compose.ui.graphics.Color

/**
 * Theme configuration for Opencom UI components.
 * Uses Material 3 color scheme conventions.
 *
 * @property primaryColor Primary brand color
 * @property onPrimaryColor Color for content on primary surfaces
 * @property userMessageColor Background color for user message bubbles
 * @property agentMessageColor Background color for agent message bubbles
 * @property backgroundColor Background color for screens
 * @property surfaceColor Surface color for cards and elevated elements
 * @property textColor Primary text color
 * @property secondaryTextColor Secondary/muted text color
 * @property messageBubbleRadius Corner radius for message bubbles in dp
 * @property buttonRadius Corner radius for buttons in dp
 * @property launcherSize Size of the launcher FAB in dp
 */
data class OpencomTheme(
    val primaryColor: Color = Color(0xFF0066FF),
    val onPrimaryColor: Color = Color.White,
    val userMessageColor: Color = Color(0xFF0066FF),
    val agentMessageColor: Color = Color(0xFFF0F0F0),
    val backgroundColor: Color = Color.White,
    val surfaceColor: Color = Color(0xFFFAFAFA),
    val textColor: Color = Color(0xFF1A1A1A),
    val secondaryTextColor: Color = Color(0xFF666666),
    val messageBubbleRadius: Float = 16f,
    val buttonRadius: Float = 12f,
    val launcherSize: Float = 56f
) {
    companion object {
        /**
         * Create a theme from hex color strings.
         */
        fun fromHex(
            primaryColor: String = "#792cd4",
            onPrimaryColor: String = "#FFFFFF",
            userMessageColor: String? = null,
            agentMessageColor: String = "#F0F0F0",
            backgroundColor: String = "#FFFFFF",
            surfaceColor: String = "#FAFAFA",
            textColor: String = "#1A1A1A",
            secondaryTextColor: String = "#666666"
        ): OpencomTheme {
            val primary = parseHexColor(primaryColor)
            return OpencomTheme(
                primaryColor = primary,
                onPrimaryColor = parseHexColor(onPrimaryColor),
                userMessageColor = userMessageColor?.let { parseHexColor(it) } ?: primary,
                agentMessageColor = parseHexColor(agentMessageColor),
                backgroundColor = parseHexColor(backgroundColor),
                surfaceColor = parseHexColor(surfaceColor),
                textColor = parseHexColor(textColor),
                secondaryTextColor = parseHexColor(secondaryTextColor)
            )
        }

        private fun parseHexColor(hex: String): Color {
            val colorString = hex.removePrefix("#")
            val colorLong = colorString.toLong(16)
            return when (colorString.length) {
                6 -> Color(0xFF000000 or colorLong)
                8 -> Color(colorLong)
                else -> Color(0xFF0066FF)
            }
        }
    }
}
