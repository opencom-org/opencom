import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useTickets, type TicketData, type TicketStatus } from "../hooks/useTickets";
import { useMessengerSettings } from "../hooks/useMessengerSettings";

interface OpencomTicketsProps {
  onTicketPress?: (ticket: TicketData) => void;
  onCreatePress?: () => void;
  emptyMessage?: string;
  showCreateButton?: boolean;
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

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

function TicketItem({
  ticket,
  onPress,
  theme,
}: {
  ticket: TicketData;
  onPress?: (ticket: TicketData) => void;
  theme: import("../hooks/useMessengerSettings").OpencomTheme;
}) {
  return (
    <TouchableOpacity
      style={[styles.ticketItem, { backgroundColor: theme.cardColor }]}
      onPress={() => onPress?.(ticket)}
      activeOpacity={0.7}
    >
      <View style={styles.ticketHeader}>
        <Text style={[styles.ticketSubject, { color: theme.textColor }]} numberOfLines={1}>
          {ticket.subject}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[ticket.status] }]}>
          <Text style={styles.statusText}>{STATUS_LABELS[ticket.status]}</Text>
        </View>
      </View>
      {ticket.description && (
        <Text style={[styles.ticketDescription, { color: theme.textMuted }]} numberOfLines={2}>
          {ticket.description}
        </Text>
      )}
      <Text style={[styles.ticketDate, { color: theme.textMuted }]}>
        Updated {formatDate(ticket.updatedAt)}
      </Text>
    </TouchableOpacity>
  );
}

export function OpencomTickets({
  onTicketPress,
  onCreatePress,
  showCreateButton = false,
  style,
}: OpencomTicketsProps) {
  const { tickets, isLoading } = useTickets();
  const { theme } = useMessengerSettings();

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, style]}>
        <ActivityIndicator size="large" color={theme.primaryColor} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surfaceColor }, style]}>
      {showCreateButton && (
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: theme.primaryColor }]}
          onPress={onCreatePress}
          activeOpacity={0.8}
        >
          <Text style={[styles.createButtonText, { color: theme.textOnPrimary }]}>
            + Create New Ticket
          </Text>
        </TouchableOpacity>
      )}

      {tickets.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🎫</Text>
          <Text style={[styles.emptyTitle, { color: theme.textColor }]}>No tickets yet</Text>
          <Text style={[styles.emptyDescription, { color: theme.textMuted }]}>
            Tickets created by Support will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TicketItem ticket={item} onPress={onTicketPress} theme={theme} />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
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
  createButton: {
    backgroundColor: "#792cd4",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  ticketItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  ticketSubject: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "500",
  },
  ticketDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
    lineHeight: 20,
  },
  ticketDate: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  emptyContainer: {
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
