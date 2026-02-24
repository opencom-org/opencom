export interface InboxCuePreferences {
  browserNotifications: boolean;
  sound: boolean;
}

const STORAGE_KEY = "opencom.web.inboxCuePreferences";
const DEFAULT_PREFERENCES: InboxCuePreferences = {
  browserNotifications: false,
  sound: false,
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadInboxCuePreferences(storage?: StorageLike): InboxCuePreferences {
  if (!storage) {
    return { ...DEFAULT_PREFERENCES };
  }

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return { ...DEFAULT_PREFERENCES };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<InboxCuePreferences>;
    return {
      browserNotifications: parsed.browserNotifications === true,
      sound: parsed.sound === true,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function saveInboxCuePreferences(
  preferences: InboxCuePreferences,
  storage?: StorageLike
): void {
  if (!storage) {
    return;
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export function buildUnreadSnapshot(
  conversations: Array<{ _id: string; unreadByAgent?: number }>
): Record<string, number> {
  return Object.fromEntries(
    conversations.map((conversation) => [conversation._id, conversation.unreadByAgent ?? 0])
  );
}

export function getUnreadIncreases(args: {
  previous: Record<string, number>;
  conversations: Array<{ _id: string; unreadByAgent?: number }>;
}): string[] {
  const increasedConversationIds: string[] = [];
  for (const conversation of args.conversations) {
    const previousUnread = args.previous[conversation._id] ?? 0;
    const nextUnread = conversation.unreadByAgent ?? 0;
    if (nextUnread > previousUnread) {
      increasedConversationIds.push(conversation._id);
    }
  }
  return increasedConversationIds;
}

export function shouldSuppressAttentionCue(args: {
  conversationId: string;
  selectedConversationId: string | null;
  isDocumentVisible: boolean;
  hasWindowFocus: boolean;
}): boolean {
  return (
    args.selectedConversationId === args.conversationId &&
    args.isDocumentVisible &&
    args.hasWindowFocus
  );
}
