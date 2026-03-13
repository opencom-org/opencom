import {
  buildUnreadSnapshot,
  getUnreadIncreases,
  loadCuePreferences,
  shouldSuppressUnreadAttentionCue,
  type CuePreferenceAdapter,
} from "@opencom/web-shared";

export interface WidgetCuePreferences {
  browserNotifications: boolean;
  sound: boolean;
}

const STORAGE_KEY = "opencom.widget.notificationCues";
const DEFAULT_PREFERENCES: WidgetCuePreferences = {
  browserNotifications: true,
  sound: false,
};

const WIDGET_CUE_PREFERENCES_ADAPTER: CuePreferenceAdapter = {
  storageKey: STORAGE_KEY,
  defaults: DEFAULT_PREFERENCES,
  missingFieldBehavior: "defaultValue",
};

type StorageLike = Pick<Storage, "getItem">;

export function loadWidgetCuePreferences(storage?: StorageLike): WidgetCuePreferences {
  return loadCuePreferences(WIDGET_CUE_PREFERENCES_ADAPTER, storage);
}

export function buildWidgetUnreadSnapshot(
  conversations: Array<{ _id: string; unreadByVisitor?: number }>
): Record<string, number> {
  return buildUnreadSnapshot({
    conversations,
    getUnreadCount: (conversation) => conversation.unreadByVisitor,
  });
}

export function getWidgetUnreadIncreases(args: {
  previous: Record<string, number>;
  conversations: Array<{ _id: string; unreadByVisitor?: number }>;
}): string[] {
  return getUnreadIncreases({
    previous: args.previous,
    conversations: args.conversations,
    getUnreadCount: (conversation) => conversation.unreadByVisitor,
  });
}

export function shouldSuppressWidgetCue(args: {
  conversationId: string;
  activeConversationId: string | null;
  widgetView: "launcher" | "conversation-list" | "conversation";
  isDocumentVisible: boolean;
  hasWindowFocus: boolean;
}): boolean {
  return shouldSuppressUnreadAttentionCue({
    conversationId: args.conversationId,
    activeConversationId: args.activeConversationId,
    isActiveConversationView: args.widgetView === "conversation",
    isDocumentVisible: args.isDocumentVisible,
    hasWindowFocus: args.hasWindowFocus,
  });
}
