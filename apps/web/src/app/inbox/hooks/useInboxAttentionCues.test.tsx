import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@opencom/convex/dataModel";

const playInboxBingSoundMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/playInboxBingSound", () => ({
  playInboxBingSound: playInboxBingSoundMock,
}));

import {
  computeInboxTitle,
  getUnsuppressedUnreadIncreases,
  useInboxAttentionCues,
} from "./useInboxAttentionCues";

function conversationId(value: string): Id<"conversations"> {
  return value as Id<"conversations">;
}

function createConversation(args: { id: string; unreadByAgent: number; content?: string | null }) {
  return {
    _id: conversationId(args.id),
    unreadByAgent: args.unreadByAgent,
    lastMessage: args.content ? { content: args.content } : null,
    visitor: { name: "Visitor" },
    visitorId: "visitor-id" as Id<"visitors">,
  };
}

describe("useInboxAttentionCues", () => {
  beforeEach(() => {
    playInboxBingSoundMock.mockReset();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("computes title with unread badge prefix", () => {
    expect(computeInboxTitle({ totalUnread: 0, baseTitle: "Inbox" })).toBe("Inbox");
    expect(computeInboxTitle({ totalUnread: 4, baseTitle: "Inbox" })).toBe("(4) Inbox");
  });

  it("filters out suppressed increases for selected visible conversation", () => {
    expect(
      getUnsuppressedUnreadIncreases({
        increasedConversationIds: ["conv-1", "conv-2"],
        selectedConversationId: "conv-1",
        isDocumentVisible: true,
        hasWindowFocus: true,
      })
    ).toEqual(["conv-2"]);
  });

  it("updates document title from unread total and restores base title on unmount", () => {
    document.title = "Inbox Dashboard";

    const { rerender, unmount } = renderHook(
      (props: { unreadA: number; unreadB: number }) =>
        useInboxAttentionCues({
          conversations: [
            createConversation({ id: "conv-a", unreadByAgent: props.unreadA }),
            createConversation({ id: "conv-b", unreadByAgent: props.unreadB }),
          ],
          selectedConversationId: null,
          getConversationIdentityLabel: () => "Visitor",
          onOpenConversation: vi.fn(),
        }),
      {
        initialProps: {
          unreadA: 1,
          unreadB: 2,
        },
      }
    );

    expect(document.title).toBe("(3) Inbox Dashboard");

    rerender({
      unreadA: 0,
      unreadB: 0,
    });
    expect(document.title).toBe("Inbox Dashboard");

    unmount();
    expect(document.title).toBe("Inbox Dashboard");
  });

  it("suppresses cue for selected focused thread but cues other increased threads", async () => {
    const { rerender } = renderHook(
      (props: { unreadA: number; unreadB: number }) =>
        useInboxAttentionCues({
          conversations: [
            createConversation({ id: "conv-a", unreadByAgent: props.unreadA, content: "A" }),
            createConversation({ id: "conv-b", unreadByAgent: props.unreadB, content: "B" }),
          ],
          selectedConversationId: conversationId("conv-a"),
          getConversationIdentityLabel: () => "Visitor",
          onOpenConversation: vi.fn(),
        }),
      {
        initialProps: {
          unreadA: 0,
          unreadB: 0,
        },
      }
    );

    rerender({
      unreadA: 1,
      unreadB: 1,
    });

    await waitFor(() => {
      expect(playInboxBingSoundMock).toHaveBeenCalledTimes(1);
    });
  });
});
