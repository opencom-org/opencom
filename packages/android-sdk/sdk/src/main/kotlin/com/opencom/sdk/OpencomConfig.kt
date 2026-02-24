package com.opencom.sdk

/**
 * Configuration for the Opencom SDK.
 *
 * @property workspaceId Your Opencom workspace ID
 * @property convexUrl The Convex backend URL
 * @property theme Optional custom theme for UI components
 * @property debug Enable debug logging (default: false)
 */
data class OpencomConfig(
    val workspaceId: String,
    val convexUrl: String,
    val theme: OpencomTheme = OpencomTheme(),
    val debug: Boolean = false
)
