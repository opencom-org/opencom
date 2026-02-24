import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ScrollView,
  type ViewStyle,
} from "react-native";
import { useArticles, useArticleSearch, useArticle } from "../hooks/useArticles";
import { useMessengerSettings, type OpencomTheme } from "../hooks/useMessengerSettings";
import type { Id } from "@opencom/convex/dataModel";

type HelpCenterView = "search" | "article";

interface OpencomHelpCenterProps {
  onStartConversation?: () => void;
  style?: ViewStyle;
  primaryColor?: string;
  onViewChange?: (view: "search" | "article") => void;
  controlledView?: "search" | "article";
}

export function OpencomHelpCenter({
  onStartConversation,
  style: _style,
  primaryColor,
  onViewChange,
  controlledView,
}: OpencomHelpCenterProps) {
  const { theme } = useMessengerSettings();
  const [view, setView] = useState<HelpCenterView>("search");
  const [selectedArticleId, setSelectedArticleId] = useState<Id<"articles"> | null>(null);

  const effectivePrimaryColor = primaryColor ?? theme.primaryColor;

  // Sync with parent-controlled view when it changes
  useEffect(() => {
    if (controlledView !== undefined && controlledView !== view) {
      setView(controlledView);
      if (controlledView === "search") {
        setSelectedArticleId(null);
      }
    }
  }, [controlledView]);

  const handleSelectArticle = (articleId: Id<"articles">) => {
    setSelectedArticleId(articleId);
    setView("article");
    onViewChange?.("article");
  };

  return (
    <>
      {view === "search" ? (
        <ArticleSearch
          onSelectArticle={handleSelectArticle}
          onStartConversation={onStartConversation}
          primaryColor={effectivePrimaryColor}
          theme={theme}
        />
      ) : (
        <ArticleDetail
          articleId={selectedArticleId!}
          onStartConversation={onStartConversation}
          primaryColor={effectivePrimaryColor}
          theme={theme}
        />
      )}
    </>
  );
}

interface ArticleSearchProps {
  onSelectArticle: (id: Id<"articles">) => void;
  onStartConversation?: () => void;
  primaryColor: string;
  theme: OpencomTheme;
}

function ArticleSearch({
  onSelectArticle,
  onStartConversation,
  primaryColor,
  theme,
}: ArticleSearchProps) {
  const [query, setQuery] = useState("");
  const { articles, isLoading: isLoadingArticles } = useArticles();
  const { results, isLoading: isSearching } = useArticleSearch(query);

  const displayArticles = query.length >= 2 ? results : articles;
  const isLoading = query.length >= 2 ? isSearching : isLoadingArticles;

  return (
    <View style={[styles.searchContainer, { backgroundColor: theme.surfaceColor }]}>
      <View
        style={[
          styles.searchInputContainer,
          { backgroundColor: theme.mutedColor, borderColor: theme.borderColor },
        ]}
      >
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: theme.textColor }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search for help..."
          placeholderTextColor={theme.textMuted}
        />
      </View>

      {isLoading ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            {query.length >= 2 ? "Searching..." : "Loading..."}
          </Text>
        </View>
      ) : displayArticles.length === 0 ? (
        <View style={styles.emptyContainer}>
          {query.length >= 2 ? (
            <>
              <Text style={[styles.emptyTitle, { color: theme.textColor }]}>No articles found</Text>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Try different keywords or start a conversation
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.emptyTitle, { color: theme.textColor }]}>Help Center</Text>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Search for articles or browse below
              </Text>
            </>
          )}
          {onStartConversation && (
            <TouchableOpacity
              onPress={onStartConversation}
              style={[styles.startButton, { backgroundColor: primaryColor }]}
            >
              <Text style={[styles.startButtonText, { color: theme.textOnPrimary }]}>
                Start a conversation
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={displayArticles}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.articleItem,
                { backgroundColor: theme.surfaceColor, borderBottomColor: theme.borderColor },
              ]}
              onPress={() => onSelectArticle(item._id)}
            >
              <Text style={styles.articleIcon}>📄</Text>
              <View style={styles.articleContent}>
                <Text style={[styles.articleTitle, { color: theme.textColor }]}>{item.title}</Text>
                <Text style={[styles.articleExcerpt, { color: theme.textMuted }]} numberOfLines={2}>
                  {item.content.slice(0, 100)}...
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

interface ArticleDetailProps {
  articleId: Id<"articles">;
  onStartConversation?: () => void;
  primaryColor: string;
  theme: OpencomTheme;
}

function ArticleDetail({
  articleId,
  onStartConversation,
  primaryColor,
  theme,
}: ArticleDetailProps) {
  const { article, isLoading } = useArticle(articleId);

  return (
    <View style={[styles.detailContainer, { backgroundColor: theme.surfaceColor }]}>
      {isLoading ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>Loading article...</Text>
        </View>
      ) : article ? (
        <ScrollView style={styles.articleDetailContent}>
          <Text style={[styles.articleDetailTitle, { color: theme.textColor }]}>
            {article.title}
          </Text>
          <Text style={[styles.articleDetailBody, { color: theme.textColor }]}>
            {article.content}
          </Text>

          {onStartConversation && (
            <View style={[styles.articleActions, { backgroundColor: theme.mutedColor }]}>
              <Text style={[styles.articleActionsTitle, { color: theme.textColor }]}>
                Still need help?
              </Text>
              <TouchableOpacity
                onPress={onStartConversation}
                style={[styles.startButton, { backgroundColor: primaryColor }]}
              >
                <Text style={[styles.startButtonText, { color: theme.textOnPrimary }]}>
                  Start a conversation
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>Article not found</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  searchContainer: {
    flex: 1,
  },
  detailContainer: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    flex: 1,
    textAlign: "center",
  },
  headerButton: {
    padding: 4,
  },
  closeButton: {
    fontSize: 20,
    color: "#666666",
  },
  backButton: {
    padding: 4,
  },
  backButtonText: {
    fontSize: 28,
    color: "#000000",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    paddingHorizontal: 12,
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    marginBottom: 16,
  },
  startButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  articleItem: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  articleIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  articleContent: {
    flex: 1,
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000000",
    marginBottom: 4,
  },
  articleExcerpt: {
    fontSize: 14,
    color: "#666666",
  },
  articleDetailContent: {
    flex: 1,
    padding: 16,
  },
  articleDetailTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 16,
  },
  articleDetailBody: {
    fontSize: 16,
    lineHeight: 24,
    color: "#333333",
  },
  articleActions: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
    alignItems: "center",
  },
  articleActionsTitle: {
    fontSize: 16,
    color: "#666666",
    marginBottom: 12,
  },
});
