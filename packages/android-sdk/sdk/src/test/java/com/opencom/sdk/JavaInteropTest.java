package com.opencom.sdk;

import org.junit.Test;
import static org.junit.Assert.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Tests to verify Java interoperability with the Kotlin SDK.
 */
public class JavaInteropTest {

    @Test
    public void configCanBeCreatedFromJava() {
        OpencomConfig config = new OpencomConfig(
            "test-workspace",
            "https://test.convex.cloud",
            new OpencomTheme(),
            false
        );

        assertEquals("test-workspace", config.getWorkspaceId());
        assertEquals("https://test.convex.cloud", config.getConvexUrl());
        assertFalse(config.getDebug());
    }

    @Test
    public void userCanBeCreatedFromJava() {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("plan", "pro");
        attributes.put("signupDate", "2024-01-15");

        OpencomUser user = new OpencomUser(
            "user-123",
            "test@example.com",
            "Test User",
            "Acme Inc",
            attributes
        );

        assertEquals("user-123", user.getUserId());
        assertEquals("test@example.com", user.getEmail());
        assertEquals("Test User", user.getName());
        assertEquals("Acme Inc", user.getCompany());
        assertEquals("pro", user.getCustomAttributes().get("plan"));
    }

    @Test
    public void userWithOnlyUserIdIsValid() {
        OpencomUser user = new OpencomUser(
            "user-123",
            null,
            null,
            null,
            new HashMap<>()
        );

        assertEquals("user-123", user.getUserId());
        assertNull(user.getEmail());
    }

    @Test
    public void userWithOnlyEmailIsValid() {
        OpencomUser user = new OpencomUser(
            null,
            "test@example.com",
            null,
            null,
            new HashMap<>()
        );

        assertNull(user.getUserId());
        assertEquals("test@example.com", user.getEmail());
    }

    @Test
    public void themeCanBeCreatedFromJava() {
        OpencomTheme theme = new OpencomTheme();

        assertNotNull(theme.getPrimaryColor());
        assertEquals(16f, theme.getMessageBubbleRadius(), 0.01f);
        assertEquals(12f, theme.getButtonRadius(), 0.01f);
        assertEquals(56f, theme.getLauncherSize(), 0.01f);
    }

    @Test
    public void opencomSingletonIsAccessible() {
        assertNotNull(Opencom.INSTANCE);
        assertFalse(Opencom.INSTANCE.isReady());
    }

    @Test
    public void visitorIdIsNullBeforeInit() {
        assertNull(Opencom.INSTANCE.getVisitorId());
    }

    @Test
    public void themeReturnsDefaultBeforeInit() {
        OpencomTheme theme = Opencom.INSTANCE.getTheme();
        assertNotNull(theme);
    }
}
