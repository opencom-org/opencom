export interface CuePreferences {
  browserNotifications: boolean;
  sound: boolean;
}

export interface CuePreferenceAdapter {
  storageKey: string;
  defaults: CuePreferences;
  missingFieldBehavior: "strictTrue" | "defaultValue";
}

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;

type ConversationWithId = { _id: string };

function readBooleanValue(args: {
  parsedValue: unknown;
  defaultValue: boolean;
  behavior: CuePreferenceAdapter["missingFieldBehavior"];
}): boolean {
  if (args.parsedValue === undefined) {
    return args.behavior === "defaultValue" ? args.defaultValue : false;
  }
  return args.parsedValue === true;
}

export function loadCuePreferences(
  adapter: CuePreferenceAdapter,
  storage?: StorageReader
): CuePreferences {
  if (!storage) {
    return { ...adapter.defaults };
  }

  const raw = storage.getItem(adapter.storageKey);
  if (!raw) {
    return { ...adapter.defaults };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CuePreferences>;
    return {
      browserNotifications: readBooleanValue({
        parsedValue: parsed.browserNotifications,
        defaultValue: adapter.defaults.browserNotifications,
        behavior: adapter.missingFieldBehavior,
      }),
      sound: readBooleanValue({
        parsedValue: parsed.sound,
        defaultValue: adapter.defaults.sound,
        behavior: adapter.missingFieldBehavior,
      }),
    };
  } catch {
    return { ...adapter.defaults };
  }
}

export function saveCuePreferences(
  adapter: CuePreferenceAdapter,
  preferences: CuePreferences,
  storage?: StorageWriter
): void {
  if (!storage) {
    return;
  }

  storage.setItem(adapter.storageKey, JSON.stringify(preferences));
}

export function buildUnreadSnapshot<TConversation extends ConversationWithId>(args: {
  conversations: TConversation[];
  getUnreadCount: (conversation: TConversation) => number | undefined;
}): Record<string, number> {
  return Object.fromEntries(
    args.conversations.map((conversation) => [conversation._id, args.getUnreadCount(conversation) ?? 0])
  );
}

export function getUnreadIncreases<TConversation extends ConversationWithId>(args: {
  previous: Record<string, number>;
  conversations: TConversation[];
  getUnreadCount: (conversation: TConversation) => number | undefined;
}): string[] {
  const increasedConversationIds: string[] = [];
  for (const conversation of args.conversations) {
    const previousUnread = args.previous[conversation._id] ?? 0;
    const nextUnread = args.getUnreadCount(conversation) ?? 0;
    if (nextUnread > previousUnread) {
      increasedConversationIds.push(conversation._id);
    }
  }
  return increasedConversationIds;
}

export function shouldSuppressUnreadAttentionCue(args: {
  conversationId: string;
  activeConversationId: string | null;
  isActiveConversationView: boolean;
  isDocumentVisible: boolean;
  hasWindowFocus: boolean;
}): boolean {
  return (
    args.isActiveConversationView &&
    args.activeConversationId === args.conversationId &&
    args.isDocumentVisible &&
    args.hasWindowFocus
  );
}
