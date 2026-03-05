import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("aiAgent.handoffToHuman persistence path", () => {
  it("persists handoff messages with ai-agent sender id", () => {
    const source = readFileSync(new URL("../convex/aiAgent.ts", import.meta.url), "utf8");

    expect(source).toContain('senderId: "ai-agent"');
    expect(source).not.toContain('senderId: "system"');
    expect(source).toContain("lastMessageAt: now");
    expect(source).toContain("unreadByAgent: (conversation.unreadByAgent || 0) + 1");
    expect(source).toContain("internal.notifications.routeEvent");
    expect(source).toContain('audience: "agent"');
  });
});
