import { describe, expect, it } from "vitest";
import {
  buildWidgetUnreadSnapshot,
  getWidgetUnreadIncreases,
  loadWidgetCuePreferences,
  shouldSuppressWidgetCue,
} from "../lib/widgetNotificationCues";

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
  };
}

describe("widgetNotificationCues", () => {
  it("loads cue preferences with sensible defaults", () => {
    const storage = createStorage();
    expect(loadWidgetCuePreferences(storage as Storage)).toEqual({
      browserNotifications: true,
      sound: false,
    });
  });

  it("detects unread increases and ignores mark-as-read decreases", () => {
    const previous = {
      c1: 2,
      c2: 1,
    };
    const nextConversations = [
      { _id: "c1", unreadByVisitor: 0 },
      { _id: "c2", unreadByVisitor: 2 },
      { _id: "c3", unreadByVisitor: 1 },
    ];

    expect(
      getWidgetUnreadIncreases({
        previous,
        conversations: nextConversations,
      })
    ).toEqual(["c2", "c3"]);
    expect(buildWidgetUnreadSnapshot(nextConversations)).toEqual({
      c1: 0,
      c2: 2,
      c3: 1,
    });
  });

  it("suppresses cues only for the actively focused thread", () => {
    expect(
      shouldSuppressWidgetCue({
        conversationId: "c1",
        activeConversationId: "c1",
        widgetView: "conversation",
        isDocumentVisible: true,
        hasWindowFocus: true,
      })
    ).toBe(true);

    expect(
      shouldSuppressWidgetCue({
        conversationId: "c1",
        activeConversationId: "c2",
        widgetView: "conversation",
        isDocumentVisible: true,
        hasWindowFocus: true,
      })
    ).toBe(false);
  });
});
