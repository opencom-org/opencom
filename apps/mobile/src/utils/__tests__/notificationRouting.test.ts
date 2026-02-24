import { describe, expect, it } from "vitest";
import {
  getActiveConversationIdFromPath,
  getConversationIdFromPayload,
  getNotificationNavigationTarget,
  shouldSuppressForegroundNotification,
} from "../notificationRouting";

describe("notificationRouting", () => {
  it("extracts the active conversation id from the conversation route", () => {
    expect(getActiveConversationIdFromPath("/conversation/conv_123")).toBe("conv_123");
    expect(getActiveConversationIdFromPath("/(app)/conversation/conv_456?foo=bar")).toBe(
      "conv_456"
    );
  });

  it("returns null when the route is not a conversation path", () => {
    expect(getActiveConversationIdFromPath("/inbox")).toBeNull();
    expect(getActiveConversationIdFromPath(null)).toBeNull();
  });

  it("extracts conversation id from payload only when valid", () => {
    expect(getConversationIdFromPayload({ conversationId: "conv_1" })).toBe("conv_1");
    expect(getConversationIdFromPayload({ conversationId: 123 })).toBeNull();
    expect(getConversationIdFromPayload(undefined)).toBeNull();
  });

  it("suppresses foreground cues only for the active conversation", () => {
    expect(
      shouldSuppressForegroundNotification({
        payload: { conversationId: "conv_1" },
        activeConversationId: "conv_1",
      })
    ).toBe(true);

    expect(
      shouldSuppressForegroundNotification({
        payload: { conversationId: "conv_2" },
        activeConversationId: "conv_1",
      })
    ).toBe(false);
  });

  it("maps notification payloads to navigation targets", () => {
    expect(getNotificationNavigationTarget({ conversationId: "conv_99" })).toEqual({
      pathname: "/conversation/[id]",
      params: { id: "conv_99" },
    });

    expect(getNotificationNavigationTarget({ ticketId: "ticket_42" })).toEqual({
      pathname: "/inbox",
      params: { ticketId: "ticket_42" },
    });

    expect(getNotificationNavigationTarget({ type: "unknown" })).toBeNull();
  });
});
