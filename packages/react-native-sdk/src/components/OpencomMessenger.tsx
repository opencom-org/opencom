import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  type ViewStyle,
} from "react-native";
import {
  useConversations,
  useConversation,
  useCreateConversation,
} from "../hooks/useConversations";
import { useOpencomContext } from "./OpencomProvider";
import { useMessengerSettings } from "../hooks/useMessengerSettings";
import { useAutomationSettings } from "../hooks/useAutomationSettings";
import { OpencomSDK } from "../OpencomSDK";
import { useMutation } from "convex/react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";

type MessengerView = "list" | "conversation";

interface OpencomMessengerProps {
  onClose?: () => void;
  style?: ViewStyle;
  headerTitle?: string;
  primaryColor?: string;
  onViewChange?: (view: "list" | "conversation") => void;
  controlledView?: "list" | "conversation";
  activeConversationId?: Id<"conversations"> | null;
  onConversationChange?: (conversationId: Id<"conversations"> | null) => void;
}

export function OpencomMessenger({
  style,
  primaryColor,
  onViewChange,
  controlledView,
  activeConversationId: controlledConversationId,
  onConversationChange,
}: OpencomMessengerProps) {
  const { theme } = useMessengerSettings();

  // Use theme colors if not overridden by props
  const effectivePrimaryColor = primaryColor ?? theme.primaryColor;
  const [view, setView] = useState<MessengerView>(controlledView ?? "list");
  const [localConversationId, setLocalConversationId] = useState<Id<"conversations"> | null>(null);
  const { workspaceId } = useOpencomContext();

  // Use controlled conversation ID if provided, otherwise use local state
  const activeConversationId =
    controlledConversationId !== undefined ? controlledConversationId : localConversationId;
  const setActiveConversationId = (id: Id<"conversations"> | null) => {
    if (onConversationChange) {
      onConversationChange(id);
    } else {
      setLocalConversationId(id);
    }
  };

  // Sync with parent-controlled view when it changes
  useEffect(() => {
    if (controlledView !== undefined && controlledView !== view) {
      setView(controlledView);
      // Only clear conversation when explicitly going back to list
      if (controlledView === "list" && onConversationChange) {
        onConversationChange(null);
      }
    }
  }, [controlledView]);

  const handleSelectConversation = (conversationId: Id<"conversations">) => {
    setActiveConversationId(conversationId);
    setView("conversation");
    onViewChange?.("conversation");
  };

  const handleNewConversation = (conversationId: Id<"conversations">) => {
    setActiveConversationId(conversationId);
    setView("conversation");
    onViewChange?.("conversation");
  };

  return (
    <SafeAreaView style={[styles.container, style]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {view === "list" ? (
          <ConversationList
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            primaryColor={effectivePrimaryColor}
            workspaceId={workspaceId as Id<"workspaces">}
            theme={theme}
          />
        ) : (
          <ConversationDetail
            conversationId={activeConversationId!}
            primaryColor={effectivePrimaryColor}
            theme={theme}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface ConversationListProps {
  onSelectConversation: (id: Id<"conversations">) => void;
  onNewConversation: (id: Id<"conversations">) => void;
  primaryColor: string;
  workspaceId: Id<"workspaces">;
  theme: import("../hooks/useMessengerSettings").OpencomTheme;
}

function ConversationList({
  onSelectConversation,
  onNewConversation,
  primaryColor,
  workspaceId,
  theme,
}: ConversationListProps) {
  const { conversations, isLoading } = useConversations();
  const { createConversation } = useCreateConversation();

  const handleNewConversation = async () => {
    const result = await createConversation(workspaceId);
    if (result) {
      onNewConversation(result._id);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <View style={[styles.listContainer, { backgroundColor: theme.surfaceColor }]}>
      {isLoading ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>Loading...</Text>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: theme.textColor }]}>No conversations yet</Text>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            Start a new conversation to get help
          </Text>
          <TouchableOpacity
            onPress={handleNewConversation}
            style={[styles.startButton, { backgroundColor: primaryColor }]}
          >
            <Text style={[styles.startButtonText, { color: theme.textOnPrimary }]}>
              Start a conversation
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.conversationItem,
                { backgroundColor: theme.surfaceColor, borderBottomColor: theme.borderColor },
              ]}
              onPress={() => onSelectConversation(item._id)}
            >
              <View style={styles.conversationContent}>
                <Text style={[styles.conversationTitle, { color: theme.textColor }]}>
                  Conversation
                </Text>
                <Text
                  style={[styles.conversationMessage, { color: theme.textMuted }]}
                  numberOfLines={1}
                >
                  {item.lastMessage?.content || "No messages yet"}
                </Text>
              </View>
              <View style={styles.conversationMeta}>
                {item.unreadByVisitor && item.unreadByVisitor > 0 && (
                  <View style={[styles.unreadBadge, { backgroundColor: primaryColor }]}>
                    <Text style={[styles.unreadText, { color: theme.textOnPrimary }]}>
                      {item.unreadByVisitor}
                    </Text>
                  </View>
                )}
                <Text style={[styles.conversationTime, { color: theme.textMuted }]}>
                  {item.lastMessageAt ? formatTime(item.lastMessageAt) : formatTime(item.createdAt)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListHeaderComponent={
            <View style={styles.newConversationContainer}>
              <TouchableOpacity
                onPress={handleNewConversation}
                style={[styles.newConversationButton, { backgroundColor: primaryColor }]}
              >
                <Text style={[styles.newConversationButtonIcon, { color: theme.textOnPrimary }]}>
                  +
                </Text>
                <Text style={[styles.newConversationButtonText, { color: theme.textOnPrimary }]}>
                  New Conversation
                </Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

interface ConversationDetailProps {
  conversationId: Id<"conversations">;
  primaryColor: string;
  theme: import("../hooks/useMessengerSettings").OpencomTheme;
}

function ConversationDetail({ conversationId, primaryColor, theme }: ConversationDetailProps) {
  const { messages, isLoading, sendMessage, markAsRead } = useConversation(conversationId);
  const state = OpencomSDK.getVisitorState();
  const visitorId = state.visitorId;
  const automationSettings = useAutomationSettings();
  const identifyVisitor = useMutation(api.visitors.identify);

  const [inputValue, setInputValue] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [emailCaptured, setEmailCaptured] = useState(false);
  const [lastAgentMessageCount, setLastAgentMessageCount] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // Check if visitor has sent any messages
  const visitorMessages = messages.filter((m) => m.senderType === "visitor");
  const hasVisitorSentMessage = visitorMessages.length > 0;

  useEffect(() => {
    markAsRead();
  }, [conversationId]);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  // Smart email capture: show after first visitor message if collectEmailEnabled
  useEffect(() => {
    if (!visitorId || emailCaptured) return;
    if (!hasVisitorSentMessage) return;
    if (!automationSettings?.collectEmailEnabled) return;

    const agentMessages = messages.filter((m) => m.senderType !== "visitor");
    const agentCount = agentMessages.length;

    // Show email capture after visitor sends first message
    if (!showEmailCapture && !emailCaptured) {
      setShowEmailCapture(true);
      return;
    }

    // Re-show after new agent reply if previously dismissed
    if (agentCount > lastAgentMessageCount && !emailCaptured) {
      setShowEmailCapture(true);
    }
    setLastAgentMessageCount(agentCount);
  }, [
    visitorId,
    hasVisitorSentMessage,
    messages,
    emailCaptured,
    lastAgentMessageCount,
    automationSettings?.collectEmailEnabled,
    showEmailCapture,
  ]);

  const handleEmailSubmit = async () => {
    if (!emailInput.trim() || !visitorId) return;
    try {
      await identifyVisitor({
        visitorId: visitorId as Id<"visitors">,
        sessionToken: state.sessionToken ?? undefined,
        email: emailInput.trim(),
        origin: undefined,
      });
      setShowEmailCapture(false);
      setEmailCaptured(true);
      setEmailInput("");
    } catch (error) {
      console.error("[Opencom] Failed to update email:", error);
    }
  };

  const handleEmailDismiss = () => {
    setShowEmailCapture(false);
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    const content = inputValue;
    setInputValue("");
    await sendMessage(content);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  return (
    <View style={[styles.detailContainer, { backgroundColor: theme.surfaceColor }]}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item._id}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageBubble,
              item.senderType === "visitor"
                ? [styles.userMessage, { backgroundColor: primaryColor }]
                : [styles.agentMessage, { backgroundColor: theme.mutedColor }],
            ]}
          >
            <Text
              style={[
                styles.messageText,
                { color: item.senderType === "visitor" ? theme.textOnPrimary : theme.textColor },
              ]}
            >
              {item.content}
            </Text>
            <Text
              style={[
                styles.messageTime,
                {
                  color: item.senderType === "visitor" ? "rgba(255,255,255,0.7)" : theme.textMuted,
                },
              ]}
            >
              {formatTime(item._creationTime)}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <Text style={[styles.loadingText, { color: theme.textMuted }]}>
              Loading messages...
            </Text>
          ) : (
            <View style={[styles.welcomeMessage, { backgroundColor: theme.mutedColor }]}>
              <Text style={styles.welcomeText}>Hi! How can we help you today?</Text>
            </View>
          )
        }
      />

      {/* In-conversation email capture */}
      {showEmailCapture && (
        <View
          style={[
            styles.emailCaptureContainer,
            { backgroundColor: theme.mutedColor, borderTopColor: theme.borderColor },
          ]}
        >
          <Text style={[styles.emailCaptureText, { color: theme.textMuted }]}>
            Get notified when we reply:
          </Text>
          <View style={styles.emailCaptureRow}>
            <TextInput
              style={[
                styles.emailInput,
                {
                  backgroundColor: theme.surfaceColor,
                  borderColor: theme.borderColor,
                  color: theme.textColor,
                },
              ]}
              value={emailInput}
              onChangeText={setEmailInput}
              placeholder="Enter your email..."
              placeholderTextColor={theme.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              onPress={handleEmailSubmit}
              style={[styles.emailSubmitButton, { backgroundColor: primaryColor }]}
              disabled={!isValidEmail(emailInput)}
            >
              <Text style={[styles.emailSubmitText, { color: theme.textOnPrimary }]}>Save</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={handleEmailDismiss} style={styles.emailSkipButton}>
            <Text style={[styles.emailSkipText, { color: theme.textMuted }]}>Skip</Text>
          </TouchableOpacity>
        </View>
      )}

      <View
        style={[
          styles.inputContainer,
          { borderTopColor: theme.borderColor, backgroundColor: theme.surfaceColor },
        ]}
      >
        <TextInput
          style={[styles.input, { backgroundColor: theme.mutedColor, color: theme.textColor }]}
          value={inputValue}
          onChangeText={setInputValue}
          placeholder="Type a message..."
          placeholderTextColor={theme.textMuted}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          onPress={handleSend}
          style={[styles.sendButton, { backgroundColor: primaryColor }]}
          disabled={!inputValue.trim()}
        >
          <Text style={[styles.sendButtonText, { color: theme.textOnPrimary }]}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  keyboardView: {
    flex: 1,
  },
  listContainer: {
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
    color: "#FFFFFF",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerLogo: {
    width: 28,
    height: 28,
    borderRadius: 4,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: "500",
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
  conversationItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    backgroundColor: "#FFFFFF",
  },
  conversationContent: {
    flex: 1,
    marginRight: 12,
  },
  conversationMessage: {
    flex: 1,
    fontSize: 15,
    color: "#333333",
  },
  conversationMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  conversationTime: {
    fontSize: 12,
    color: "#999999",
  },
  unreadBadge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  unreadText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userMessage: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  agentMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#F0F0F0",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: "#000000",
  },
  userMessageText: {
    color: "#FFFFFF",
  },
  messageTime: {
    fontSize: 11,
    color: "#666666",
    marginTop: 4,
  },
  userMessageTime: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  loadingText: {
    textAlign: "center",
    color: "#666666",
    marginTop: 20,
  },
  welcomeMessage: {
    backgroundColor: "#F0F0F0",
    padding: 12,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    alignSelf: "flex-start",
  },
  welcomeText: {
    fontSize: 15,
    color: "#000000",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  conversationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 2,
  },
  newConversationContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  newConversationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  newConversationButtonIcon: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "600",
  },
  newConversationButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  emailCaptureContainer: {
    backgroundColor: "#F8F9FA",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
  },
  emailCaptureText: {
    fontSize: 13,
    color: "#666666",
    marginBottom: 8,
  },
  emailCaptureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emailInput: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  emailSubmitButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  emailSubmitText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  emailSkipButton: {
    marginTop: 8,
    alignSelf: "center",
  },
  emailSkipText: {
    color: "#999999",
    fontSize: 13,
  },
});
