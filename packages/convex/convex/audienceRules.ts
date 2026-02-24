import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";

export type TriggerType =
  | "immediate"
  | "page_visit"
  | "time_on_page"
  | "scroll_depth"
  | "event"
  | "exit_intent";

export type TriggerConfig = {
  type: TriggerType;
  pageUrl?: string;
  pageUrlMatch?: "exact" | "contains" | "regex";
  delaySeconds?: number;
  scrollPercent?: number;
  eventName?: string;
  eventProperties?: Record<string, unknown>;
};

export type TriggerContext = {
  currentUrl?: string;
  timeOnPageSeconds?: number;
  scrollPercent?: number;
  firedEventName?: string;
  firedEventProperties?: Record<string, unknown>;
  isExitIntent?: boolean;
};

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
  conditions: AudienceRule[];
};

export type AudienceRule = AudienceGroup | AudienceCondition;

export interface EvaluationContext {
  visitor: Doc<"visitors">;
  eventCounts: Map<string, number>;
}

async function getEventCount(
  ctx: QueryCtx,
  visitorId: Id<"visitors">,
  eventName: string,
  withinDays?: number
): Promise<number> {
  let events = await ctx.db
    .query("events")
    .withIndex("by_visitor_name", (q) => q.eq("visitorId", visitorId).eq("name", eventName))
    .collect();

  if (withinDays !== undefined) {
    const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000;
    events = events.filter((e) => e.timestamp >= cutoff);
  }

  return events.length;
}

function getSystemPropertyValue(visitor: Doc<"visitors">, key: string): unknown {
  switch (key) {
    case "email":
      return visitor.email;
    case "name":
      return visitor.name;
    case "firstSeenAt":
      return visitor.firstSeenAt;
    case "lastSeenAt":
      return visitor.lastSeenAt;
    case "device":
      return visitor.device?.deviceType;
    case "browser":
      return visitor.device?.browser;
    case "os":
      return visitor.device?.os;
    case "referrer":
      return visitor.referrer;
    case "country":
      return visitor.location?.country;
    case "countryCode":
      return visitor.location?.countryCode;
    case "city":
      return visitor.location?.city;
    case "region":
      return visitor.location?.region;
    case "externalUserId":
      return visitor.externalUserId;
    default:
      return undefined;
  }
}

function getCustomAttributeValue(visitor: Doc<"visitors">, key: string): unknown {
  const attrs = visitor.customAttributes as Record<string, unknown> | undefined;
  return attrs?.[key];
}

function evaluateOperator(
  operator: ConditionOperator,
  actualValue: unknown,
  expectedValue: unknown
): boolean {
  switch (operator) {
    case "is_set":
      return actualValue !== undefined && actualValue !== null && actualValue !== "";

    case "is_not_set":
      return actualValue === undefined || actualValue === null || actualValue === "";

    case "equals":
      return actualValue === expectedValue;

    case "not_equals":
      return actualValue !== expectedValue;

    case "contains":
      if (typeof actualValue === "string" && typeof expectedValue === "string") {
        return actualValue.toLowerCase().includes(expectedValue.toLowerCase());
      }
      return false;

    case "not_contains":
      if (typeof actualValue === "string" && typeof expectedValue === "string") {
        return !actualValue.toLowerCase().includes(expectedValue.toLowerCase());
      }
      return true;

    case "starts_with":
      if (typeof actualValue === "string" && typeof expectedValue === "string") {
        return actualValue.toLowerCase().startsWith(expectedValue.toLowerCase());
      }
      return false;

    case "ends_with":
      if (typeof actualValue === "string" && typeof expectedValue === "string") {
        return actualValue.toLowerCase().endsWith(expectedValue.toLowerCase());
      }
      return false;

    case "greater_than":
      if (typeof actualValue === "number" && typeof expectedValue === "number") {
        return actualValue > expectedValue;
      }
      return false;

    case "less_than":
      if (typeof actualValue === "number" && typeof expectedValue === "number") {
        return actualValue < expectedValue;
      }
      return false;

    case "greater_than_or_equals":
      if (typeof actualValue === "number" && typeof expectedValue === "number") {
        return actualValue >= expectedValue;
      }
      return false;

    case "less_than_or_equals":
      if (typeof actualValue === "number" && typeof expectedValue === "number") {
        return actualValue <= expectedValue;
      }
      return false;

    default:
      return false;
  }
}

