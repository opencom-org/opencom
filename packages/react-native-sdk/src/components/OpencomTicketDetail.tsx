import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTicket, type TicketId, type TicketStatus } from "../hooks/useTickets";
import { useMessengerSettings } from "../hooks/useMessengerSettings";

interface OpencomTicketDetailProps {
  ticketId: TicketId;
  onBack?: () => void;
  style?: object;
}

const STATUS_COLORS: Record<TicketStatus, string> = {
  submitted: "#792cd4",
  in_progress: "#F59E0B",
  waiting_on_customer: "#8B5CF6",
  resolved: "#10B981",
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  submitted: "Submitted",
  in_progress: "In Progress",
  waiting_on_customer: "Waiting on You",
  resolved: "Resolved",
};

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

export function OpencomTicketDetail({ ticketId, onBack, style }: OpencomTicketDetailProps) {
  const { theme } = useMessengerSettings();
  const { ticket, comments, isLoading, addComment } = useTicket(ticketId);
  const [newComment, setNewComment] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSendComment = async () => {
    if (!newComment.trim() || isSending) return;

    setIsSending(true);
    try {
      await addComment(newComment.trim());
      setNewComment("");
    } catch (error) {
      console.error("[OpencomTicketDetail] Failed to send comment:", error);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading || !ticket) {
    return (
      <View
        style={[styles.container, styles.centered, { backgroundColor: theme.surfaceColor }, style]}
      >
        <ActivityIndicator size="large" color={theme.primaryColor} />
      </View>
    );
  }

  const isResolved = ticket.status === "resolved";

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.surfaceColor }, style]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={[styles.backButtonText, { color: theme.primaryColor }]}>← Back</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { backgroundColor: theme.surfaceColor }]}>
          <Text style={[styles.subject, { color: theme.textColor }]}>{ticket.subject}</Text>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[ticket.status] }]}>
            <Text style={[styles.statusText, { color: theme.textOnPrimary }]}>
              {STATUS_LABELS[ticket.status]}
            </Text>
          </View>
        </View>

        {ticket.description && (
          <View style={[styles.descriptionContainer, { backgroundColor: theme.surfaceColor }]}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Description</Text>
            <Text style={[styles.description, { color: theme.textColor }]}>
              {ticket.description}
            </Text>
          </View>
        )}

        <View style={[styles.metaContainer, { backgroundColor: theme.mutedColor }]}>
          <Text style={[styles.metaText, { color: theme.textMuted }]}>
            Created: {formatDateTime(ticket.createdAt)}
          </Text>
          <Text style={[styles.metaText, { color: theme.textMuted }]}>
            Priority: {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
          </Text>
        </View>

        <View style={styles.commentsSection}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
            Comments ({comments.length})
          </Text>

          {comments.length === 0 ? (
            <Text style={[styles.noComments, { color: theme.textMuted }]}>No comments yet</Text>
          ) : (
            comments.map((comment) => (
              <View
                key={comment._id}
                style={[
                  styles.commentItem,
                  comment.authorType === "visitor"
                    ? [styles.visitorComment, { backgroundColor: theme.primaryColor }]
                    : [styles.agentComment, { backgroundColor: theme.mutedColor }],
                ]}
              >
                <View style={styles.commentHeader}>
                  <Text
                    style={[
                      styles.commentAuthor,
                      {
                        color:
                          comment.authorType === "visitor" ? theme.textOnPrimary : theme.textColor,
                      },
                    ]}
                  >
                    {comment.authorType === "visitor" ? "You" : "Support"}
                  </Text>
                  <Text
                    style={[
                      styles.commentTime,
                      {
                        color:
                          comment.authorType === "visitor"
                            ? "rgba(255,255,255,0.7)"
                            : theme.textMuted,
                      },
                    ]}
                  >
                    {formatDateTime(comment.createdAt)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.commentContent,
                    {
                      color:
                        comment.authorType === "visitor" ? theme.textOnPrimary : theme.textColor,
                    },
                  ]}
                >
                  {comment.content}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {!isResolved && (
        <View
          style={[
            styles.inputContainer,
            { borderTopColor: theme.borderColor, backgroundColor: theme.surfaceColor },
          ]}
        >
          <TextInput
            style={[styles.input, { backgroundColor: theme.mutedColor, color: theme.textColor }]}
            value={newComment}
            onChangeText={setNewComment}
            placeholder="Add a comment..."
            placeholderTextColor={theme.textMuted}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: theme.primaryColor },
              (!newComment.trim() || isSending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendComment}
            disabled={!newComment.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={theme.textOnPrimary} />
            ) : (
              <Text style={[styles.sendButtonText, { color: theme.textOnPrimary }]}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  backButton: {
    padding: 16,
    paddingBottom: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: "#792cd4",
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  subject: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  descriptionContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 16,
    color: "#374151",
    lineHeight: 24,
  },
  metaContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  metaText: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  commentsSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  noComments: {
    fontSize: 14,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  commentItem: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  visitorComment: {
    backgroundColor: "#EBF5FF",
    marginLeft: 24,
  },
  agentComment: {
    backgroundColor: "#F3F4F6",
    marginRight: 24,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  commentTime: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  commentContent: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    color: "#111827",
  },
  sendButton: {
    backgroundColor: "#792cd4",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: "#c4a0e8",
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
