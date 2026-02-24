import SwiftUI

/// A floating launcher button that opens the Opencom messenger.
/// Add this to your app's view hierarchy to provide easy access to support.
public struct OpencomLauncher: View {
    @StateObject private var presenter = OpencomPresenter.shared

    private let size: CGFloat
    private let padding: EdgeInsets

    /// Create a launcher button.
    /// - Parameters:
    ///   - size: The size of the button (default: 56)
    ///   - padding: Padding from screen edges (default: 16 on all sides)
    public init(
        size: CGFloat = 56,
        padding: EdgeInsets = EdgeInsets(top: 0, leading: 0, bottom: 16, trailing: 16)
    ) {
        self.size = size
        self.padding = padding
    }

    public var body: some View {
        VStack {
            Spacer()
            HStack {
                Spacer()
                Button(action: {
                    Opencom.present()
                }) {
                    ZStack {
                        Circle()
                            .fill(Opencom.theme.primaryColor)
                            .frame(width: size, height: size)
                            .shadow(color: .black.opacity(0.2), radius: 4, x: 0, y: 2)

                        Image(systemName: "message.fill")
                            .font(.system(size: size * 0.4))
                            .foregroundColor(.white)
                    }
                }
                .padding(padding)
            }
        }
        .sheet(isPresented: $presenter.isMessengerPresented) {
            OpencomMessengerView()
        }
        .sheet(isPresented: $presenter.isHelpCenterPresented) {
            OpencomHelpCenterView()
        }
        .fullScreenCover(item: Binding(
            get: { presenter.presentedCarouselId.map { CarouselPresentation(id: $0) } },
            set: { presenter.presentedCarouselId = $0?.id }
        )) { presentation in
            OpencomCarouselView(carouselId: presentation.id)
        }
    }
}

private struct CarouselPresentation: Identifiable {
    let id: String
}

#Preview {
    ZStack {
        Color.gray.opacity(0.1)
            .ignoresSafeArea()

        Text("Your App Content")

        OpencomLauncher()
    }
}
