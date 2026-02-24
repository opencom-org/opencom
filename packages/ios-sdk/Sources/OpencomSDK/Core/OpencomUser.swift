import Foundation

/// User identification data for the Opencom SDK.
public struct OpencomUser {
    /// Unique identifier for the user in your system
    public let userId: String?

    /// User's email address
    public let email: String?

    /// User's display name
    public let name: String?

    /// User's company name
    public let company: String?

    /// Custom attributes for segmentation and personalization
    public let customAttributes: [String: Any]?

    public init(
        userId: String? = nil,
        email: String? = nil,
        name: String? = nil,
        company: String? = nil,
        customAttributes: [String: Any]? = nil
    ) {
        self.userId = userId
        self.email = email
        self.name = name
        self.company = company
        self.customAttributes = customAttributes
    }
}
