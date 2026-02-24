import SwiftUI
import UIKit

/// Handles presentation of Opencom UI components.
@MainActor
public final class OpencomPresenter: ObservableObject {
    public static let shared = OpencomPresenter()

    @Published public var isMessengerPresented = false
    @Published public var isHelpCenterPresented = false
    @Published public var presentedCarouselId: String?
    @Published public var presentedConversationId: String?
    @Published public var presentedArticleId: String?

    private var presentingViewController: UIViewController?

    private init() {}

    // MARK: - Messenger

    public func presentMessenger() {
        isMessengerPresented = true
        presentedConversationId = nil
    }

    public func presentConversation(id: String) {
        presentedConversationId = id
        isMessengerPresented = true
    }

    // MARK: - Help Center

    public func presentHelpCenter() {
        isHelpCenterPresented = true
    }

    public func presentArticle(id: String) {
        presentedArticleId = id
        isHelpCenterPresented = true
    }

    // MARK: - Carousel

    public func presentCarousel(id: String) {
        presentedCarouselId = id
    }

    // MARK: - Dismiss

    public func dismiss() {
        isMessengerPresented = false
        isHelpCenterPresented = false
        presentedCarouselId = nil
        presentedConversationId = nil
        presentedArticleId = nil
    }

    // MARK: - UIKit Presentation

    public func present(from viewController: UIViewController) {
        presentingViewController = viewController

        let hostingController = UIHostingController(rootView: OpencomMessengerView())
        hostingController.modalPresentationStyle = .pageSheet

        if let sheet = hostingController.sheetPresentationController {
            sheet.detents = [.large()]
            sheet.prefersGrabberVisible = true
        }

        viewController.present(hostingController, animated: true)
    }

    public func presentHelpCenter(from viewController: UIViewController) {
        presentingViewController = viewController

        let hostingController = UIHostingController(rootView: OpencomHelpCenterView())
        hostingController.modalPresentationStyle = .pageSheet

        if let sheet = hostingController.sheetPresentationController {
            sheet.detents = [.large()]
            sheet.prefersGrabberVisible = true
        }

        viewController.present(hostingController, animated: true)
    }

    public func presentCarousel(id: String, from viewController: UIViewController) {
        presentingViewController = viewController

        let hostingController = UIHostingController(rootView: OpencomCarouselView(carouselId: id))
        hostingController.modalPresentationStyle = .overFullScreen
        hostingController.view.backgroundColor = .clear

        viewController.present(hostingController, animated: true)
    }
}
