import { describe, expect, it } from "vitest";
import {
  buildUnreadSnapshot,
  getUnreadIncreases,
  loadCuePreferences,
  saveCuePreferences,
  shouldSuppressUnreadAttentionCue,
  type CuePreferenceAdapter,
  type CuePreferences,
} from "./notificationCues";

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("preference adapter behavior", () => {
  const webAdapter: CuePreferenceAdapter = {
    storageKey: "web",
    defaults: {
      browserNotifications: false,
      sound: true,
    },
    missingFieldBehavior: "strictTrue",
  };

  const widgetAdapter: CuePreferenceAdapter = {
    storageKey: "widget",
    defaults: {
      browserNotifications: true,
      sound: false,
    },
    missingFieldBehavior: "defaultValue",
  };

  it("loads defaults when storage is missing or malformed", () => {
    expect(loadCuePreferences(webAdapter)).toEqual(webAdapter.defaults);
    expect(loadCuePreferences(webAdapter, createStorage({ web: "invalid" } as Record<string, string>))).toEqual(
      webAdapter.defaults
    );
  });

  it("supports strictTrue and defaultValue missing-field strategies", () => {
    const storage = createStorage({
      web: JSON.stringify({ browserNotifications: true }),
      widget: JSON.stringify({ browserNotifications: true }),
    });

    expect(loadCuePreferences(webAdapter, storage)).toEqual({
      browserNotifications: true,
      sound: false,
    });
    expect(loadCuePreferences(widgetAdapter, storage)).toEqual({
      browserNotifications: true,
      sound: false,
    });
  });

  it("saves preferences using adapter storage key", () => {
    const storage = createStorage();
    const nextPreferences: CuePreferences = {
      browserNotifications: true,
      sound: true,
    };

    saveCuePreferences(webAdapter, nextPreferences, storage);

    expect(loadCuePreferences(webAdapter, storage)).toEqual(nextPreferences);
  });
});

describe("unread snapshot and increase invariants", () => {
  it("builds snapshots from accessor-selected unread fields", () => {
    const conversations = [
      { _id: "a", unreadByAgent: 2, unreadByVisitor: 0 },
      { _id: "b", unreadByAgent: 1, unreadByVisitor: 4 },
    ];

    expect(
      buildUnreadSnapshot({
        conversations,
        getUnreadCount: (conversation) => conversation.unreadByAgent,
      })
    ).toEqual({ a: 2, b: 1 });

    expect(
      buildUnreadSnapshot({
        conversations,
        getUnreadCount: (conversation) => conversation.unreadByVisitor,
      })
    ).toEqual({ a: 0, b: 4 });
  });

  it("detects increases while ignoring unchanged or decreased counts", () => {
    const previous = { a: 1, b: 3 };
    const conversations = [
      { _id: "a", unread: 2 },
      { _id: "b", unread: 1 },
      { _id: "c", unread: 1 },
    ];

    expect(
      getUnreadIncreases({
        previous,
        conversations,
        getUnreadCount: (conversation) => conversation.unread,
      })
    ).toEqual(["a", "c"]);
  });
});

describe("suppression predicate invariants", () => {
  it("suppresses only for active focused visible conversation views", () => {
    expect(
      shouldSuppressUnreadAttentionCue({
        conversationId: "c1",
        activeConversationId: "c1",
        isActiveConversationView: true,
        isDocumentVisible: true,
        hasWindowFocus: true,
      })
    ).toBe(true);

    expect(
      shouldSuppressUnreadAttentionCue({
        conversationId: "c1",
        activeConversationId: "c2",
        isActiveConversationView: true,
        isDocumentVisible: true,
        hasWindowFocus: true,
      })
    ).toBe(false);

    expect(
      shouldSuppressUnreadAttentionCue({
        conversationId: "c1",
        activeConversationId: "c1",
        isActiveConversationView: false,
        isDocumentVisible: true,
        hasWindowFocus: true,
      })
    ).toBe(false);
  });
});
