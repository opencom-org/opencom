import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { getVisitorState } from "@opencom/sdk-core";
import { useOpencomContext } from "./OpencomProvider";
import { useMessengerSettings } from "../hooks/useMessengerSettings";
import type { Id } from "@opencom/convex/dataModel";
import type { TicketPriority } from "../hooks/useTickets";

interface OpencomTicketCreateProps {
  onSuccess?: (ticketId: Id<"tickets">) => void;
  onCancel?: () => void;
  style?: object;
}

const PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function OpencomTicketCreate({ onSuccess, onCancel, style }: OpencomTicketCreateProps) {
  const { workspaceId } = useOpencomContext();
  const { theme } = useMessengerSettings();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTicketMutation = useMutation(api.tickets.create);

  const handleSubmit = async () => {
    if (!subject.trim()) {
      setError("Please enter a subject");
      return;
    }

    const state = getVisitorState();
    if (!state.visitorId || !state.sessionToken) {
      setError("Not authenticated");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const ticketId = await createTicketMutation({
        workspaceId: workspaceId as Id<"workspaces">,
        visitorId: state.visitorId,
        sessionToken: state.sessionToken,
        subject: subject.trim(),
        description: description.trim() || undefined,
        priority,
      });

      onSuccess?.(ticketId);
    } catch (err) {
      console.error("[OpencomTicketCreate] Failed to create ticket:", err);
      setError("Failed to create ticket. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, style]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Create New Ticket</Text>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Subject *</Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder="Brief summary of your issue"
            placeholderTextColor="#9CA3AF"
            maxLength={200}
            autoFocus
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Provide more details about your issue..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={5}
            maxLength={2000}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Priority</Text>
          <View style={styles.priorityContainer}>
            {PRIORITIES.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[
                  styles.priorityButton,
                  priority === p.value && {
                    backgroundColor: theme.primaryColor,
                    borderColor: theme.primaryColor,
                  },
                ]}
                onPress={() => setPriority(p.value)}
              >
                <Text
                  style={[
                    styles.priorityButtonText,
                    priority === p.value && { color: theme.textOnPrimary },
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {onCancel && (
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={isSubmitting}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: theme.primaryColor },
            (!subject.trim() || isSubmitting) && { opacity: 0.6 },
          ]}
          onPress={handleSubmit}
          disabled={!subject.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={theme.textOnPrimary} />
          ) : (
            <Text style={[styles.submitButtonText, { color: theme.textOnPrimary }]}>
              Create Ticket
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 24,
  },
  errorContainer: {
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
  priorityContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  priorityButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  priorityButtonActive: {
    backgroundColor: "#792cd4",
    borderColor: "#792cd4",
  },
  priorityButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  priorityButtonTextActive: {
    color: "#FFFFFF",
  },
  footer: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
  },
  submitButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "#792cd4",
  },
  submitButtonDisabled: {
    backgroundColor: "#c4a0e8",
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
});
