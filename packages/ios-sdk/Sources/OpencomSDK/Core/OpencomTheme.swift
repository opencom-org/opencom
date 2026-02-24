import SwiftUI

/// Theme customization for Opencom UI components.
public struct OpencomTheme {
    /// Primary brand color used for buttons, links, and accents
    public let primaryColor: Color

    /// Background color for the messenger
    public let backgroundColor: Color

    /// Secondary background color for cards and inputs
    public let secondaryBackgroundColor: Color

    /// Primary text color
    public let textColor: Color

    /// Secondary text color for subtitles and metadata
    public let secondaryTextColor: Color

    /// Color for user message bubbles
    public let userMessageColor: Color

    /// Color for agent message bubbles
    public let agentMessageColor: Color

    /// Text color for user message bubbles
    public let userMessageTextColor: Color

    /// Text color for agent message bubbles
    public let agentMessageTextColor: Color

    /// Corner radius for message bubbles
    public let messageBubbleRadius: CGFloat

    /// Corner radius for buttons
    public let buttonRadius: CGFloat

    /// Font for body text
    public let bodyFont: Font

    /// Font for headings
    public let headingFont: Font

    /// Font for captions and metadata
    public let captionFont: Font

    public init(
        primaryColor: Color = .purple,
        backgroundColor: Color = Color(.systemBackground),
        secondaryBackgroundColor: Color = Color(.secondarySystemBackground),
        textColor: Color = Color(.label),
        secondaryTextColor: Color = Color(.secondaryLabel),
        userMessageColor: Color = .purple,
        agentMessageColor: Color = Color(.systemGray5),
        userMessageTextColor: Color = .white,
        agentMessageTextColor: Color = Color(.label),
        messageBubbleRadius: CGFloat = 16,
        buttonRadius: CGFloat = 8,
        bodyFont: Font = .body,
        headingFont: Font = .headline,
        captionFont: Font = .caption
    ) {
        self.primaryColor = primaryColor
        self.backgroundColor = backgroundColor
        self.secondaryBackgroundColor = secondaryBackgroundColor
        self.textColor = textColor
        self.secondaryTextColor = secondaryTextColor
        self.userMessageColor = userMessageColor
        self.agentMessageColor = agentMessageColor
        self.userMessageTextColor = userMessageTextColor
        self.agentMessageTextColor = agentMessageTextColor
        self.messageBubbleRadius = messageBubbleRadius
        self.buttonRadius = buttonRadius
        self.bodyFont = bodyFont
        self.headingFont = headingFont
        self.captionFont = captionFont
    }
}
