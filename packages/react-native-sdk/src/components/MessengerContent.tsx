import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from "react-native";
import { OpencomMessenger } from "./OpencomMessenger";
import { OpencomHelpCenter } from "./OpencomHelpCenter";
import { OpencomTickets } from "./OpencomTickets";
import { OpencomChecklist } from "./OpencomChecklist";
import { OpencomHome, useHomeConfig } from "./OpencomHome";
import { TabIcon } from "./TabIcon";
import { useMessengerSettings } from "../hooks/useMessengerSettings";

export type MainTab = "home" | "messages" | "help" | "tours" | "tasks" | "tickets";
export type MessengerView = "tabs" | "conversation" | "article" | "email-capture";

export interface MessengerContentProps {
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
  messengerView: MessengerView;
  setMessengerView: (view: MessengerView) => void;
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;
  selectedArticleId: string | null;
  setSelectedArticleId: (id: string | null) => void;
  availableTabs: MainTab[];
  onClose: () => void;
  enableMessages: boolean;
  enableHelpCenter: boolean;
  enableTickets: boolean;
  enableChecklists: boolean;
  workspaceId: string;
  visitorId: string | null;
  isIdentified: boolean;
}

export function MessengerContent({
  activeTab,
  setActiveTab,
  messengerView,
  setMessengerView,
  selectedConversationId,
  setSelectedConversationId,
  selectedArticleId: _selectedArticleId,
  setSelectedArticleId,
  availableTabs,
  onClose,
  enableMessages,
  enableHelpCenter,
  enableTickets,
  enableChecklists,
  workspaceId,
  visitorId,
  isIdentified,
}: MessengerContentProps) {
  const { theme } = useMessengerSettings();
  const homeConfig = useHomeConfig(workspaceId, isIdentified);

  // Track nested view state from child components
  const [messengerNestedView, setMessengerNestedView] = useState<"list" | "conversation">("list");
  const [messengerConversationId, setMessengerConversationId] = useState<string | null>(null);
  const [helpCenterNestedView, setHelpCenterNestedView] = useState<"search" | "article">("search");

  // Determine if we're in a nested view (conversation or article detail)
  const isInNestedView =
    (activeTab === "messages" && messengerNestedView === "conversation") ||
    (activeTab === "help" && helpCenterNestedView === "article");

  const getTitle = () => {
    if (activeTab === "messages" && messengerNestedView === "conversation") {
      return "Chat";
    }
    if (activeTab === "help" && helpCenterNestedView === "article") {
      return "Article";
    }
    switch (activeTab) {
      case "home":
        return "Home";
      case "messages":
        return "Messages";
      case "help":
        return "Help Center";
      case "tours":
        return "Tours";
      case "tickets":
        return "Tickets";
      case "tasks":
        return "Tasks";
      default:
        return "Home";
    }
  };

  const handleBack = () => {
    if (activeTab === "messages" && messengerNestedView === "conversation") {
      setMessengerNestedView("list");
    } else if (activeTab === "help" && helpCenterNestedView === "article") {
      setHelpCenterNestedView("search");
    } else {
      setMessengerView("tabs");
      setSelectedConversationId(null);
      setSelectedArticleId(null);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.surfaceColor }]}>
      {/* Header - X always on right, back arrow on left only for nested views */}
      <View style={[styles.header, { backgroundColor: theme.primaryColor }]}>
        {isInNestedView ? (
          <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
            <Text style={styles.backButtonText}>‹</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerButton} />
        )}
        <Text style={styles.headerTitle}>{getTitle()}</Text>
        <TouchableOpacity onPress={onClose} style={styles.headerButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {messengerView === "tabs" && (
          <>
            {activeTab === "home" && homeConfig?.enabled && (
              <OpencomHome
                workspaceId={workspaceId}
                visitorId={visitorId}
                isIdentified={isIdentified}
                onStartConversation={() => {
                  setActiveTab("messages");
                }}
                onSelectConversation={() => {
                  setActiveTab("messages");
                }}
                onSelectArticle={() => {
                  setActiveTab("help");
                }}
                onSearch={() => {
                  setActiveTab("help");
                }}
                style={styles.tabContent}
              />
            )}
            {activeTab === "messages" && enableMessages && (
              <OpencomMessenger
                onClose={onClose}
                style={styles.tabContent}
                onViewChange={setMessengerNestedView}
                controlledView={messengerNestedView}
                activeConversationId={messengerConversationId as any}
                onConversationChange={setMessengerConversationId as any}
              />
            )}
            {activeTab === "help" && enableHelpCenter && (
              <OpencomHelpCenter
                style={styles.tabContent}
                onViewChange={setHelpCenterNestedView}
                controlledView={helpCenterNestedView}
              />
            )}
            {activeTab === "tours" && (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyEmoji}>🗺️</Text>
                <Text style={[styles.emptyTitle, { color: theme.textColor }]}>Product Tours</Text>
                <Text style={[styles.emptyDescription, { color: theme.textMuted }]}>
                  Product tours guide you through features. Available tours will appear here.
                </Text>
              </View>
            )}
            {activeTab === "tickets" && enableTickets && (
              <OpencomTickets style={styles.tabContent} />
            )}
            {activeTab === "tasks" && enableChecklists && (
              <OpencomChecklist style={styles.tabContent} />
            )}
          </>
        )}

        {messengerView === "conversation" && selectedConversationId && (
          <OpencomMessenger onClose={onClose} style={styles.tabContent} />
        )}

        {messengerView === "article" && (
          <OpencomHelpCenter
            // onClose={onClose}
            style={styles.tabContent}
          />
        )}
      </View>

      {/* Tab Bar */}
      {messengerView === "tabs" && availableTabs.length > 1 && (
        <View
          style={[
            styles.tabBar,
            { backgroundColor: theme.surfaceColor, borderTopColor: theme.borderColor },
          ]}
        >
          {availableTabs
            // .filter((tab) => tab !== "home" || homeConfig?.enabled)
            .map((tab) => (
              <TouchableOpacity key={tab} style={styles.tab} onPress={() => setActiveTab(tab)}>
                <TabIcon name={tab} active={activeTab === tab} theme={theme} />
                <Text
                  style={[
                    styles.tabLabel,
                    { color: activeTab === tab ? theme.primaryColor : theme.textMuted },
                  ]}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  closeButtonText: {
    fontSize: 20,
    color: "#FFFFFF",
  },
  backButtonText: {
    fontSize: 28,
    color: "#FFFFFF",
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingVertical: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
  },
});
