import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { useAuth } from "../../../src/contexts/AuthContext";
import type { Id } from "@opencom/convex/dataModel";

interface Message {
  _id: string;
  content: string;
  senderType: "user" | "visitor" | "agent" | "bot";
  createdAt: number;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [inputText, setInputText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const conversation = useQuery(
    api.conversations.get,
    id ? { id: id as Id<"conversations"> } : "skip"
  );

  const visitor = useQuery(
    api.visitors.get,
    conversation?.visitorId ? { id: conversation.visitorId } : "skip"
  );

  const messages = useQuery(
    api.messages.list,
    id ? { conversationId: id as Id<"conversations"> } : "skip"
  );

  const sendMessage = useMutation(api.messages.send);
  const updateStatus = useMutation(api.conversations.updateStatus);
  const markAsRead = useMutation(api.conversations.markAsRead);

  // Mark conversation as read when viewing
  useEffect(() => {
    if (id && conversation) {
      markAsRead({ id: id as Id<"conversations">, readerType: "agent" }).catch(console.error);
    }
  }, [id, conversation, markAsRead]);

  useEffect(() => {
    if (messages && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || !id || !user) return;

    const content = inputText.trim();
    setInputText("");

    try {
      await sendMessage({
        conversationId: id as Id<"conversations">,
        senderId: user._id,
        senderType: "agent",
        content,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      setInputText(content);
    }
  };

  const handleStatusChange = async (status: "open" | "closed" | "snoozed") => {
    if (!id) return;
    try {
      await updateStatus({
        id: id as Id<"conversations">,
        status,
      });
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isAgent = item.senderType === "agent" || item.senderType === "bot";

    return (
      <View style={[styles.messageBubble, isAgent ? styles.agentMessage : styles.visitorMessage]}>
        <Text
          style={[
            styles.messageText,
            isAgent ? styles.agentMessageText : styles.visitorMessageText,
          ]}
        >
          {item.content}
        </Text>
        <Text style={styles.messageTime}>{formatTime(item.createdAt)}</Text>
      </View>
    );
  };

  if (!conversation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#792cd4" />
      </View>
    );
  }

  const visitorName = visitor?.name || visitor?.email || visitor?.readableId || "Anonymous Visitor";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      <View style={styles.visitorInfo}>
        <View style={styles.visitorHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{visitorName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.visitorDetails}>
            <Text style={styles.visitorName}>{visitorName}</Text>
            {visitor?.email && visitor.name && (
              <Text style={styles.visitorEmail}>{visitor.email}</Text>
            )}
            {visitor?.location && (
              <Text style={styles.visitorLocation}>
                📍 {[visitor.location.city, visitor.location.country].filter(Boolean).join(", ")}
              </Text>
            )}
            {visitor?.device && (
              <Text style={styles.visitorDevice}>
                💻 {visitor.device.browser} on {visitor.device.os}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.statusActions}>
          {(["open", "closed", "snoozed"] as const).map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.statusButton,
                conversation.status === status && styles.statusButtonActive,
              ]}
              onPress={() => handleStatusChange(status)}
            >
              <Text
                style={[
                  styles.statusButtonText,
                  conversation.status === status && styles.statusButtonTextActive,
                ]}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages as Message[] | undefined}
        renderItem={renderMessage}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  visitorInfo: {
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  visitorHeader: {
    flexDirection: "row",
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#792cd4",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  visitorDetails: {
    flex: 1,
  },
  visitorName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  visitorEmail: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  visitorLocation: {
    fontSize: 12,
    color: "#999",
  },
  visitorDevice: {
    fontSize: 12,
    color: "#999",
  },
  statusActions: {
    flexDirection: "row",
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
  },
  statusButtonActive: {
    backgroundColor: "#792cd4",
  },
  statusButtonText: {
    fontSize: 14,
    color: "#666",
  },
  statusButtonTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  messageList: {
    padding: 16,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  visitorMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  agentMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#792cd4",
  },
  messageText: {
    fontSize: 16,
  },
  visitorMessageText: {
    color: "#333",
  },
  agentMessageText: {
    color: "#fff",
  },
  messageTime: {
    fontSize: 10,
    color: "#999",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
  },
  input: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: "#792cd4",
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
