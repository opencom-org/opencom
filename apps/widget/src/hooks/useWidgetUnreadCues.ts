import { useCallback, useEffect, useRef } from "react";
import type { Id } from "@opencom/convex/dataModel";
import {
  buildWidgetUnreadSnapshot,
  getWidgetUnreadIncreases,
  loadWidgetCuePreferences,
  shouldSuppressWidgetCue,
} from "../lib/widgetNotificationCues";

type ConversationForUnreadCue = {
  _id: Id<"conversations">;
  unreadByVisitor?: number;
  lastMessage?: {
    content?: string | null;
  } | null;
};

interface UseWidgetUnreadCuesOptions {
  conversationId: Id<"conversations"> | null;
  view: string;
  visitorConversations: ConversationForUnreadCue[] | undefined;
  onOpenConversation: (conversationId: Id<"conversations">) => void;
}

function playWidgetCueSound() {
  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return;
  }

  const context = new AudioContextCtor();
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(740, context.currentTime);
  gainNode.gain.setValueAtTime(0.045, context.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.16);
  oscillator.onended = () => {
    void context.close();
  };
}

export function useWidgetUnreadCues({
  conversationId,
  view,
  visitorConversations,
  onOpenConversation,
}: UseWidgetUnreadCuesOptions) {
  const widgetCuePreferencesRef = useRef({
    browserNotifications: true,
    sound: false,
  });
  const unreadSnapshotRef = useRef<Record<string, number> | null>(null);

  useEffect(() => {
    const refreshCuePreferences = () => {
      widgetCuePreferencesRef.current = loadWidgetCuePreferences(window.localStorage);
    };
    refreshCuePreferences();
    window.addEventListener("storage", refreshCuePreferences);
    return () => {
      window.removeEventListener("storage", refreshCuePreferences);
    };
  }, []);

  useEffect(() => {
    if (!visitorConversations) {
      return;
    }

    const previousSnapshot = unreadSnapshotRef.current;
    const currentSnapshot = buildWidgetUnreadSnapshot(
      visitorConversations.map((conversation) => ({
        _id: conversation._id,
        unreadByVisitor: conversation.unreadByVisitor,
      }))
    );
    unreadSnapshotRef.current = currentSnapshot;

    if (!previousSnapshot) {
      return;
    }

    const increasedConversationIds = getWidgetUnreadIncreases({
      previous: previousSnapshot,
      conversations: visitorConversations.map((conversation) => ({
        _id: conversation._id,
        unreadByVisitor: conversation.unreadByVisitor,
      })),
    });
    if (increasedConversationIds.length === 0) {
      return;
    }

    const cueView =
      view === "conversation" || view === "launcher" ? view : ("conversation-list" as const);

    for (const increasedConversationId of increasedConversationIds) {
      const conversation = visitorConversations.find((entry) => entry._id === increasedConversationId);
      if (!conversation) {
        continue;
      }

      const suppressCue = shouldSuppressWidgetCue({
        conversationId: increasedConversationId,
        activeConversationId: conversationId,
        widgetView: cueView,
        isDocumentVisible: document.visibilityState === "visible",
        hasWindowFocus: document.hasFocus(),
      });
      if (suppressCue) {
        continue;
      }

      const preferences = widgetCuePreferencesRef.current;
      if (preferences.sound) {
        playWidgetCueSound();
      }

      if (
        preferences.browserNotifications &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const notification = new Notification("New message from support", {
          body: conversation.lastMessage?.content ?? "Tap to open the conversation.",
          tag: `opencom-widget-${conversation._id}`,
        });
        notification.onclick = () => {
          window.focus();
          onOpenConversation(conversation._id);
        };
      }
    }
  }, [conversationId, onOpenConversation, view, visitorConversations]);

  const resetUnreadSnapshot = useCallback(() => {
    unreadSnapshotRef.current = null;
  }, []);

  return {
    resetUnreadSnapshot,
  };
}
