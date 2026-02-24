import { v } from "convex/values";

// Condition operators for audience rules
export const conditionOperatorValidator = v.union(
  v.literal("equals"),
  v.literal("not_equals"),
  v.literal("contains"),
  v.literal("not_contains"),
  v.literal("starts_with"),
  v.literal("ends_with"),
  v.literal("greater_than"),
  v.literal("less_than"),
  v.literal("greater_than_or_equals"),
  v.literal("less_than_or_equals"),
  v.literal("is_set"),
  v.literal("is_not_set")
);

// Property reference for audience conditions
export const propertyReferenceValidator = v.object({
  source: v.union(v.literal("system"), v.literal("custom"), v.literal("event")),
  key: v.string(),
  eventFilter: v.optional(
    v.object({
      name: v.string(),
      countOperator: v.optional(
        v.union(v.literal("at_least"), v.literal("at_most"), v.literal("exactly"))
      ),
      count: v.optional(v.number()),
      withinDays: v.optional(v.number()),
    })
  ),
});

// Audience condition
export const audienceConditionValidator = v.object({
  type: v.literal("condition"),
  property: propertyReferenceValidator,
  operator: conditionOperatorValidator,
  value: v.optional(v.union(v.string(), v.number(), v.boolean())),
});

// Audience rules - recursive structure needs special handling
// Since Convex doesn't support recursive validators directly, we use a simplified version
// that covers the most common cases (up to 2 levels of nesting)
export const audienceRulesValidator = v.union(
  // Single condition
  audienceConditionValidator,
  // Group with conditions (1 level)
  v.object({
    type: v.literal("group"),
    operator: v.union(v.literal("and"), v.literal("or")),
    conditions: v.array(
      v.union(
        audienceConditionValidator,
        // Group with conditions (2nd level)
        v.object({
          type: v.literal("group"),
          operator: v.union(v.literal("and"), v.literal("or")),
          conditions: v.array(audienceConditionValidator),
        })
      )
    ),
  })
);

// Shared bounded JSON-like validators for dynamic contracts.
export const jsonPrimitiveValidator = v.union(v.string(), v.number(), v.boolean(), v.null());

export const jsonArrayValidator = v.array(jsonPrimitiveValidator);

export const jsonObjectValidator = v.record(
  v.string(),
  v.union(jsonPrimitiveValidator, jsonArrayValidator, v.record(v.string(), jsonPrimitiveValidator))
);

export const jsonValueValidator = v.union(
  jsonPrimitiveValidator,
  jsonArrayValidator,
  jsonObjectValidator
);

export const jsonRecordValidator = v.record(v.string(), jsonValueValidator);

// Custom attributes validator - bounded flexible map with one-level nested objects.
export const customAttributesValidator = v.record(v.string(), jsonValueValidator);

// Trigger configuration for outbound messages, tooltips, etc.
export const triggerConfigValidator = v.object({
  type: v.union(
    v.literal("immediate"),
    v.literal("page_visit"),
    v.literal("time_on_page"),
    v.literal("scroll_depth"),
    v.literal("event"),
    v.literal("exit_intent")
  ),
  pageUrl: v.optional(v.string()),
  pageUrlMatch: v.optional(v.union(v.literal("exact"), v.literal("contains"), v.literal("regex"))),
  delaySeconds: v.optional(v.number()),
  scrollPercent: v.optional(v.number()),
  eventName: v.optional(v.string()),
  eventProperties: v.optional(
    v.record(v.string(), v.union(v.string(), v.number(), v.boolean(), v.null()))
  ),
});

export const selectorQualityGradeValidator = v.union(
  v.literal("good"),
  v.literal("fair"),
  v.literal("poor")
);

export const selectorQualityValidator = v.object({
  score: v.number(),
  grade: selectorQualityGradeValidator,
  warnings: v.array(v.string()),
  signals: v.object({
    matchCount: v.optional(v.number()),
    depth: v.number(),
    usesNth: v.boolean(),
    hasId: v.boolean(),
    hasDataAttribute: v.boolean(),
    classCount: v.number(),
    usesWildcard: v.boolean(),
  }),
});

export const tourAdvanceModeValidator = v.union(
  v.literal("click"),
  v.literal("elementClick"),
  v.literal("fieldFill"),
  v.literal("system")
);

export const tourDiagnosticReasonValidator = v.union(
  v.literal("mode_mismatch"),
  v.literal("element_click_required"),
  v.literal("field_fill_required"),
  v.literal("field_fill_invalid"),
  v.literal("route_mismatch"),
  v.literal("checkpoint_invalid_route"),
  v.literal("selector_missing")
);

// Event properties validator
export const eventPropertiesValidator = v.record(
  v.string(),
  v.union(v.string(), v.number(), v.boolean(), v.null(), v.array(v.union(v.string(), v.number())))
);

// Targeting rules for tours
export const targetingRulesValidator = v.object({
  pageUrl: v.optional(v.string()),
  userAttributes: v.optional(customAttributesValidator),
});

// Series block rules configuration
export const seriesRulesValidator = v.union(
  audienceConditionValidator,
  v.object({
    type: v.literal("group"),
    operator: v.union(v.literal("and"), v.literal("or")),
    conditions: v.array(audienceConditionValidator),
  })
);

// Segment reference or inline rules
export const audienceRulesOrSegmentValidator = v.union(
  audienceRulesValidator,
  v.object({
    segmentId: v.id("segments"),
  })
);

// Checklist completion attribute
export const completionAttributeValidator = v.object({
  key: v.string(),
  operator: v.string(),
  value: v.optional(jsonValueValidator),
});

// Form data for tickets (user-submitted form values)
export const formDataValidator = v.record(
  v.string(),
  v.union(v.string(), v.number(), v.boolean(), v.null(), v.array(v.string()))
);

// Push notification data payload
export const pushDataValidator = v.record(v.string(), v.union(v.string(), v.number(), v.boolean()));
