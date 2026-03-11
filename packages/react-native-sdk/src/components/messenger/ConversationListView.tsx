import React from "react";
import { View, Text, TouchableOpacity, FlatList } from "react-native";
import type { Id } from "@opencom/convex/dataModel";
import type { OpencomTheme } from "../../hooks/useMessengerSettings";
import { messengerStyles } from "./styles";

interface ConversationListItem {
  _id: Id<"conversations">;
  createdAt: number;
  lastMessageAt?: number;
  unreadByVisitor?: number;
  lastMessage?: {
    content?: string;
  } | null;
}

interface ConversationListViewProps {
  conversations: ConversationListItem[];
  isLoading: boolean;
  onSelectConversation: (conversationId: Id<"conversations">) => void;
  onStartConversation: () => Promise<void>;
  formatConversationTimestamp: (timestamp: number) => string;
  primaryColor: string;
  theme: OpencomTheme;
}

export function ConversationListView({
  conversations,
  isLoading,
  onSelectConversation,
  onStartConversation,
  formatConversationTimestamp,
  primaryColor,
  theme,
}: ConversationListViewProps) {
  if (isLoading) {
    return (
      <View style={messengerStyles.emptyContainer}>
        <Text style={[messengerStyles.emptyText, { color: theme.textMuted }]}>Loading...</Text>
      </View>
    );
  }

  if (conversations.length === 0) {
    return (
      <View style={messengerStyles.emptyContainer}>
        <Text style={[messengerStyles.emptyTitle, { color: theme.textColor }]}>No conversations yet</Text>
        <Text style={[messengerStyles.emptyText, { color: theme.textMuted }]}>
          Start a new conversation to get help
        </Text>
        <TouchableOpacity
          onPress={onStartConversation}
          style={[messengerStyles.startButton, { backgroundColor: primaryColor }]}
        >
          <Text style={[messengerStyles.startButtonText, { color: theme.textOnPrimary }]}>
            Start a conversation
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={conversations}
      keyExtractor={(item) => item._id}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[
            messengerStyles.conversationItem,
            { backgroundColor: theme.surfaceColor, borderBottomColor: theme.borderColor },
          ]}
          onPress={() => onSelectConversation(item._id)}
        >
          <View style={messengerStyles.conversationContent}>
            <Text style={[messengerStyles.conversationTitle, { color: theme.textColor }]}>Conversation</Text>
            <Text
              style={[messengerStyles.conversationMessage, { color: theme.textMuted }]}
              numberOfLines={1}
            >
              {item.lastMessage?.content || "No messages yet"}
            </Text>
          </View>
          <View style={messengerStyles.conversationMeta}>
            {item.unreadByVisitor && item.unreadByVisitor > 0 && (
              <View style={[messengerStyles.unreadBadge, { backgroundColor: primaryColor }]}>
                <Text style={[messengerStyles.unreadText, { color: theme.textOnPrimary }]}>
                  {item.unreadByVisitor}
                </Text>
              </View>
            )}
            <Text style={[messengerStyles.conversationTime, { color: theme.textMuted }]}>
              {item.lastMessageAt
                ? formatConversationTimestamp(item.lastMessageAt)
                : formatConversationTimestamp(item.createdAt)}
            </Text>
          </View>
        </TouchableOpacity>
      )}
      ListHeaderComponent={
        <View style={messengerStyles.newConversationContainer}>
          <TouchableOpacity
            onPress={onStartConversation}
            style={[messengerStyles.newConversationButton, { backgroundColor: primaryColor }]}
          >
            <Text style={[messengerStyles.newConversationButtonIcon, { color: theme.textOnPrimary }]}>+</Text>
            <Text style={[messengerStyles.newConversationButtonText, { color: theme.textOnPrimary }]}>
              New Conversation
            </Text>
          </TouchableOpacity>
        </View>
      }
    />
  );
}
