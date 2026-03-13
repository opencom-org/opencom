import { useEffect, useRef } from "react";
import type { Id } from "@opencom/convex/dataModel";
import {
  INBOX_CUE_PREFERENCES_UPDATED_EVENT,
  buildUnreadSnapshot,
  getUnreadIncreases,
  loadInboxCuePreferences,
  shouldSuppressAttentionCue,
} from "@/lib/inboxNotificationCues";
import { playInboxBingSound } from "@/lib/playInboxBingSound";

type InboxCueConversation = {
  _id: Id<"conversations">;
  unreadByAgent?: number;
  lastMessage?: {
    content?: string | null;
  } | null;
  visitor?: { name?: string; email?: string; readableId?: string } | null;
  visitorId?: Id<"visitors">;
};

export interface UseInboxAttentionCuesArgs {
  conversations: InboxCueConversation[] | undefined;
  selectedConversationId: Id<"conversations"> | null;
  getConversationIdentityLabel: (conversation: InboxCueConversation) => string;
  onOpenConversation: (conversationId: Id<"conversations">) => void;
}

export function computeInboxTitle(args: {
  totalUnread: number;
  baseTitle: string;
}): string {
  return args.totalUnread > 0 ? `(${args.totalUnread}) ${args.baseTitle}` : args.baseTitle;
}

export function getUnsuppressedUnreadIncreases(args: {
  increasedConversationIds: string[];
  selectedConversationId: string | null;
  isDocumentVisible: boolean;
  hasWindowFocus: boolean;
}): string[] {
  return args.increasedConversationIds.filter(
    (conversationId) =>
      !shouldSuppressAttentionCue({
        conversationId,
        selectedConversationId: args.selectedConversationId,
        isDocumentVisible: args.isDocumentVisible,
        hasWindowFocus: args.hasWindowFocus,
      })
  );
}

export function useInboxAttentionCues({
  conversations,
  selectedConversationId,
  getConversationIdentityLabel,
  onOpenConversation,
}: UseInboxAttentionCuesArgs): void {
  const inboxCuePreferencesRef = useRef<{
    browserNotifications: boolean;
    sound: boolean;
  }>({
    browserNotifications: false,
    sound: true,
  });
  const unreadSnapshotRef = useRef<Record<string, number> | null>(null);
  const defaultTitleRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const refreshCuePreferences = () => {
      inboxCuePreferencesRef.current = loadInboxCuePreferences(window.localStorage);
    };
    refreshCuePreferences();
    window.addEventListener("storage", refreshCuePreferences);
    window.addEventListener(INBOX_CUE_PREFERENCES_UPDATED_EVENT, refreshCuePreferences);
    return () => {
      window.removeEventListener("storage", refreshCuePreferences);
      window.removeEventListener(INBOX_CUE_PREFERENCES_UPDATED_EVENT, refreshCuePreferences);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (!defaultTitleRef.current) {
      defaultTitleRef.current = document.title;
    }

    const totalUnread =
      conversations?.reduce((sum, conversation) => sum + (conversation.unreadByAgent ?? 0), 0) ?? 0;
    const baseTitle = defaultTitleRef.current || "Inbox";
    document.title = computeInboxTitle({ totalUnread, baseTitle });
  }, [conversations]);

  useEffect(() => {
    return () => {
      if (typeof document !== "undefined" && defaultTitleRef.current) {
        document.title = defaultTitleRef.current;
      }
    };
  }, []);

  useEffect(() => {
    if (!conversations || typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const previousSnapshot = unreadSnapshotRef.current;
    const currentSnapshot = buildUnreadSnapshot(
      conversations.map((conversation) => ({
        _id: conversation._id,
        unreadByAgent: conversation.unreadByAgent,
      }))
    );
    unreadSnapshotRef.current = currentSnapshot;

    if (!previousSnapshot) {
      return;
    }

    const increasedConversationIds = getUnreadIncreases({
      previous: previousSnapshot,
      conversations: conversations.map((conversation) => ({
        _id: conversation._id,
        unreadByAgent: conversation.unreadByAgent,
      })),
    });
    if (increasedConversationIds.length === 0) {
      return;
    }

    const unsuppressedConversationIds = getUnsuppressedUnreadIncreases({
      increasedConversationIds,
      selectedConversationId,
      isDocumentVisible: document.visibilityState === "visible",
      hasWindowFocus: document.hasFocus(),
    });

    for (const conversationId of unsuppressedConversationIds) {
      const conversation = conversations.find((item) => item._id === conversationId);
      if (!conversation) {
        continue;
      }

      const preferences = inboxCuePreferencesRef.current;
      if (preferences.sound) {
        playInboxBingSound();
      }

      if (
        preferences.browserNotifications &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const notification = new Notification("New inbox message", {
          body: `${getConversationIdentityLabel(conversation)}: ${conversation.lastMessage?.content ?? "Open inbox to view details."}`,
          tag: `opencom-inbox-${conversation._id}`,
        });
        notification.onclick = () => {
          window.focus();
          onOpenConversation(conversation._id);
        };
      }
    }
  }, [conversations, getConversationIdentityLabel, onOpenConversation, selectedConversationId]);
}