function evaluateEventCondition(
  eventCount: number,
  eventFilter: PropertyReference["eventFilter"]
): boolean {
  if (!eventFilter) {
    return eventCount > 0;
  }

  const { countOperator, count } = eventFilter;
  const targetCount = count ?? 1;

  switch (countOperator) {
    case "at_least":
      return eventCount >= targetCount;
    case "at_most":
      return eventCount <= targetCount;
    case "exactly":
      return eventCount === targetCount;
    default:
      return eventCount >= targetCount;
  }
}

async function evaluateCondition(
  ctx: QueryCtx,
  condition: AudienceCondition,
  evalContext: EvaluationContext
): Promise<boolean> {
  const { property, operator, value } = condition;
  const { visitor } = evalContext;

  if (property.source === "event") {
    const eventFilter = property.eventFilter;
    if (!eventFilter) {
      return false;
    }

    const cacheKey = `${eventFilter.name}:${eventFilter.withinDays ?? "all"}`;
    let eventCount = evalContext.eventCounts.get(cacheKey);

    if (eventCount === undefined) {
      eventCount = await getEventCount(ctx, visitor._id, eventFilter.name, eventFilter.withinDays);
      evalContext.eventCounts.set(cacheKey, eventCount);
    }

    return evaluateEventCondition(eventCount, eventFilter);
  }

  let actualValue: unknown;

  if (property.source === "system") {
    actualValue = getSystemPropertyValue(visitor, property.key);
  } else if (property.source === "custom") {
    actualValue = getCustomAttributeValue(visitor, property.key);
  } else {
    return false;
  }

  return evaluateOperator(operator, actualValue, value);
}

async function evaluateGroup(
  ctx: QueryCtx,
  group: AudienceGroup,
  evalContext: EvaluationContext
): Promise<boolean> {
  const { operator, conditions } = group;

  if (conditions.length === 0) {
    return true;
  }

  if (operator === "and") {
    for (const condition of conditions) {
      const result = await evaluateRuleInternal(ctx, condition, evalContext);
      if (!result) {
        return false;
      }
    }
    return true;
  } else {
    for (const condition of conditions) {
      const result = await evaluateRuleInternal(ctx, condition, evalContext);
      if (result) {
        return true;
      }
    }
    return false;
  }
}

async function evaluateRuleInternal(
  ctx: QueryCtx,
  rule: AudienceRule,
  evalContext: EvaluationContext
): Promise<boolean> {
  if (rule.type === "group") {
    return evaluateGroup(ctx, rule, evalContext);
  } else {
    return evaluateCondition(ctx, rule, evalContext);
  }
}

export async function evaluateRule(
  ctx: QueryCtx,
  rule: AudienceRule | undefined | null,
  visitor: Doc<"visitors">
): Promise<boolean> {
  if (!rule) {
    return true;
  }

  const evalContext: EvaluationContext = {
    visitor,
    eventCounts: new Map(),
  };

  return evaluateRuleInternal(ctx, rule, evalContext);
}

export async function countMatchingVisitors(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  rule: AudienceRule | undefined | null
): Promise<{ total: number; matching: number }> {
  const visitors = await ctx.db
    .query("visitors")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();

  if (!rule) {
    return { total: visitors.length, matching: visitors.length };
  }

  let matching = 0;
  for (const visitor of visitors) {
    const matches = await evaluateRule(ctx, rule, visitor);
    if (matches) {
      matching++;
    }
  }

  return { total: visitors.length, matching };
}

