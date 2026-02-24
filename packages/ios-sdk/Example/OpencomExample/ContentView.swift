import SwiftUI
import OpencomSDK

struct ContentView: View {
    @State private var isLoggedIn = false
    @State private var userName = ""
    @State private var userEmail = ""
    @State private var eventName = ""
    @State private var showingAlert = false
    @State private var alertMessage = ""

    var body: some View {
        ZStack {
            NavigationStack {
                List {
                    Section("User") {
                        if isLoggedIn {
                            Text("Logged in as \(userName)")
                            Button("Logout", role: .destructive) {
                                logout()
                            }
                        } else {
                            TextField("Name", text: $userName)
                            TextField("Email", text: $userEmail)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .autocapitalization(.none)
                            Button("Login") {
                                login()
                            }
                            .disabled(userName.isEmpty || userEmail.isEmpty)
                        }
                    }

                    Section("Messenger") {
                        Button("Open Messenger") {
                            Opencom.present()
                        }

                        Button("Open Help Center") {
                            Opencom.presentHelpCenter()
                        }
                    }

                    Section("Events") {
                        TextField("Event name", text: $eventName)
                        Button("Track Event") {
                            trackEvent()
                        }
                        .disabled(eventName.isEmpty)

                        Button("Track Purchase Event") {
                            trackPurchaseEvent()
                        }
                    }

                    Section("Push Notifications") {
                        Button("Register for Push") {
                            registerForPush()
                        }
                    }

                    Section("Carousels") {
                        Button("Show Sample Carousel") {
                            Opencom.presentCarousel(id: "sample-carousel")
                        }
                    }

                    Section("Debug") {
                        HStack {
                            Text("SDK Ready")
                            Spacer()
                            Image(systemName: Opencom.isReady ? "checkmark.circle.fill" : "xmark.circle.fill")
                                .foregroundColor(Opencom.isReady ? .green : .red)
                        }

                        if let visitorId = Opencom.visitorId {
                            HStack {
                                Text("Visitor ID")
                                Spacer()
                                Text(String(visitorId.prefix(8)) + "...")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
                .navigationTitle("Opencom Example")
            }

            // Floating launcher button
            OpencomLauncher()
        }
        .alert("Opencom", isPresented: $showingAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(alertMessage)
        }
    }

    private func login() {
        Task {
            do {
                try await Opencom.identify(user: OpencomUser(
                    userId: UUID().uuidString,
                    email: userEmail,
                    name: userName,
                    customAttributes: ["source": "example_app"]
                ))
                isLoggedIn = true
                showAlert("Logged in successfully")
            } catch {
                showAlert("Login failed: \(error.localizedDescription)")
            }
        }
    }

    private func logout() {
        Task {
            do {
                try await Opencom.logout()
                isLoggedIn = false
                userName = ""
                userEmail = ""
                showAlert("Logged out successfully")
            } catch {
                showAlert("Logout failed: \(error.localizedDescription)")
            }
        }
    }

    private func trackEvent() {
        Task {
            do {
                try await Opencom.trackEvent(eventName)
                showAlert("Event '\(eventName)' tracked")
                eventName = ""
            } catch {
                showAlert("Failed to track event: \(error.localizedDescription)")
            }
        }
    }

    private func trackPurchaseEvent() {
        Task {
            do {
                try await Opencom.trackEvent("purchase_completed", properties: [
                    "amount": 99.99,
                    "currency": "USD",
                    "productId": "prod-123",
                    "productName": "Premium Plan"
                ])
                showAlert("Purchase event tracked")
            } catch {
                showAlert("Failed to track event: \(error.localizedDescription)")
            }
        }
    }

    private func registerForPush() {
        Task {
            do {
                try await Opencom.registerForPush()
                showAlert("Push notifications registered")
            } catch {
                showAlert("Failed to register: \(error.localizedDescription)")
            }
        }
    }

    private func showAlert(_ message: String) {
        alertMessage = message
        showingAlert = true
    }
}

#Preview {
    ContentView()
}
