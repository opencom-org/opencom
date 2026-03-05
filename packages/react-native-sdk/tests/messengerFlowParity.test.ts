import { describe, expect, it, vi, afterEach } from "vitest";
import {
  createInitialMessengerShellState,
  evaluateEmailCaptureDecision,
  formatConversationTimestamp,
  normalizeOutgoingMessage,
  selectMessengerConversation,
  shouldResetConversationOnControlledList,
} from "../src/components/messenger/messengerFlow";

describe("messenger flow parity", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps send flow normalization behavior", () => {
    expect(normalizeOutgoingMessage(" hello ")).toBe("hello");
    expect(normalizeOutgoingMessage("   ")).toBeNull();
  });

  it("keeps list-to-conversation view navigation behavior", () => {
    const initial = createInitialMessengerShellState(undefined, undefined);
    expect(initial.view).toBe("list");
    expect(initial.conversationId).toBeNull();

    const next = selectMessengerConversation("conversation_123" as any, initial);
    expect(next.view).toBe("conversation");
    expect(next.conversationId).toBe("conversation_123");
  });

  it("keeps controlled list reset rule behavior", () => {
    expect(shouldResetConversationOnControlledList("list", true)).toBe(true);
    expect(shouldResetConversationOnControlledList("conversation", true)).toBe(false);
    expect(shouldResetConversationOnControlledList("list", false)).toBe(false);
  });

  it("keeps AI email cue trigger behavior", () => {
    const firstPrompt = evaluateEmailCaptureDecision({
      visitorId: "visitor_123",
      hasVisitorSentMessage: true,
      collectEmailEnabled: true,
      showEmailCapture: false,
      emailCaptured: false,
      lastAgentMessageCount: 0,
      agentMessageCount: 0,
    });

    expect(firstPrompt).toEqual({
      shouldOpenPrompt: true,
      nextLastAgentMessageCount: 0,
    });

    const followUpPrompt = evaluateEmailCaptureDecision({
      visitorId: "visitor_123",
      hasVisitorSentMessage: true,
      collectEmailEnabled: true,
      showEmailCapture: true,
      emailCaptured: false,
      lastAgentMessageCount: 1,
      agentMessageCount: 2,
    });

    expect(followUpPrompt).toEqual({
      shouldOpenPrompt: true,
      nextLastAgentMessageCount: 2,
    });
  });

  it("keeps conversation status timestamp formatting categories", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T12:00:00.000Z"));

    const yesterday = formatConversationTimestamp(new Date("2026-03-04T12:00:00.000Z").getTime());
    expect(yesterday).toBe("Yesterday");

    const sameDay = formatConversationTimestamp(new Date("2026-03-05T11:55:00.000Z").getTime());
    expect(sameDay.length).toBeGreaterThan(0);
    expect(sameDay).not.toBe("Yesterday");
  });
});