export function validateAudienceRule(rule: unknown): rule is AudienceRule {
  if (!rule || typeof rule !== "object") {
    return false;
  }

  const r = rule as Record<string, unknown>;

  if (r.type === "group") {
    if (r.operator !== "and" && r.operator !== "or") {
      return false;
    }
    if (!Array.isArray(r.conditions)) {
      return false;
    }
    return r.conditions.every(validateAudienceRule);
  }

  if (r.type === "condition") {
    if (!r.property || typeof r.property !== "object") {
      return false;
    }
    const prop = r.property as Record<string, unknown>;
    if (!["system", "custom", "event"].includes(prop.source as string)) {
      return false;
    }
    if (typeof prop.key !== "string") {
      return false;
    }
    const validOperators: ConditionOperator[] = [
      "equals",
      "not_equals",
      "contains",
      "not_contains",
      "starts_with",
      "ends_with",
      "greater_than",
      "less_than",
      "greater_than_or_equals",
      "less_than_or_equals",
      "is_set",
      "is_not_set",
    ];
    if (!validOperators.includes(r.operator as ConditionOperator)) {
      return false;
    }
    return true;
  }

  return false;
}

function matchUrl(
  url: string,
  pattern: string,
  matchType: "exact" | "contains" | "regex"
): boolean {
  switch (matchType) {
    case "exact":
      return url === pattern;
    case "contains":
      return url.includes(pattern);
    case "regex":
      try {
        return new RegExp(pattern).test(url);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

export function evaluateTrigger(
  trigger: TriggerConfig | undefined | null,
  context: TriggerContext
): boolean {
  if (!trigger) {
    return true;
  }

  switch (trigger.type) {
    case "immediate":
      return true;

    case "page_visit":
      if (!trigger.pageUrl || !context.currentUrl) {
        return false;
      }
      return matchUrl(context.currentUrl, trigger.pageUrl, trigger.pageUrlMatch ?? "contains");

    case "time_on_page":
      if (trigger.delaySeconds === undefined || context.timeOnPageSeconds === undefined) {
        return false;
      }
      return context.timeOnPageSeconds >= trigger.delaySeconds;

    case "scroll_depth":
      if (trigger.scrollPercent === undefined || context.scrollPercent === undefined) {
        return false;
      }
      return context.scrollPercent >= trigger.scrollPercent;

    case "event":
      if (!trigger.eventName || !context.firedEventName) {
        return false;
      }
      if (trigger.eventName !== context.firedEventName) {
        return false;
      }
      if (trigger.eventProperties && context.firedEventProperties) {
        for (const [key, value] of Object.entries(trigger.eventProperties)) {
          if (context.firedEventProperties[key] !== value) {
            return false;
          }
        }
      }
      return true;

    case "exit_intent":
      return context.isExitIntent === true;

    default:
      return false;
  }
}

export async function resolveSegmentRules(
  ctx: QueryCtx,
  audienceRulesOrSegmentRef: unknown
): Promise<AudienceRule | null> {
  if (!audienceRulesOrSegmentRef || typeof audienceRulesOrSegmentRef !== "object") {
    return null;
  }

  const rules = audienceRulesOrSegmentRef as Record<string, unknown>;

  if (rules.segmentId && typeof rules.segmentId === "string") {
    const segment = await ctx.db.get(rules.segmentId as Id<"segments">);
    if (!segment) {
      return null;
    }
    return segment.audienceRules as AudienceRule;
  }

  if (validateAudienceRule(audienceRulesOrSegmentRef)) {
    return audienceRulesOrSegmentRef;
  }

  return null;
}

export async function evaluateRuleWithSegmentSupport(
  ctx: QueryCtx,
  audienceRulesOrSegmentRef: unknown,
  visitor: Doc<"visitors">
): Promise<boolean> {
  const rule = await resolveSegmentRules(ctx, audienceRulesOrSegmentRef);
  return evaluateRule(ctx, rule, visitor);
}
