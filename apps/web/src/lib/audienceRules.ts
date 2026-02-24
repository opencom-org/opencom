import type { AudienceRule } from "@/components/AudienceRuleBuilder";

export type InlineAudienceRule = Exclude<AudienceRule, { type: "segment" }>;

export function toInlineAudienceRule(rule: unknown): InlineAudienceRule | null {
  if (!rule || typeof rule !== "object") {
    return null;
  }

  const candidate = rule as Record<string, unknown>;
  if (candidate.type === "segment") {
    return null;
  }

  if ("segmentId" in candidate && candidate.type === undefined) {
    return null;
  }

  return rule as InlineAudienceRule;
}

export function toInlineAudienceRuleFromBuilder(
  rule: AudienceRule | null
): InlineAudienceRule | null {
  if (!rule || rule.type === "segment") {
    return null;
  }

  return rule;
}
