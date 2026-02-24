import SwiftUI

/// A swipeable carousel view for onboarding and engagement content.
public struct OpencomCarousel: View {
    let carouselId: String
    @StateObject private var viewModel = CarouselViewModel()
    @Environment(\.dismiss) private var dismiss

    public init(carouselId: String) {
        self.carouselId = carouselId
    }

    public var body: some View {
        ZStack {
            Color.black.opacity(0.5)
                .ignoresSafeArea()
                .onTapGesture {
                    dismissCarousel()
                }

            if viewModel.isLoading {
                ProgressView()
                    .tint(.white)
            } else if let carousel = viewModel.carousel {
                CarouselContent(
                    carousel: carousel,
                    currentIndex: $viewModel.currentIndex,
                    onDismiss: dismissCarousel,
                    onButtonTap: { button in
                        handleButtonTap(button)
                    }
                )
            } else if viewModel.error != nil {
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 48))
                        .foregroundColor(.white)

                    Text("Failed to load content")
                        .foregroundColor(.white)

                    Button("Dismiss") {
                        dismissCarousel()
                    }
                    .foregroundColor(.white)
                }
            }
        }
        .task {
            await viewModel.loadCarousel(id: carouselId)
        }
    }

    private func dismissCarousel() {
        Task {
            await viewModel.trackInteraction(action: "dismissed")
        }
        dismiss()
    }

    private func handleButtonTap(_ button: CarouselButton) {
        Task {
            await viewModel.trackInteraction(action: "button_tapped")
        }

        switch button.action {
        case "dismiss":
            dismiss()
        case "next":
            viewModel.nextScreen()
        case "url":
            if let urlString = button.url, let url = URL(string: urlString) {
                UIApplication.shared.open(url)
            }
        case "deeplink":
            if let deepLink = button.deepLink, let url = URL(string: deepLink) {
                UIApplication.shared.open(url)
            }
        default:
            break
        }
    }
}

/// Internal carousel view used by the presenter.
struct OpencomCarouselView: View {
    let carouselId: String

    var body: some View {
        OpencomCarousel(carouselId: carouselId)
    }
}

// MARK: - View Model

@MainActor
private final class CarouselViewModel: ObservableObject {
    @Published var carousel: CarouselData?
    @Published var currentIndex = 0
    @Published var isLoading = false
    @Published var error: Error?

    private var carouselId: String?

    func loadCarousel(id: String) async {
        self.carouselId = id

        guard let apiClient = Opencom.apiClientInternal else {
            return
        }

        isLoading = true
        defer { isLoading = false }

        do {
            carousel = try await apiClient.getCarousel(carouselId: id)
            await trackInteraction(action: "shown")
        } catch {
            self.error = error
        }
    }

    func nextScreen() {
        guard let carousel = carousel else { return }
        if currentIndex < carousel.screens.count - 1 {
            withAnimation {
                currentIndex += 1
            }
        }
    }

    func trackInteraction(action: String) async {
        guard let carouselId = carouselId,
              let apiClient = Opencom.apiClientInternal,
              let visitorId = Opencom.visitorId else {
            return
        }

        do {
            try await apiClient.trackCarouselInteraction(
                carouselId: carouselId,
                visitorId: visitorId,
                action: action,
                screenIndex: currentIndex
            )
        } catch {
            // Ignore tracking errors
        }
    }
}

// MARK: - Carousel Content

private struct CarouselContent: View {
    let carousel: CarouselData
    @Binding var currentIndex: Int
    let onDismiss: () -> Void
    let onButtonTap: (CarouselButton) -> Void

    var body: some View {
        VStack(spacing: 0) {
            // Close button
            HStack {
                Spacer()
                Button(action: onDismiss) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 28))
                        .foregroundColor(.white.opacity(0.8))
                }
                .padding()
            }

            // Content
            TabView(selection: $currentIndex) {
                ForEach(Array(carousel.screens.enumerated()), id: \.element.id) { index, screen in
                    CarouselScreenView(
                        screen: screen,
                        onButtonTap: onButtonTap
                    )
                    .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .automatic))

            // Page indicator
            if carousel.screens.count > 1 {
                HStack(spacing: 8) {
                    ForEach(0..<carousel.screens.count, id: \.self) { index in
                        Circle()
                            .fill(index == currentIndex ? Color.white : Color.white.opacity(0.5))
                            .frame(width: 8, height: 8)
                    }
                }
                .padding(.bottom, 20)
            }
        }
        .background(
            RoundedRectangle(cornerRadius: 20)
                .fill(Opencom.theme.backgroundColor)
        )
        .padding(20)
    }
}

private struct CarouselScreenView: View {
    let screen: CarouselScreen
    let onButtonTap: (CarouselButton) -> Void

    var body: some View {
        VStack(spacing: 20) {
            if let imageUrl = screen.imageUrl, let url = URL(string: imageUrl) {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                } placeholder: {
                    ProgressView()
                }
                .frame(maxHeight: 200)
            }

            if let title = screen.title {
                Text(title)
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(Opencom.theme.textColor)
                    .multilineTextAlignment(.center)
            }

            if let body = screen.body {
                Text(body)
                    .font(Opencom.theme.bodyFont)
                    .foregroundColor(Opencom.theme.secondaryTextColor)
                    .multilineTextAlignment(.center)
            }

            Spacer()

            if let buttons = screen.buttons {
                VStack(spacing: 12) {
                    ForEach(Array(buttons.enumerated()), id: \.offset) { _, button in
                        Button(action: {
                            onButtonTap(button)
                        }) {
                            Text(button.text)
                                .font(Opencom.theme.bodyFont)
                                .fontWeight(.medium)
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(Opencom.theme.primaryColor)
                                .clipShape(RoundedRectangle(cornerRadius: Opencom.theme.buttonRadius))
                        }
                    }
                }
            }
        }
        .padding()
    }
}

#Preview {
    OpencomCarousel(carouselId: "preview")
}
