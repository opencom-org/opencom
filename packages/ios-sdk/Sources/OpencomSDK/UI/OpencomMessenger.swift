import SwiftUI

/// The main messenger view showing conversations and messages.
/// Can be embedded directly or presented via `Opencom.present()`.
public struct OpencomMessenger: View {
    @StateObject private var viewModel = MessengerViewModel()
    @Environment(\.dismiss) private var dismiss

    public init() {}

    public var body: some View {
        NavigationView {
            Group {
                if viewModel.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.conversations.isEmpty {
                    NewConversationView(viewModel: viewModel)
                } else {
                    ConversationListView(viewModel: viewModel)
                }
            }
            .navigationTitle("Messages")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    if !viewModel.conversations.isEmpty {
                        Button(action: {
                            viewModel.startNewConversation()
                        }) {
                            Image(systemName: "square.and.pencil")
                        }
                    }
                }
            }
        }
        .navigationViewStyle(.stack)
        .task {
            await viewModel.loadConversations()
        }
    }
}

/// Internal messenger view used by the presenter.
struct OpencomMessengerView: View {
    var body: some View {
        OpencomMessenger()
    }
}

// MARK: - View Model

@MainActor
final class MessengerViewModel: ObservableObject {
    @Published var conversations: [ConversationData] = []
    @Published var isLoading = false
    @Published var error: Error?
    @Published var showNewConversation = false

    func loadConversations() async {
        guard let apiClient = Opencom.apiClientInternal,
              let visitorId = Opencom.visitorId else {
            return
        }

        isLoading = true
        defer { isLoading = false }

        do {
            let sessionToken = await Opencom.sessionManagerInternal?.sessionToken
            let workspaceId = Opencom.configInternal?.workspaceId ?? ""
            conversations = try await apiClient.getConversations(visitorId: visitorId, sessionToken: sessionToken, workspaceId: workspaceId)
        } catch {
            self.error = error
        }
    }

    func startNewConversation() {
        showNewConversation = true
    }
}

// MARK: - Conversation List

private struct ConversationListView: View {
    @ObservedObject var viewModel: MessengerViewModel

    var body: some View {
        List(viewModel.conversations) { conversation in
            NavigationLink(destination: ConversationDetailView(conversationId: conversation.id)) {
                ConversationRow(conversation: conversation)
            }
        }
        .listStyle(.plain)
        .refreshable {
            await viewModel.loadConversations()
        }
        .sheet(isPresented: $viewModel.showNewConversation) {
            NewConversationView(viewModel: viewModel)
        }
    }
}

private struct ConversationRow: View {
    let conversation: ConversationData

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(conversation.lastMessage ?? "New conversation")
                    .font(Opencom.theme.bodyFont)
                    .foregroundColor(Opencom.theme.textColor)
                    .lineLimit(2)

                Spacer()

                if conversation.unreadCount > 0 {
                    Text("\(conversation.unreadCount)")
                        .font(.caption)
                        .foregroundColor(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(Opencom.theme.primaryColor)
                        .clipShape(Capsule())
                }
            }

            if let timestamp = conversation.lastMessageAt {
                Text(formatDate(timestamp))
                    .font(Opencom.theme.captionFont)
                    .foregroundColor(Opencom.theme.secondaryTextColor)
            }
        }
        .padding(.vertical, 4)
    }

    private func formatDate(_ timestamp: Double) -> String {
        let date = Date(timeIntervalSince1970: timestamp / 1000)
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: - New Conversation

private struct NewConversationView: View {
    @ObservedObject var viewModel: MessengerViewModel
    @State private var messageText = ""
    @State private var isSending = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            VStack {
                Spacer()

                VStack(spacing: 16) {
                    Image(systemName: "bubble.left.and.bubble.right")
                        .font(.system(size: 48))
                        .foregroundColor(Opencom.theme.primaryColor)

                    Text("Start a conversation")
                        .font(Opencom.theme.headingFont)
                        .foregroundColor(Opencom.theme.textColor)

                    Text("We're here to help. Send us a message and we'll get back to you as soon as possible.")
                        .font(Opencom.theme.bodyFont)
                        .foregroundColor(Opencom.theme.secondaryTextColor)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }

                Spacer()

                MessageInputView(
                    text: $messageText,
                    isSending: isSending,
                    onSend: sendMessage
                )
            }
            .navigationTitle("New Message")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
        .navigationViewStyle(.stack)
    }

    private func sendMessage() {
        guard !messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return
        }

        isSending = true

        Task {
            defer { isSending = false }

            guard let apiClient = Opencom.apiClientInternal,
                  let visitorId = Opencom.visitorId else {
                return
            }

            do {
                let sessionToken = await Opencom.sessionManagerInternal?.sessionToken
                let workspaceId = Opencom.configInternal?.workspaceId ?? ""
                let conversation = try await apiClient.createConversation(
                    visitorId: visitorId,
                    sessionToken: sessionToken,
                    workspaceId: workspaceId,
                    initialMessage: messageText
                )

                await viewModel.loadConversations()
                messageText = ""
                dismiss()

                // Navigate to the new conversation
                OpencomPresenter.shared.presentConversation(id: conversation.id)
            } catch {
                viewModel.error = error
            }
        }
    }
}

