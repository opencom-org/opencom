import { describe, expect, it } from "vitest";
import {
  buildUnreadSnapshot,
  getUnreadIncreases,
  loadInboxCuePreferences,
  saveInboxCuePreferences,
  shouldSuppressAttentionCue,
} from "../inboxNotificationCues";

function createStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe("inboxNotificationCues", () => {
  it("loads defaults when storage is empty", () => {
    const storage = createStorage();
    expect(loadInboxCuePreferences(storage as Storage)).toEqual({
      browserNotifications: false,
      sound: false,
    });
  });

  it("saves and reloads cue preferences", () => {
    const storage = createStorage();
    saveInboxCuePreferences(
      {
        browserNotifications: true,
        sound: true,
      },
      storage as Storage
    );

    expect(loadInboxCuePreferences(storage as Storage)).toEqual({
      browserNotifications: true,
      sound: true,
    });
  });

  it("detects unread increases and ignores unchanged/decreased counts", () => {
    const previous = {
      a: 1,
      b: 4,
      c: 0,
    };
    const conversations = [
      { _id: "a", unreadByAgent: 2 },
      { _id: "b", unreadByAgent: 3 },
      { _id: "c", unreadByAgent: 0 },
      { _id: "d", unreadByAgent: 1 },
    ];

    expect(getUnreadIncreases({ previous, conversations })).toEqual(["a", "d"]);
    expect(buildUnreadSnapshot(conversations)).toEqual({
      a: 2,
      b: 3,
      c: 0,
      d: 1,
    });
  });

  it("suppresses cues only when the same thread is focused", () => {
    expect(
      shouldSuppressAttentionCue({
        conversationId: "conv-1",
        selectedConversationId: "conv-1",
        isDocumentVisible: true,
        hasWindowFocus: true,
      })
    ).toBe(true);

    expect(
      shouldSuppressAttentionCue({
        conversationId: "conv-1",
        selectedConversationId: "conv-2",
        isDocumentVisible: true,
        hasWindowFocus: true,
      })
    ).toBe(false);
  });
});
