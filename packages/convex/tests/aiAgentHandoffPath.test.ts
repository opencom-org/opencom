import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("aiAgent.handoffToHuman persistence path", () => {
  it("persists handoff messages with ai-agent sender id", () => {
    const source = readFileSync(new URL("../convex/aiAgent.ts", import.meta.url), "utf8");

    expect(source).toContain('senderId: "ai-agent"');
    expect(source).not.toContain('senderId: "system"');
    expect(source).toContain("const now = Date.now();");
    expect(source).toContain("createdAt: now");
    expect(source).toContain("lastMessageAt: now");
    expect(source).toMatch(
      /unreadByAgent:\s*Math\.max\(\s*conversation\.unreadByAgent\s*\|\|\s*0,\s*1\s*\)/
    );
    expect(source).toContain('getInternalRef("notifications:routeEvent")');
    expect(source).toContain("await runAfter(0, routeEventRef");
    expect(source).toContain('audience: "agent"');
  });
});
