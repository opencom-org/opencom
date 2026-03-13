import { isAudienceSegmentReference } from "@opencom/types";
import type { AudienceRule, SegmentReference } from "@/components/AudienceRuleBuilder";

export type InlineAudienceRule = Exclude<AudienceRule, SegmentReference>;

export function toInlineAudienceRule(rule: unknown): InlineAudienceRule | null {
  if (!rule || typeof rule !== "object") {
    return null;
  }

  const candidate = rule as Record<string, unknown>;
  if (isAudienceSegmentReference(candidate)) {
    return null;
  }

  return rule as InlineAudienceRule;
}

export function toInlineAudienceRuleFromBuilder(
  rule: AudienceRule | null
): InlineAudienceRule | null {
  if (!rule || isAudienceSegmentReference(rule)) {
    return null;
  }

  return rule;
}
