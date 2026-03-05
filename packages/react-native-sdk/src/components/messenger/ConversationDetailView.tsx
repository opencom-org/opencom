import React from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList } from "react-native";
import type { OpencomTheme } from "../../hooks/useMessengerSettings";
import { messengerStyles } from "./styles";

interface ConversationMessage {
  _id: string;
  _creationTime: number;
  senderType: "visitor" | string;
  content: string;
}

interface ConversationDetailViewProps {
  messages: ConversationMessage[];
  isLoading: boolean;
  primaryColor: string;
  theme: OpencomTheme;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => Promise<void>;
  emailInput: string;
  onEmailChange: (value: string) => void;
  showEmailCapture: boolean;
  onEmailSubmit: () => Promise<void>;
  onEmailDismiss: () => void;
  isValidEmail: (email: string) => boolean;
  flatListRef: React.RefObject<FlatList | null>;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ConversationDetailView({
  messages,
  isLoading,
  primaryColor,
  theme,
  inputValue,
  onInputChange,
  onSend,
  emailInput,
  onEmailChange,
  showEmailCapture,
  onEmailSubmit,
  onEmailDismiss,
  isValidEmail,
  flatListRef,
}: ConversationDetailViewProps) {
  return (
    <View style={[messengerStyles.detailContainer, { backgroundColor: theme.surfaceColor }]}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item._id}
        style={messengerStyles.messageList}
        contentContainerStyle={messengerStyles.messageListContent}
        renderItem={({ item }) => (
          <View
            style={[
              messengerStyles.messageBubble,
              item.senderType === "visitor"
                ? [messengerStyles.userMessage, { backgroundColor: primaryColor }]
                : [messengerStyles.agentMessage, { backgroundColor: theme.mutedColor }],
            ]}
          >
            <Text
              style={[
                messengerStyles.messageText,
                { color: item.senderType === "visitor" ? theme.textOnPrimary : theme.textColor },
              ]}
            >
              {item.content}
            </Text>
            <Text
              style={[
                messengerStyles.messageTime,
                {
                  color:
                    item.senderType === "visitor" ? "rgba(255,255,255,0.7)" : theme.textMuted,
                },
              ]}
            >
              {formatTime(item._creationTime)}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <Text style={[messengerStyles.loadingText, { color: theme.textMuted }]}>
              Loading messages...
            </Text>
          ) : (
            <View style={[messengerStyles.welcomeMessage, { backgroundColor: theme.mutedColor }]}>
              <Text style={messengerStyles.welcomeText}>Hi! How can we help you today?</Text>
            </View>
          )
        }
      />

      {showEmailCapture && (
        <View
          style={[
            messengerStyles.emailCaptureContainer,
            { backgroundColor: theme.mutedColor, borderTopColor: theme.borderColor },
          ]}
        >
          <Text style={[messengerStyles.emailCaptureText, { color: theme.textMuted }]}>
            Get notified when we reply:
          </Text>
          <View style={messengerStyles.emailCaptureRow}>
            <TextInput
              style={[
                messengerStyles.emailInput,
                {
                  backgroundColor: theme.surfaceColor,
                  borderColor: theme.borderColor,
                  color: theme.textColor,
                },
              ]}
              value={emailInput}
              onChangeText={onEmailChange}
              placeholder="Enter your email..."
              placeholderTextColor={theme.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              onPress={onEmailSubmit}
              style={[messengerStyles.emailSubmitButton, { backgroundColor: primaryColor }]}
              disabled={!isValidEmail(emailInput)}
            >
              <Text style={[messengerStyles.emailSubmitText, { color: theme.textOnPrimary }]}>
                Save
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={onEmailDismiss} style={messengerStyles.emailSkipButton}>
            <Text style={[messengerStyles.emailSkipText, { color: theme.textMuted }]}>Skip</Text>
          </TouchableOpacity>
        </View>
      )}

      <View
        style={[
          messengerStyles.inputContainer,
          { borderTopColor: theme.borderColor, backgroundColor: theme.surfaceColor },
        ]}
      >
        <TextInput
          style={[messengerStyles.input, { backgroundColor: theme.mutedColor, color: theme.textColor }]}
          value={inputValue}
          onChangeText={onInputChange}
          placeholder="Type a message..."
          placeholderTextColor={theme.textMuted}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          onPress={onSend}
          style={[messengerStyles.sendButton, { backgroundColor: primaryColor }]}
          disabled={!inputValue.trim()}
        >
          <Text style={[messengerStyles.sendButtonText, { color: theme.textOnPrimary }]}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
