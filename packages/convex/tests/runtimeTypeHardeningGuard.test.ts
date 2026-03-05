import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const TARGET_FILES = [
  "../convex/events.ts",
  "../convex/series.ts",
  "../convex/lib/authWrappers.ts",
];

describe("runtime type hardening guards", () => {
  it("prevents broad any-casts in covered runtime-critical modules", () => {
    for (const relativePath of TARGET_FILES) {
      const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
      expect(source).not.toMatch(/\bas any\b/);
    }
  });

  it("routes series runtime internal calls through typed adapters", () => {
    const eventsSource = readFileSync(new URL("../convex/events.ts", import.meta.url), "utf8");
    const seriesSource = readFileSync(new URL("../convex/series.ts", import.meta.url), "utf8");

    expect(eventsSource).not.toContain("(internal as any).series");
    expect(seriesSource).not.toContain("(internal as any).series");
    expect(eventsSource).toContain("scheduleSeriesEvaluateEnrollment");
    expect(eventsSource).toContain("scheduleSeriesResumeWaitingForEvent");
    expect(seriesSource).toContain("scheduleSeriesProcessProgress");
    expect(seriesSource).toContain("runSeriesEvaluateEntry");
  });
});
