export interface WidgetCuePreferences {
  browserNotifications: boolean;
  sound: boolean;
}

const STORAGE_KEY = "opencom.widget.notificationCues";
const DEFAULT_PREFERENCES: WidgetCuePreferences = {
  browserNotifications: true,
  sound: false,
};

type StorageLike = Pick<Storage, "getItem">;

export function loadWidgetCuePreferences(storage?: StorageLike): WidgetCuePreferences {
  if (!storage) {
    return { ...DEFAULT_PREFERENCES };
  }

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return { ...DEFAULT_PREFERENCES };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<WidgetCuePreferences>;
    return {
      browserNotifications:
        parsed.browserNotifications !== undefined
          ? parsed.browserNotifications === true
          : DEFAULT_PREFERENCES.browserNotifications,
      sound: parsed.sound !== undefined ? parsed.sound === true : DEFAULT_PREFERENCES.sound,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function buildWidgetUnreadSnapshot(
  conversations: Array<{ _id: string; unreadByVisitor?: number }>
): Record<string, number> {
  return Object.fromEntries(
    conversations.map((conversation) => [conversation._id, conversation.unreadByVisitor ?? 0])
  );
}

export function getWidgetUnreadIncreases(args: {
  previous: Record<string, number>;
  conversations: Array<{ _id: string; unreadByVisitor?: number }>;
}): string[] {
  const increasedConversationIds: string[] = [];
  for (const conversation of args.conversations) {
    const previousUnread = args.previous[conversation._id] ?? 0;
    const nextUnread = conversation.unreadByVisitor ?? 0;
    if (nextUnread > previousUnread) {
      increasedConversationIds.push(conversation._id);
    }
  }
  return increasedConversationIds;
}

export function shouldSuppressWidgetCue(args: {
  conversationId: string;
  activeConversationId: string | null;
  widgetView: "launcher" | "conversation-list" | "conversation";
  isDocumentVisible: boolean;
  hasWindowFocus: boolean;
}): boolean {
  return (
    args.widgetView === "conversation" &&
    args.activeConversationId === args.conversationId &&
    args.isDocumentVisible &&
    args.hasWindowFocus
  );
}
