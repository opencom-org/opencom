import { describe, expect, it } from "vitest";
import type { Id } from "@opencom/convex/dataModel";
import type { AudienceRule } from "@/components/AudienceRuleBuilder";
import { toInlineAudienceRule, toInlineAudienceRuleFromBuilder } from "../audienceRules";

describe("audienceRules helpers", () => {
  it("drops segment references from unknown payloads", () => {
    expect(
      toInlineAudienceRule({
        segmentId: "segment_1" as Id<"segments">,
      })
    ).toBeNull();
  });

  it("keeps inline group/condition rules", () => {
    const inlineRule = {
      type: "group" as const,
      operator: "and" as const,
      conditions: [
        {
          type: "condition" as const,
          property: { source: "system" as const, key: "email" },
          operator: "contains" as const,
          value: "@example.com",
        },
      ],
    };

    expect(toInlineAudienceRule(inlineRule)).toEqual(inlineRule);
  });

  it("drops segment references from builder rules", () => {
    const segmentRule: AudienceRule = {
      segmentId: "segment_1" as Id<"segments">,
    };

    expect(toInlineAudienceRuleFromBuilder(segmentRule)).toBeNull();
  });
});
