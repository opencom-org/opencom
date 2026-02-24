import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
} from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useQuery } from "convex/react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import { getVisitorState, getConfig } from "@opencom/sdk-core";
import { useMessengerSettings } from "../hooks/useMessengerSettings";

// ============================================================================
// Types
// ============================================================================

interface HomeCard {
  id: string;
  type:
    | "welcome"
    | "search"
    | "conversations"
    | "startConversation"
    | "featuredArticles"
    | "announcements";
  config?: Record<string, unknown>;
  visibleTo: "all" | "visitors" | "users";
}

interface HomeConfig {
  enabled: boolean;
  cards: HomeCard[];
  defaultSpace: "home" | "messages" | "help";
  launchDirectlyToConversation: boolean;
}

interface Conversation {
  _id: Id<"conversations">;
  updatedAt: number;
  lastMessageAt?: number;
  unreadByVisitor?: number;
  lastMessage?: {
    content: string;
    senderType: string;
  };
}

interface Article {
  _id: Id<"articles">;
  title: string;
  slug: string;
}

interface OpencomHomeProps {
  workspaceId: string;
  visitorId: string | null;
  isIdentified: boolean;
  onStartConversation: () => void;
  onSelectConversation: (id: string) => void;
  onSelectArticle: (id: string) => void;
  onSearch: (query: string) => void;
  style?: object;
}

// ============================================================================
// Icons
// ============================================================================

function SearchIcon({ color = "#6b7280", size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx="11" cy="11" r="8" />
      <Path d="m21 21-4.3-4.3" />
    </Svg>
  );
}

function MessageIcon({ color = "#6b7280", size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </Svg>
  );
}

function FileTextIcon({ color = "#6b7280", size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <Path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <Path d="M10 9H8" />
      <Path d="M16 13H8" />
      <Path d="M16 17H8" />
    </Svg>
  );
}

function BellIcon({ color = "#6b7280", size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Svg>
  );
}

function SendIcon({ color = "#ffffff", size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="m22 2-7 20-4-9-9-4Z" />
      <Path d="M22 2 11 13" />
    </Svg>
  );
}

function ChevronRightIcon({ color = "#6b7280", size = 16 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="m9 18 6-6-6-6" />
    </Svg>
  );
}

// ============================================================================
// Hook for Home Config
// ============================================================================

const DEFAULT_HOME_CONFIG: HomeConfig = {
  enabled: true,
  cards: [
    { id: "welcome", type: "welcome", visibleTo: "all" },
    { id: "search", type: "search", visibleTo: "all" },
    { id: "conversations", type: "conversations", visibleTo: "all" },
    { id: "startConversation", type: "startConversation", visibleTo: "all" },
  ],
  defaultSpace: "home",
  launchDirectlyToConversation: false,
};

export function useHomeConfig(workspaceId: string | undefined, isIdentified: boolean) {
  const homeConfig = useQuery(
    api.messengerSettings.getPublicHomeConfig,
    workspaceId ? { workspaceId: workspaceId as Id<"workspaces">, isIdentified } : "skip"
  ) as HomeConfig | undefined;

  // Return default config if backend config is missing or not loaded yet
  return homeConfig ?? DEFAULT_HOME_CONFIG;
}

// ============================================================================
// Component
// ============================================================================

