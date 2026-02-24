package com.opencom.sdk

import org.junit.Assert.*
import org.junit.Test

class OpencomUserTest {

    @Test
    fun `user with userId is valid`() {
        val user = OpencomUser(userId = "user-123")
        assertEquals("user-123", user.userId)
    }

    @Test
    fun `user with email is valid`() {
        val user = OpencomUser(email = "test@example.com")
        assertEquals("test@example.com", user.email)
    }

    @Test
    fun `user with both userId and email is valid`() {
        val user = OpencomUser(
            userId = "user-123",
            email = "test@example.com"
        )
        assertEquals("user-123", user.userId)
        assertEquals("test@example.com", user.email)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `user without userId or email throws exception`() {
        OpencomUser(name = "Test User")
    }

    @Test
    fun `user accepts custom attributes`() {
        val user = OpencomUser(
            userId = "user-123",
            customAttributes = mapOf(
                "plan" to "pro",
                "signupDate" to "2024-01-15"
            )
        )

        assertEquals("pro", user.customAttributes["plan"])
        assertEquals("2024-01-15", user.customAttributes["signupDate"])
    }

    @Test
    fun `user custom attributes default to empty map`() {
        val user = OpencomUser(userId = "user-123")
        assertTrue(user.customAttributes.isEmpty())
    }
}
