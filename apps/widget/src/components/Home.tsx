import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import { Search, MessageCircle, ChevronRight, FileText, Bell, Send } from "../icons";

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
  } | null;
}

interface Article {
  _id: Id<"articles">;
  title: string;
  slug: string;
}

interface HomeProps {
  workspaceId: Id<"workspaces">;
  visitorId: Id<"visitors"> | null;
  sessionToken: string | null;
  isIdentified: boolean;
  settings: {
    primaryColor: string;
    backgroundColor: string;
    logo: string | null;
    welcomeMessage: string;
    teamIntroduction: string | null;
  };
  conversations: Conversation[] | undefined;
  onStartConversation: () => void;
  onSelectConversation: (id: Id<"conversations">) => void;
  onSelectArticle: (id: Id<"articles">) => void;
  onSearch: (query: string) => void;
}

export function Home({
  workspaceId,
  visitorId,
  sessionToken,
  isIdentified,
  settings,
  conversations,
  onStartConversation,
  onSelectConversation,
  onSelectArticle,
  onSearch,
}: HomeProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const homeConfig = useQuery(api.messengerSettings.getPublicHomeConfig, {
    workspaceId,
    isIdentified,
  }) as HomeConfig | undefined;

  const featuredArticles = useQuery(
    api.articles.listForVisitor,
    visitorId && sessionToken ? { workspaceId, visitorId, sessionToken } : "skip"
  ) as Article[] | undefined;

  const searchResults = useQuery(
    api.articles.searchForVisitor,
    visitorId && sessionToken && searchQuery.length >= 2
      ? { workspaceId, visitorId, sessionToken, query: searchQuery }
      : "skip"
  ) as Article[] | undefined;

  if (!homeConfig?.enabled) {
    return null;
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      onSearch(searchQuery);
    }
  };

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
          <div key={card.id} className="opencom-home-card opencom-home-welcome">
            <div
              className="opencom-home-welcome-header"
              style={{ backgroundColor: settings.backgroundColor }}
            >
              {settings.logo && <img src={settings.logo} alt="" className="opencom-home-logo" />}
              <div className="opencom-home-greeting">
                <p className="opencom-home-welcome-text">{settings.welcomeMessage}</p>
                {settings.teamIntroduction && (
                  <p className="opencom-home-team-intro">{settings.teamIntroduction}</p>
                )}
              </div>
            </div>
          </div>
        );

      case "search":
        return (
          <div key={card.id} className="opencom-home-card opencom-home-search">
            <div className="opencom-home-search-input-wrapper">
              <Search />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search for help..."
                className="opencom-home-search-input"
              />
            </div>
            {searchQuery.length >= 2 && searchResults && searchResults.length > 0 && (
              <div className="opencom-home-search-results">
                {searchResults.slice(0, 5).map((article) => (
                  <button
                    key={article._id}
                    onClick={() => onSelectArticle(article._id)}
                    className="opencom-home-search-result"
                  >
                    <FileText />
                    <span>{article.title}</span>
                    <ChevronRight />
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case "conversations":
        return (
          <div key={card.id} className="opencom-home-card opencom-home-conversations">
            <h3 className="opencom-home-card-title">
              <MessageCircle />
              Recent Conversations
            </h3>
            {recentConversations && recentConversations.length > 0 ? (
              <div className="opencom-home-conversations-list">
                {recentConversations.map((conv) => {
                  const unreadCount = conv.unreadByVisitor ?? 0;
                  const hasUnread = unreadCount > 0;

                  return (
                    <button
                      key={conv._id}
                      onClick={() => onSelectConversation(conv._id)}
                      className={`opencom-home-conversation-item ${hasUnread ? "opencom-home-conversation-item-unread" : ""}`}
                    >
                      <div className="opencom-home-conversation-preview">
                        <span
                          className={`opencom-home-conversation-text ${hasUnread ? "opencom-home-conversation-text-unread" : ""}`}
                        >
                          {conv.lastMessage?.content || "No messages yet"}
                        </span>
                        {hasUnread && (
                          <span className="opencom-home-unread-badge">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        )}
                      </div>
                      <ChevronRight />
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="opencom-home-empty-text">No recent conversations</p>
            )}
          </div>
        );

      case "startConversation":
        return (
          <div key={card.id} className="opencom-home-card opencom-home-start">
            <button
              onClick={onStartConversation}
              className="opencom-home-start-button"
              style={{ backgroundColor: settings.primaryColor }}
            >
              <Send />
              <span>Send us a message</span>
            </button>
          </div>
        );

      case "featuredArticles":
        return (
          <div key={card.id} className="opencom-home-card opencom-home-articles">
            <h3 className="opencom-home-card-title">
              <FileText />
              Popular Articles
            </h3>
            {featuredArticles && featuredArticles.length > 0 ? (
              <div className="opencom-home-articles-list">
                {featuredArticles.slice(0, 5).map((article) => (
                  <button
                    key={article._id}
                    onClick={() => onSelectArticle(article._id)}
                    className="opencom-home-article-item"
                  >
                    <span>{article.title}</span>
                    <ChevronRight />
                  </button>
                ))}
              </div>
            ) : (
              <p className="opencom-home-empty-text">No articles available</p>
            )}
          </div>
        );

      case "announcements":
        return (
          <div key={card.id} className="opencom-home-card opencom-home-announcements">
            <h3 className="opencom-home-card-title">
              <Bell />
              Announcements
            </h3>
            <p className="opencom-home-empty-text">No announcements</p>
          </div>
        );

      default:
        return null;
    }
  };

  return <div className="opencom-home">{homeConfig.cards.map(renderCard)}</div>;
}

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

export function useHomeConfig(workspaceId: Id<"workspaces"> | undefined, isIdentified: boolean) {
  const homeConfig = useQuery(
    api.messengerSettings.getPublicHomeConfig,
    workspaceId ? { workspaceId, isIdentified } : "skip"
  ) as HomeConfig | undefined;

  return homeConfig ?? DEFAULT_HOME_CONFIG;
}
