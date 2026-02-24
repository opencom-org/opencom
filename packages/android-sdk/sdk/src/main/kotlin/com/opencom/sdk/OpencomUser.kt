package com.opencom.sdk

/**
 * User identification data for Opencom.
 *
 * @property userId Unique identifier for the user in your system
 * @property email User's email address
 * @property name User's display name
 * @property company User's company name
 * @property customAttributes Additional custom attributes for segmentation
 */
data class OpencomUser(
    val userId: String? = null,
    val email: String? = null,
    val name: String? = null,
    val company: String? = null,
    val customAttributes: Map<String, Any> = emptyMap()
) {
    init {
        require(userId != null || email != null) {
            "Either userId or email must be provided"
        }
    }
}
