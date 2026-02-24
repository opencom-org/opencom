import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("aiAgentActions.generateResponse bot persistence path", () => {
  it("uses the internal bot-message mutation path", () => {
    const source = readFileSync(new URL("../convex/aiAgentActions.ts", import.meta.url), "utf8");

    expect(source).toContain("internal.messages.internalSendBotMessage");
    expect(source).not.toContain("ctx.runMutation(api.messages.send");
  });
});
