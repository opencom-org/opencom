import UIKit
import SwiftUI

/// UIKit view controller for presenting the Opencom messenger.
/// Use this in UIKit-based apps to present the messenger UI.
public final class OpencomViewController: UIViewController {

    private var hostingController: UIHostingController<OpencomMessengerView>?

    public override func viewDidLoad() {
        super.viewDidLoad()

        let messengerView = OpencomMessengerView()
        let hostingController = UIHostingController(rootView: messengerView)
        self.hostingController = hostingController

        addChild(hostingController)
        view.addSubview(hostingController.view)
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            hostingController.view.topAnchor.constraint(equalTo: view.topAnchor),
            hostingController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        hostingController.didMove(toParent: self)
    }
}

/// UIKit view controller for the floating launcher button.
/// Add this as a child view controller to show the launcher in UIKit apps.
public final class OpencomLauncherViewController: UIViewController {

    private var hostingController: UIHostingController<OpencomLauncher>?

    /// The size of the launcher button
    public var launcherSize: CGFloat = 56 {
        didSet {
            updateLauncher()
        }
    }

    /// Padding from screen edges
    public var launcherPadding: UIEdgeInsets = UIEdgeInsets(top: 0, left: 0, bottom: 16, right: 16) {
        didSet {
            updateLauncher()
        }
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        setupLauncher()
    }

    private func setupLauncher() {
        let launcher = OpencomLauncher(
            size: launcherSize,
            padding: EdgeInsets(
                top: launcherPadding.top,
                leading: launcherPadding.left,
                bottom: launcherPadding.bottom,
                trailing: launcherPadding.right
            )
        )

        let hostingController = UIHostingController(rootView: launcher)
        hostingController.view.backgroundColor = .clear
        self.hostingController = hostingController

        addChild(hostingController)
        view.addSubview(hostingController.view)
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            hostingController.view.topAnchor.constraint(equalTo: view.topAnchor),
            hostingController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        hostingController.didMove(toParent: self)
    }

    private func updateLauncher() {
        hostingController?.willMove(toParent: nil)
        hostingController?.view.removeFromSuperview()
        hostingController?.removeFromParent()
        setupLauncher()
    }
}

/// UIKit view controller for the help center.
public final class OpencomHelpCenterViewController: UIViewController {

    private var hostingController: UIHostingController<OpencomHelpCenterView>?

    public override func viewDidLoad() {
        super.viewDidLoad()

        let helpCenterView = OpencomHelpCenterView()
        let hostingController = UIHostingController(rootView: helpCenterView)
        self.hostingController = hostingController

        addChild(hostingController)
        view.addSubview(hostingController.view)
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            hostingController.view.topAnchor.constraint(equalTo: view.topAnchor),
            hostingController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        hostingController.didMove(toParent: self)
    }
}

/// UIKit view controller for carousels.
public final class OpencomCarouselViewController: UIViewController {

    private let carouselId: String
    private var hostingController: UIHostingController<OpencomCarouselView>?

    public init(carouselId: String) {
        self.carouselId = carouselId
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .overFullScreen
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear

        let carouselView = OpencomCarouselView(carouselId: carouselId)
        let hostingController = UIHostingController(rootView: carouselView)
        hostingController.view.backgroundColor = .clear
        self.hostingController = hostingController

        addChild(hostingController)
        view.addSubview(hostingController.view)
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            hostingController.view.topAnchor.constraint(equalTo: view.topAnchor),
            hostingController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        hostingController.didMove(toParent: self)
    }
}

// MARK: - UIKit Presentation Extensions

public extension Opencom {
    /// Present the messenger from a UIKit view controller.
    /// - Parameter viewController: The presenting view controller
    static func present(from viewController: UIViewController) {
        OpencomPresenter.shared.present(from: viewController)
    }

    /// Present the help center from a UIKit view controller.
    /// - Parameter viewController: The presenting view controller
    static func presentHelpCenter(from viewController: UIViewController) {
        OpencomPresenter.shared.presentHelpCenter(from: viewController)
    }

    /// Present a carousel from a UIKit view controller.
    /// - Parameters:
    ///   - id: The carousel ID
    ///   - viewController: The presenting view controller
    static func presentCarousel(id: String, from viewController: UIViewController) {
        OpencomPresenter.shared.presentCarousel(id: id, from: viewController)
    }
}