export function OpencomHome({
  workspaceId,
  visitorId,
  isIdentified,
  onStartConversation,
  onSelectConversation,
  onSelectArticle,
  onSearch,
  style,
}: OpencomHomeProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { theme, settings } = useMessengerSettings();

  // Read visitor state from sdk-core (the visitorId prop may be null)
  const { visitorId: resolvedVisitorId, sessionToken } = getVisitorState();
  const vid = (visitorId || resolvedVisitorId) as Id<"visitors"> | null;
  let configWorkspaceId: string | undefined;
  try {
    configWorkspaceId = getConfig().workspaceId;
  } catch {
    /* not yet initialized */
  }
  const wsId = (workspaceId || configWorkspaceId) as Id<"workspaces"> | undefined;

  const fetchedHomeConfig = useQuery(
    api.messengerSettings.getPublicHomeConfig,
    wsId ? { workspaceId: wsId, isIdentified } : "skip"
  ) as HomeConfig | undefined;
  const homeConfig = fetchedHomeConfig ?? DEFAULT_HOME_CONFIG;

  const conversations = useQuery(
    api.conversations.listByVisitor,
    vid && sessionToken && wsId ? { visitorId: vid, sessionToken, workspaceId: wsId } : "skip"
  ) as Conversation[] | undefined;

  const featuredArticles = useQuery(
    api.articles.listForVisitor,
    vid && sessionToken && wsId ? { workspaceId: wsId, visitorId: vid, sessionToken } : "skip"
  ) as Article[] | undefined;

  const searchResults = useQuery(
    api.articles.searchForVisitor,
    vid && sessionToken && wsId && searchQuery.length >= 2
      ? { workspaceId: wsId, visitorId: vid, sessionToken, query: searchQuery }
      : "skip"
  ) as Article[] | undefined;

  if (!homeConfig?.enabled) {
    return null;
  }

  const recentConversations = conversations
    ?.filter((c) => {
      const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
      return (c.lastMessageAt || c.updatedAt) > threeDaysAgo;
    })
    .slice(0, 3);

  const renderCard = (card: HomeCard) => {
    switch (card.type) {
      case "welcome":
        return (
          <View
            key={card.id}
            style={[styles.card, styles.welcomeCard, { backgroundColor: theme.primaryColor }]}
          >
            <View style={styles.welcomeHeader}>
              {settings?.logo && <Image source={{ uri: settings.logo }} style={styles.logo} />}
              <View style={styles.welcomeText}>
                <Text style={styles.welcomeTitle}>{settings?.welcomeMessage || "Hi there!"}</Text>
                {settings?.teamIntroduction && (
                  <Text style={styles.welcomeSubtitle}>{settings.teamIntroduction}</Text>
                )}
              </View>
            </View>
          </View>
        );

      case "search":
        return (
          <View
            key={card.id}
            style={[
              styles.card,
              styles.searchCard,
              { backgroundColor: theme.mutedColor, borderBottomColor: theme.borderColor },
            ]}
          >
            <View
              style={[
                styles.searchInputWrapper,
                { backgroundColor: theme.surfaceColor, borderColor: theme.borderColor },
              ]}
            >
              <SearchIcon color={theme.textMuted} size={18} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={() => searchQuery.trim() && onSearch(searchQuery)}
                placeholder="Search for help..."
                placeholderTextColor={theme.textMuted}
                style={[styles.searchInput, { color: theme.textColor }]}
                returnKeyType="search"
              />
            </View>
            {searchQuery.length >= 2 && searchResults && searchResults.length > 0 && (
              <View
                style={[
                  styles.searchResults,
                  { backgroundColor: theme.surfaceColor, borderColor: theme.borderColor },
                ]}
              >
                {searchResults.slice(0, 5).map((article) => (
                  <TouchableOpacity
                    key={article._id}
                    onPress={() => onSelectArticle(article._id)}
                    style={[styles.searchResultItem, { borderBottomColor: theme.borderColor }]}
                  >
                    <FileTextIcon color={theme.textMuted} size={16} />
                    <Text
                      style={[styles.searchResultText, { color: theme.textColor }]}
                      numberOfLines={1}
                    >
                      {article.title}
                    </Text>
                    <ChevronRightIcon color={theme.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        );

      case "conversations":
        return (
          <View
            key={card.id}
            style={[
              styles.card,
              { backgroundColor: theme.surfaceColor, borderBottomColor: theme.borderColor },
            ]}
          >
            <View style={styles.cardHeader}>
              <MessageIcon color={theme.textMuted} size={18} />
              <Text style={[styles.cardTitle, { color: theme.textColor }]}>
                Recent Conversations
              </Text>
            </View>
            {recentConversations && recentConversations.length > 0 ? (
              <View style={[styles.listContainer, { borderColor: theme.borderColor }]}>
                {recentConversations.map((conv, index) => (
                  <TouchableOpacity
                    key={conv._id}
                    onPress={() => onSelectConversation(conv._id)}
                    style={[
                      styles.listItem,
                      { borderBottomColor: theme.borderColor },
                      index === recentConversations.length - 1 && styles.lastListItem,
                    ]}
                  >
                    <View style={styles.conversationPreview}>
                      <Text
                        style={[styles.conversationText, { color: theme.textColor }]}
                        numberOfLines={1}
                      >
                        {conv.lastMessage?.content || "No messages yet"}
                      </Text>
                      {conv.unreadByVisitor && conv.unreadByVisitor > 0 && (
                        <View style={[styles.unreadBadge, { backgroundColor: theme.primaryColor }]}>
                          <Text style={[styles.unreadBadgeText, { color: theme.textOnPrimary }]}>
                            {conv.unreadByVisitor}
                          </Text>
                        </View>
                      )}
                    </View>
                    <ChevronRightIcon color={theme.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={[styles.emptyState, { backgroundColor: theme.mutedColor }]}>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  No recent conversations
                </Text>
              </View>
            )}
          </View>
        );

      case "startConversation":
        return (
          <View
            key={card.id}
            style={[
              styles.card,
              styles.startCard,
              { backgroundColor: theme.surfaceColor, borderBottomColor: theme.borderColor },
            ]}
          >
            <TouchableOpacity
              onPress={onStartConversation}
              style={[styles.startButton, { backgroundColor: theme.primaryColor }]}
            >
              <SendIcon color={theme.textOnPrimary} size={18} />
              <Text style={[styles.startButtonText, { color: theme.textOnPrimary }]}>
                Send us a message
              </Text>
            </TouchableOpacity>
          </View>
        );

      case "featuredArticles":
        return (
          <View
            key={card.id}
            style={[
              styles.card,
              { backgroundColor: theme.surfaceColor, borderBottomColor: theme.borderColor },
            ]}
          >
            <View style={styles.cardHeader}>
              <FileTextIcon color={theme.textMuted} size={18} />
              <Text style={[styles.cardTitle, { color: theme.textColor }]}>Popular Articles</Text>
            </View>
            {featuredArticles && featuredArticles.length > 0 ? (
              <View style={[styles.listContainer, { borderColor: theme.borderColor }]}>
                {featuredArticles.slice(0, 5).map((article, index) => (
                  <TouchableOpacity
                    key={article._id}
                    onPress={() => onSelectArticle(article._id)}
                    style={[
                      styles.listItem,
                      { borderBottomColor: theme.borderColor },
                      index === Math.min(featuredArticles.length, 5) - 1 && styles.lastListItem,
                    ]}
                  >
                    <Text
                      style={[styles.articleText, { color: theme.textColor }]}
                      numberOfLines={1}
                    >
                      {article.title}
                    </Text>
                    <ChevronRightIcon color={theme.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={[styles.emptyState, { backgroundColor: theme.mutedColor }]}>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  No articles available
                </Text>
              </View>
            )}
          </View>
        );

      case "announcements":
        return (
          <View
            key={card.id}
            style={[
              styles.card,
              { backgroundColor: theme.surfaceColor, borderBottomColor: theme.borderColor },
            ]}
          >
            <View style={styles.cardHeader}>
              <BellIcon color={theme.textMuted} size={18} />
              <Text style={[styles.cardTitle, { color: theme.textColor }]}>Announcements</Text>
            </View>
            <View style={[styles.emptyState, { backgroundColor: theme.mutedColor }]}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>No announcements</Text>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <ScrollView style={[styles.container, style]} contentContainerStyle={styles.contentContainer}>
      {homeConfig.cards.map(renderCard)}
    </ScrollView>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 16,
  },
  card: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  welcomeCard: {
    paddingVertical: 20,
    borderBottomWidth: 0,
  },
  welcomeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  welcomeText: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.9)",
  },
  searchCard: {
    paddingVertical: 16,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  searchResults: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchResultText: {
    flex: 1,
    fontSize: 14,
  },
  listContainer: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  lastListItem: {
    borderBottomWidth: 0,
  },
  conversationPreview: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  conversationText: {
    flex: 1,
    fontSize: 14,
  },
  unreadBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#ffffff",
  },
  articleText: {
    flex: 1,
    fontSize: 14,
  },
  startCard: {
    paddingVertical: 20,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  startButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  emptyState: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
  },
});

export default OpencomHome;
