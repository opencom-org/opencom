package com.opencom.sdk

import org.junit.Assert.*
import org.junit.Test

class OpencomConfigTest {

    @Test
    fun `config stores workspace ID and Convex URL`() {
        val config = OpencomConfig(
            workspaceId = "test-workspace",
            convexUrl = "https://test.convex.cloud"
        )

        assertEquals("test-workspace", config.workspaceId)
        assertEquals("https://test.convex.cloud", config.convexUrl)
    }

    @Test
    fun `config has default theme`() {
        val config = OpencomConfig(
            workspaceId = "test-workspace",
            convexUrl = "https://test.convex.cloud"
        )

        assertNotNull(config.theme)
    }

    @Test
    fun `config debug defaults to false`() {
        val config = OpencomConfig(
            workspaceId = "test-workspace",
            convexUrl = "https://test.convex.cloud"
        )

        assertFalse(config.debug)
    }

    @Test
    fun `config accepts custom theme`() {
        val customTheme = OpencomTheme(
            messageBubbleRadius = 24f
        )
        val config = OpencomConfig(
            workspaceId = "test-workspace",
            convexUrl = "https://test.convex.cloud",
            theme = customTheme
        )

        assertEquals(24f, config.theme.messageBubbleRadius)
    }
}