// MARK: - Conversation Detail

private struct ConversationDetailView: View {
    let conversationId: String
    @StateObject private var viewModel = ConversationDetailViewModel()

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(viewModel.messages) { message in
                            MessageBubble(message: message)
                                .id(message.id)
                        }
                    }
                    .padding()
                }
                .onChange(of: viewModel.messages.count) { _ in
                    if let lastMessage = viewModel.messages.last {
                        withAnimation {
                            proxy.scrollTo(lastMessage.id, anchor: .bottom)
                        }
                    }
                }
            }

            MessageInputView(
                text: $viewModel.newMessageText,
                isSending: viewModel.isSending,
                onSend: {
                    Task {
                        await viewModel.sendMessage()
                    }
                }
            )
        }
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadMessages(conversationId: conversationId)
        }
    }
}

@MainActor
private final class ConversationDetailViewModel: ObservableObject {
    @Published var messages: [MessageData] = []
    @Published var newMessageText = ""
    @Published var isSending = false
    @Published var error: Error?

    private var conversationId: String?
    private var pollingTask: Task<Void, Never>?

    func loadMessages(conversationId: String) async {
        self.conversationId = conversationId

        guard let apiClient = Opencom.apiClientInternal else {
            return
        }

        do {
            let sessionToken = await Opencom.sessionManagerInternal?.sessionToken
            messages = try await apiClient.getMessages(conversationId: conversationId, visitorId: Opencom.visitorId, sessionToken: sessionToken)
            startPolling()
        } catch {
            self.error = error
        }
    }

    func sendMessage() async {
        guard let conversationId = conversationId,
              let apiClient = Opencom.apiClientInternal,
              let visitorId = Opencom.visitorId,
              !newMessageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return
        }

        isSending = true
        defer { isSending = false }

        let messageContent = newMessageText
        newMessageText = ""

        do {
            let sessionToken = await Opencom.sessionManagerInternal?.sessionToken
            let message = try await apiClient.sendMessage(
                conversationId: conversationId,
                content: messageContent,
                visitorId: visitorId,
                sessionToken: sessionToken
            )
            messages.append(message)
        } catch {
            self.error = error
            newMessageText = messageContent
        }
    }

    private func startPolling() {
        pollingTask?.cancel()
        pollingTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 3_000_000_000) // 3 seconds

                guard let conversationId = conversationId,
                      let apiClient = Opencom.apiClientInternal else {
                    continue
                }

                do {
                    let sessionToken = await Opencom.sessionManagerInternal?.sessionToken
                    let newMessages = try await apiClient.getMessages(conversationId: conversationId, visitorId: Opencom.visitorId, sessionToken: sessionToken)
                    if newMessages.count > messages.count {
                        messages = newMessages
                    }
                } catch {
                    // Ignore polling errors
                }
            }
        }
    }

    deinit {
        pollingTask?.cancel()
    }
}

// MARK: - Message Bubble

private struct MessageBubble: View {
    let message: MessageData

    var body: some View {
        HStack {
            if message.isFromVisitor {
                Spacer(minLength: 60)
            }

            Text(message.content)
                .font(Opencom.theme.bodyFont)
                .foregroundColor(message.isFromVisitor ? Opencom.theme.userMessageTextColor : Opencom.theme.agentMessageTextColor)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(message.isFromVisitor ? Opencom.theme.userMessageColor : Opencom.theme.agentMessageColor)
                .clipShape(RoundedRectangle(cornerRadius: Opencom.theme.messageBubbleRadius))

            if !message.isFromVisitor {
                Spacer(minLength: 60)
            }
        }
    }
}

// MARK: - Message Input

private struct MessageInputView: View {
    @Binding var text: String
    let isSending: Bool
    let onSend: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            TextField("Type a message...", text: $text)
                .textFieldStyle(.plain)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Opencom.theme.secondaryBackgroundColor)
                .clipShape(RoundedRectangle(cornerRadius: 20))

            Button(action: onSend) {
                if isSending {
                    ProgressView()
                        .frame(width: 32, height: 32)
                } else {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 32))
                        .foregroundColor(text.isEmpty ? Opencom.theme.secondaryTextColor : Opencom.theme.primaryColor)
                }
            }
            .disabled(text.isEmpty || isSending)
        }
        .padding()
        .background(Opencom.theme.backgroundColor)
    }
}

#Preview {
    OpencomMessenger()
}
