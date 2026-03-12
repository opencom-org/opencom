import { describe, expect, it } from "vitest";
import type { Id } from "@opencom/convex/dataModel";
import { shouldClearOptimisticLastMessage, type ConversationUiPatch } from "./useInboxMessageActions";

function messageId(value: string): Id<"messages"> {
  return value as Id<"messages">;
}

describe("shouldClearOptimisticLastMessage", () => {
  it("waits for an agent message after the pre-send latest message", () => {
    const patch: ConversationUiPatch = {
      optimisticLastMessage: "1 attachment",
      optimisticBaseMessageId: messageId("message-1"),
    };

    expect(
      shouldClearOptimisticLastMessage(patch, [
        { _id: messageId("message-1"), senderType: "visitor" },
      ])
    ).toBe(false);

    expect(
      shouldClearOptimisticLastMessage(patch, [
        { _id: messageId("message-1"), senderType: "visitor" },
        { _id: messageId("message-2"), senderType: "visitor" },
      ])
    ).toBe(false);

    expect(
      shouldClearOptimisticLastMessage(patch, [
        { _id: messageId("message-1"), senderType: "visitor" },
        { _id: messageId("message-2"), senderType: "agent" },
      ])
    ).toBe(true);
  });

  it("clears when the first agent message appears in an empty thread", () => {
    const patch: ConversationUiPatch = {
      optimisticLastMessage: "Hello",
      optimisticBaseMessageId: null,
    };

    expect(
      shouldClearOptimisticLastMessage(patch, [
        { _id: messageId("message-1"), senderType: "agent" },
      ])
    ).toBe(true);
  });
});
