import XCTest
@testable import OpencomSDK

@MainActor
final class OpencomSDKTests: XCTestCase {

    override func setUp() async throws {
        await Opencom.reset()
    }

    override func tearDown() async throws {
        await Opencom.reset()
    }

    func testOpencomUserInitialization() {
        let user = OpencomUser(
            userId: "user-123",
            email: "test@example.com",
            name: "Test User",
            company: "Test Company",
            customAttributes: ["plan": "pro"]
        )

        XCTAssertEqual(user.userId, "user-123")
        XCTAssertEqual(user.email, "test@example.com")
        XCTAssertEqual(user.name, "Test User")
        XCTAssertEqual(user.company, "Test Company")
        XCTAssertNotNil(user.customAttributes)
    }

    func testOpencomConfigInitialization() {
        let config = OpencomConfig(
            workspaceId: "workspace-123",
            convexUrl: "https://example.convex.cloud",
            debug: true
        )

        XCTAssertEqual(config.workspaceId, "workspace-123")
        XCTAssertEqual(config.convexUrl, "https://example.convex.cloud")
        XCTAssertTrue(config.debug)
    }

    func testOpencomThemeDefaults() {
        let theme = OpencomTheme()

        XCTAssertEqual(theme.messageBubbleRadius, 16)
        XCTAssertEqual(theme.buttonRadius, 8)
    }

    func testOpencomThemeCustomization() {
        let theme = OpencomTheme(
            messageBubbleRadius: 20,
            buttonRadius: 12
        )

        XCTAssertEqual(theme.messageBubbleRadius, 20)
        XCTAssertEqual(theme.buttonRadius, 12)
    }

    func testOpencomErrorDescriptions() {
        XCTAssertNotNil(OpencomError.notInitialized.errorDescription)
        XCTAssertNotNil(OpencomError.noVisitor.errorDescription)
        XCTAssertNotNil(OpencomError.invalidResponse.errorDescription)
        XCTAssertNotNil(OpencomError.invalidWorkspace.errorDescription)
    }

    func testIsReadyBeforeInitialization() async {
        XCTAssertFalse(Opencom.isReady)
    }

    func testVisitorIdBeforeInitialization() async {
        XCTAssertNil(Opencom.visitorId)
    }
}
