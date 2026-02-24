import Foundation

/// Configuration for the Opencom SDK.
public struct OpencomConfig {
    /// The workspace ID for your Opencom account
    public let workspaceId: String

    /// The Convex backend URL
    public let convexUrl: String

    /// Theme customization for UI components
    public let theme: OpencomTheme

    /// Enable debug logging
    public let debug: Bool

    public init(
        workspaceId: String,
        convexUrl: String,
        theme: OpencomTheme = OpencomTheme(),
        debug: Bool = false
    ) {
        self.workspaceId = workspaceId
        self.convexUrl = convexUrl
        self.theme = theme
        self.debug = debug
    }
}
