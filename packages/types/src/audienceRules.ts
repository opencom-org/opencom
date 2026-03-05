export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equals"
  | "less_than_or_equals"
  | "is_set"
  | "is_not_set";

export type PropertyReference = {
  source: "system" | "custom" | "event";
  key: string;
  eventFilter?: {
    name: string;
    countOperator?: "at_least" | "at_most" | "exactly";
    count?: number;
    withinDays?: number;
  };
};

export type AudienceCondition = {
  type: "condition";
  property: PropertyReference;
  operator: ConditionOperator;
  value?: string | number | boolean;
};

export type AudienceGroup = {
  type: "group";
  operator: "and" | "or";
  conditions: Array<AudienceCondition | AudienceNestedGroup>;
};

export type AudienceNestedGroup = {
  type: "group";
  operator: "and" | "or";
  conditions: AudienceCondition[];
};

export type InlineAudienceRule = AudienceCondition | AudienceGroup;

export type AudienceSegmentReference<SegmentId = string> = {
  segmentId: SegmentId;
};

export type AudienceRuleWithSegment<SegmentId = string> =
  | InlineAudienceRule
  | AudienceSegmentReference<SegmentId>;

export function isAudienceSegmentReference<SegmentId = string>(
  rule: unknown
): rule is AudienceSegmentReference<SegmentId> {
  if (!rule || typeof rule !== "object") {
    return false;
  }

  return "segmentId" in rule;
}
