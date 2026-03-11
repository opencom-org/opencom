import {
  buildUnreadSnapshot as buildSharedUnreadSnapshot,
  getUnreadIncreases as getSharedUnreadIncreases,
  loadCuePreferences,
  saveCuePreferences,
  shouldSuppressUnreadAttentionCue,
  type CuePreferenceAdapter,
} from "@opencom/web-shared";

export interface InboxCuePreferences {
  browserNotifications: boolean;
  sound: boolean;
}

const STORAGE_KEY = "opencom.web.inboxCuePreferences";
export const INBOX_CUE_PREFERENCES_UPDATED_EVENT = "opencom:inbox-cue-preferences-updated";
const DEFAULT_PREFERENCES: InboxCuePreferences = {
  browserNotifications: false,
  sound: true,
};

const INBOX_CUE_PREFERENCES_ADAPTER: CuePreferenceAdapter = {
  storageKey: STORAGE_KEY,
  defaults: DEFAULT_PREFERENCES,
  missingFieldBehavior: "strictTrue",
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadInboxCuePreferences(storage?: StorageLike): InboxCuePreferences {
  return loadCuePreferences(INBOX_CUE_PREFERENCES_ADAPTER, storage);
}

export function saveInboxCuePreferences(
  preferences: InboxCuePreferences,
  storage?: StorageLike
): void {
  saveCuePreferences(INBOX_CUE_PREFERENCES_ADAPTER, preferences, storage);
}

type EventDispatcher = Pick<Window, "dispatchEvent">;

export function broadcastInboxCuePreferencesUpdated(eventDispatcher?: EventDispatcher): void {
  if (!eventDispatcher) {
    return;
  }
  eventDispatcher.dispatchEvent(new Event(INBOX_CUE_PREFERENCES_UPDATED_EVENT));
}

export function buildUnreadSnapshot(
  conversations: Array<{ _id: string; unreadByAgent?: number }>
): Record<string, number> {
  return buildSharedUnreadSnapshot({
    conversations,
    getUnreadCount: (conversation) => conversation.unreadByAgent,
  });
}

export function getUnreadIncreases(args: {
  previous: Record<string, number>;
  conversations: Array<{ _id: string; unreadByAgent?: number }>;
}): string[] {
  return getSharedUnreadIncreases({
    previous: args.previous,
    conversations: args.conversations,
    getUnreadCount: (conversation) => conversation.unreadByAgent,
  });
}

export function shouldSuppressAttentionCue(args: {
  conversationId: string;
  selectedConversationId: string | null;
  isDocumentVisible: boolean;
  hasWindowFocus: boolean;
}): boolean {
  return shouldSuppressUnreadAttentionCue({
    conversationId: args.conversationId,
    activeConversationId: args.selectedConversationId,
    isActiveConversationView: true,
    isDocumentVisible: args.isDocumentVisible,
    hasWindowFocus: args.hasWindowFocus,
  });
}
