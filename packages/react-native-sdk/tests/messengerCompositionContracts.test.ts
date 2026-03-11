import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  toLegacyConversationId,
  toMessengerConversationId,
} from "../src/components/messengerCompositionTypes";

describe("messenger composition contracts", () => {
  it("adapts legacy string IDs into messenger conversation IDs", () => {
    const converted = toMessengerConversationId("conversation_123");

    expect(converted).toBe("conversation_123");
    expect(toMessengerConversationId(null)).toBeNull();
    expect(toMessengerConversationId(undefined)).toBeNull();
  });

  it("adapts messenger IDs back to legacy/public string IDs", () => {
    expect(toLegacyConversationId(toMessengerConversationId("conversation_456"))).toBe(
      "conversation_456"
    );
    expect(toLegacyConversationId(null)).toBeNull();
  });

  it("prevents broad cast escapes in messenger composition source files", () => {
    const messengerContentSource = readFileSync(
      new URL("../src/components/MessengerContent.tsx", import.meta.url),
      "utf8"
    );
    const opencomMessengerSource = readFileSync(
      new URL("../src/components/OpencomMessenger.tsx", import.meta.url),
      "utf8"
    );

    expect(messengerContentSource).not.toContain("as any");
    expect(opencomMessengerSource).not.toContain("as any");
  });
});
