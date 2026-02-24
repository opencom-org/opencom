package com.opencom.sdk

import org.junit.Assert.*
import org.junit.Test

class OpencomErrorTest {

    @Test
    fun `NotInitialized has correct message`() {
        val error = OpencomError.NotInitialized
        assertTrue(error.message!!.contains("not initialized"))
    }

    @Test
    fun `NoVisitor has correct message`() {
        val error = OpencomError.NoVisitor
        assertTrue(error.message!!.contains("visitor"))
    }

    @Test
    fun `InvalidWorkspace has correct message`() {
        val error = OpencomError.InvalidWorkspace
        assertTrue(error.message!!.contains("workspace"))
    }

    @Test
    fun `NetworkError includes cause message`() {
        val cause = Exception("Connection refused")
        val error = OpencomError.NetworkError(cause)
        assertTrue(error.message!!.contains("Connection refused"))
    }

    @Test
    fun `ApiError includes status code`() {
        val error = OpencomError.ApiError(404, "Not found")
        assertTrue(error.message!!.contains("404"))
        assertTrue(error.message!!.contains("Not found"))
    }

    @Test
    fun `ParseError includes cause message`() {
        val cause = Exception("Invalid JSON")
        val error = OpencomError.ParseError(cause)
        assertTrue(error.message!!.contains("Invalid JSON"))
    }
}
