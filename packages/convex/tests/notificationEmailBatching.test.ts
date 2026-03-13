import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { buildDebouncedEmailBatch } from "../convex/notifications/helpers";

function message(args: {
  id: string;
  senderType: Doc<"messages">["senderType"];
  createdAt: number;
  content?: string;
}): Doc<"messages"> {
  return {
    _id: args.id as Id<"messages">,
    _creationTime: args.createdAt,
    conversationId: "conv-1" as Id<"conversations">,
    senderType: args.senderType,
    senderId: "sender-1",
    content: args.content ?? args.id,
    createdAt: args.createdAt,
    channel: "chat",
  };
}

describe("notification email batching", () => {
  it("builds support-reply batches from contiguous support messages within debounce window", () => {
    const messagesDesc = [
      message({ id: "m3", senderType: "agent", createdAt: 3000 }),
      message({ id: "m2", senderType: "bot", createdAt: 2600 }),
      message({ id: "m1", senderType: "visitor", createdAt: 2400 }),
    ];

    const batch = buildDebouncedEmailBatch({
      recentMessagesDesc: messagesDesc,
      mode: "send_visitor_email",
      triggerMessageId: "m3" as Id<"messages">,
      triggerSentAt: 3000,
    });

    expect(batch.map((entry) => entry._id)).toEqual(["m2", "m3"]);
  });

  it("suppresses stale debounced support-reply sends when a newer relevant message exists", () => {
    const messagesDesc = [
      message({ id: "m3", senderType: "agent", createdAt: 3000 }),
      message({ id: "m2", senderType: "agent", createdAt: 2500 }),
      message({ id: "m1", senderType: "visitor", createdAt: 2000 }),
    ];

    const staleByMessageId = buildDebouncedEmailBatch({
      recentMessagesDesc: messagesDesc,
      mode: "send_visitor_email",
      triggerMessageId: "m2" as Id<"messages">,
      triggerSentAt: 2500,
    });
    expect(staleByMessageId).toEqual([]);

    const staleBySentAt = buildDebouncedEmailBatch({
      recentMessagesDesc: messagesDesc,
      mode: "send_visitor_email",
      triggerMessageId: undefined,
      triggerSentAt: 2500,
    });
    expect(staleBySentAt).toEqual([]);
  });
});
