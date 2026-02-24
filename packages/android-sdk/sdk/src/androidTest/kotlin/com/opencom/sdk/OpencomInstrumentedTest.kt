package com.opencom.sdk

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class OpencomInstrumentedTest {

    @Before
    fun setup() {
        Opencom.reset()
    }

    @Test
    fun sdkIsNotReadyBeforeInitialization() {
        assertFalse(Opencom.isReady)
    }

    @Test
    fun visitorIdIsNullBeforeInitialization() {
        assertNull(Opencom.visitorId)
    }

    @Test
    fun themeReturnsDefaultWhenNotInitialized() {
        val theme = Opencom.theme
        assertNotNull(theme)
    }

    @Test
    fun configCreatesValidInstance() {
        val config = OpencomConfig(
            workspaceId = "test-workspace",
            convexUrl = "https://test.convex.cloud"
        )
        assertEquals("test-workspace", config.workspaceId)
        assertEquals("https://test.convex.cloud", config.convexUrl)
    }

    @Test
    fun userRequiresUserIdOrEmail() {
        val user = OpencomUser(userId = "user-123")
        assertEquals("user-123", user.userId)
    }

    @Test
    fun themeFromHexParsesColors() {
        val theme = OpencomTheme.fromHex(primaryColor = "#FF5500")
        assertNotNull(theme.primaryColor)
    }
}
