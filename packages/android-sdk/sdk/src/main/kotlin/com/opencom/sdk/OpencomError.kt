package com.opencom.sdk

/**
 * Errors that can occur when using the Opencom SDK.
 */
sealed class OpencomError : Exception() {

    /**
     * SDK has not been initialized. Call Opencom.initialize() first.
     */
    data object NotInitialized : OpencomError() {
        private fun readResolve(): Any = NotInitialized
        override val message: String = "SDK not initialized. Call Opencom.initialize() first."
    }

    /**
     * No visitor session is available.
     */
    data object NoVisitor : OpencomError() {
        private fun readResolve(): Any = NoVisitor
        override val message: String = "No visitor session available."
    }

    /**
     * Invalid workspace ID provided.
     */
    data object InvalidWorkspace : OpencomError() {
        private fun readResolve(): Any = InvalidWorkspace
        override val message: String = "Invalid workspace ID."
    }

    /**
     * Network request failed.
     */
    data class NetworkError(override val cause: Throwable?) : OpencomError() {
        override val message: String = "Network request failed: ${cause?.message}"
    }

    /**
     * API returned an error response.
     */
    data class ApiError(val statusCode: Int, val errorMessage: String?) : OpencomError() {
        override val message: String = "API error ($statusCode): ${errorMessage ?: "Unknown error"}"
    }

    /**
     * Failed to parse API response.
     */
    data class ParseError(override val cause: Throwable?) : OpencomError() {
        override val message: String = "Failed to parse response: ${cause?.message}"
    }
}
