import SwiftUI

/// Help center view for browsing and searching knowledge base articles.
public struct OpencomHelpCenter: View {
    @StateObject private var viewModel = HelpCenterViewModel()
    @Environment(\.dismiss) private var dismiss

    public init() {}

    public var body: some View {
        NavigationView {
            Group {
                if viewModel.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.articles.isEmpty {
                    EmptyHelpCenterView()
                } else {
                    ArticleListView(viewModel: viewModel)
                }
            }
            .navigationTitle("Help Center")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .searchable(text: $viewModel.searchQuery, prompt: "Search articles")
            .onChange(of: viewModel.searchQuery) { _ in
                viewModel.search()
            }
        }
        .navigationViewStyle(.stack)
        .task {
            await viewModel.loadArticles()
        }
    }
}

/// Internal help center view used by the presenter.
struct OpencomHelpCenterView: View {
    var body: some View {
        OpencomHelpCenter()
    }
}

// MARK: - View Model

@MainActor
private final class HelpCenterViewModel: ObservableObject {
    @Published var articles: [ArticleData] = []
    @Published var filteredArticles: [ArticleData] = []
    @Published var searchQuery = ""
    @Published var isLoading = false
    @Published var isSearching = false
    @Published var error: Error?

    private var searchTask: Task<Void, Never>?

    var displayedArticles: [ArticleData] {
        searchQuery.isEmpty ? articles : filteredArticles
    }

    func loadArticles() async {
        guard let apiClient = Opencom.apiClientInternal,
              let config = Opencom.configInternal else {
            return
        }

        isLoading = true
        defer { isLoading = false }

        do {
            articles = try await apiClient.getArticles(workspaceId: config.workspaceId)
            filteredArticles = articles
        } catch {
            self.error = error
        }
    }

    func search() {
        searchTask?.cancel()

        guard !searchQuery.isEmpty else {
            filteredArticles = articles
            return
        }

        searchTask = Task {
            isSearching = true
            defer { isSearching = false }

            // Debounce
            try? await Task.sleep(nanoseconds: 300_000_000)

            guard !Task.isCancelled else { return }

            guard let apiClient = Opencom.apiClientInternal,
                  let config = Opencom.configInternal else {
                return
            }

            do {
                filteredArticles = try await apiClient.searchArticles(
                    workspaceId: config.workspaceId,
                    query: searchQuery
                )
            } catch {
                // Fall back to local filtering
                let query = searchQuery.lowercased()
                filteredArticles = articles.filter {
                    $0.title.lowercased().contains(query) ||
                    $0.content.lowercased().contains(query)
                }
            }
        }
    }
}

// MARK: - Article List

private struct ArticleListView: View {
    @ObservedObject var viewModel: HelpCenterViewModel

    var body: some View {
        List(viewModel.displayedArticles) { article in
            NavigationLink(destination: ArticleDetailView(article: article)) {
                ArticleRow(article: article)
            }
        }
        .listStyle(.plain)
        .overlay {
            if viewModel.isSearching {
                ProgressView()
            } else if viewModel.displayedArticles.isEmpty && !viewModel.searchQuery.isEmpty {
                NoSearchResultsView(query: viewModel.searchQuery)
            }
        }
    }
}

private struct ArticleRow: View {
    let article: ArticleData

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(article.title)
                .font(Opencom.theme.headingFont)
                .foregroundColor(Opencom.theme.textColor)

            if let summary = article.summary {
                Text(summary)
                    .font(Opencom.theme.captionFont)
                    .foregroundColor(Opencom.theme.secondaryTextColor)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Article Detail

private struct ArticleDetailView: View {
    let article: ArticleData

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(article.title)
                    .font(.title)
                    .fontWeight(.bold)
                    .foregroundColor(Opencom.theme.textColor)

                // Simple markdown-like rendering
                Text(article.content)
                    .font(Opencom.theme.bodyFont)
                    .foregroundColor(Opencom.theme.textColor)
            }
            .padding()
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Empty State

private struct EmptyHelpCenterView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "book.closed")
                .font(.system(size: 48))
                .foregroundColor(Opencom.theme.secondaryTextColor)

            Text("No articles yet")
                .font(Opencom.theme.headingFont)
                .foregroundColor(Opencom.theme.textColor)

            Text("Check back later for helpful articles and guides.")
                .font(Opencom.theme.bodyFont)
                .foregroundColor(Opencom.theme.secondaryTextColor)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
}

// MARK: - No Search Results

private struct NoSearchResultsView: View {
    let query: String

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 48))
                .foregroundColor(Opencom.theme.secondaryTextColor)

            Text("No results for \"\(query)\"")
                .font(Opencom.theme.headingFont)
                .foregroundColor(Opencom.theme.textColor)

            Text("Try searching with different keywords.")
                .font(Opencom.theme.bodyFont)
                .foregroundColor(Opencom.theme.secondaryTextColor)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
}

#Preview {
    OpencomHelpCenter()
}
