package com.opencom.sdk

import androidx.compose.ui.graphics.Color
import org.junit.Assert.*
import org.junit.Test

class OpencomThemeTest {

    @Test
    fun `default theme has expected primary color`() {
        val theme = OpencomTheme()
        assertEquals(Color(0xFF0066FF), theme.primaryColor)
    }

    @Test
    fun `default theme has expected bubble radius`() {
        val theme = OpencomTheme()
        assertEquals(16f, theme.messageBubbleRadius)
    }

    @Test
    fun `fromHex creates theme with correct colors`() {
        val theme = OpencomTheme.fromHex(
            primaryColor = "#FF0000"
        )
        assertEquals(Color(0xFFFF0000), theme.primaryColor)
    }

    @Test
    fun `fromHex handles colors without hash`() {
        val theme = OpencomTheme.fromHex(
            primaryColor = "00FF00"
        )
        assertEquals(Color(0xFF00FF00), theme.primaryColor)
    }

    @Test
    fun `custom theme preserves all values`() {
        val theme = OpencomTheme(
            primaryColor = Color.Red,
            messageBubbleRadius = 24f,
            buttonRadius = 8f,
            launcherSize = 64f
        )

        assertEquals(Color.Red, theme.primaryColor)
        assertEquals(24f, theme.messageBubbleRadius)
        assertEquals(8f, theme.buttonRadius)
        assertEquals(64f, theme.launcherSize)
    }
}
