import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@opencom/convex";
import { useAuth } from "../../src/contexts/AuthContext";
import { router } from "expo-router";
import { useState, useCallback } from "react";
import type { Id } from "@opencom/convex/dataModel";

interface ConversationItem {
  _id: string;
  visitorId?: string;
  status: "open" | "closed" | "snoozed";
  lastMessageAt?: number;
  createdAt: number;
  unreadByAgent?: number;
  visitor: {
    name?: string;
    email?: string;
    readableId?: string;
  } | null;
  lastMessage: {
    content: string;
    senderType: string;
    createdAt: number;
  } | null;
}

function PresenceIndicator({ visitorId }: { visitorId: string }) {
  const isOnline = useQuery(api.visitors.isOnline, { visitorId: visitorId as Id<"visitors"> });
  return (
    <View
      style={[styles.presenceIndicator, isOnline ? styles.presenceOnline : styles.presenceOffline]}
    />
  );
}

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function ConversationListItem({ item, onPress }: { item: ConversationItem; onPress: () => void }) {
  const visitorName =
    item.visitor?.name || item.visitor?.email || item.visitor?.readableId || "Anonymous Visitor";
  const lastMessagePreview = item.lastMessage?.content || "No messages yet";
  const time = formatTime(item.lastMessageAt || item.createdAt);

  return (
    <TouchableOpacity style={styles.conversationItem} onPress={onPress}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{visitorName.charAt(0).toUpperCase()}</Text>
        </View>
        {item.visitorId && <PresenceIndicator visitorId={item.visitorId} />}
      </View>
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.visitorName} numberOfLines={1}>
            {visitorName}
          </Text>
          <View style={styles.headerRight}>
            {item.unreadByAgent != null && item.unreadByAgent > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unreadByAgent}</Text>
              </View>
            ) : null}
            <Text style={styles.time}>{time}</Text>
          </View>
        </View>
        <Text style={styles.lastMessage} numberOfLines={2}>
          {lastMessagePreview}
        </Text>
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, styles[`status_${item.status}`]]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function InboxScreen() {
  const { activeWorkspaceId } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"open" | "closed" | "snoozed" | undefined>(
    undefined
  );

  const inboxPage = useQuery(
    api.conversations.listForInbox,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId, status: statusFilter } : "skip"
  );
  const conversations = (Array.isArray(inboxPage) ? inboxPage : inboxPage?.conversations) as
    | ConversationItem[]
    | undefined;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleConversationPress = (id: string) => {
    router.push({
      pathname: "/(app)/conversation/[id]",
      params: { id },
    });
  };

  const renderItem = ({ item }: { item: ConversationItem }) => (
    <ConversationListItem item={item} onPress={() => handleConversationPress(item._id)} />
  );

  return (
    <View style={styles.container}>
      <View style={styles.filterContainer}>
        {(["all", "open", "closed", "snoozed"] as const).map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterButton,
              (status === "all" ? !statusFilter : statusFilter === status) &&
                styles.filterButtonActive,
            ]}
            onPress={() => setStatusFilter(status === "all" ? undefined : status)}
          >
            <Text
              style={[
                styles.filterText,
                (status === "all" ? !statusFilter : statusFilter === status) &&
                  styles.filterTextActive,
              ]}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={conversations}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {inboxPage === undefined ? "Loading..." : "No conversations yet"}
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => router.push("/(app)/settings")}
      >
        <Text style={styles.settingsButtonText}>⚙️</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  filterContainer: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
  },
  filterButtonActive: {
    backgroundColor: "#792cd4",
  },
  filterText: {
    fontSize: 14,
    color: "#666",
  },
  filterTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  listContent: {
    flexGrow: 1,
  },
  conversationItem: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#792cd4",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  visitorName: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 12,
    color: "#999",
  },
  lastMessage: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: "row",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  status_open: {
    backgroundColor: "#dcfce7",
  },
  status_closed: {
    backgroundColor: "#f3f4f6",
  },
  status_snoozed: {
    backgroundColor: "#fef3c7",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
  },
  settingsButton: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  settingsButtonText: {
    fontSize: 24,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  presenceIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#fff",
  },
  presenceOnline: {
    backgroundColor: "#22c55e",
  },
  presenceOffline: {
    backgroundColor: "#d1d5db",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unreadBadge: {
    backgroundColor: "#792cd4",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: "center",
  },
  unreadText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
});
