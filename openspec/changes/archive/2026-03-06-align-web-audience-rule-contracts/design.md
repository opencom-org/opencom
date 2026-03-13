## Context

The web app models audience rules in `AudienceRuleBuilder` with a segment variant `{ type: "segment", segmentId }`, while Convex validators for segment targeting accept `{ segmentId }` and inline rule validators do not include segment references. This mismatch now causes type failures and increases runtime drift risk.

## Goals / Non-Goals

**Goals**

- Define one shared audience-rule contract in `@opencom/types`.
- Make web builder/state shapes compatible with Convex validators.
- Keep segment targeting available only where backend endpoints support it.
- Restore `@opencom/web` typecheck health for current blockers.

**Non-Goals**

- Rewriting Convex validator internals.
- Rebuilding all targeting UIs.
- Changing existing backend endpoint names or authorization semantics.

## Decisions

### 1) Add shared audience-rule contracts to `@opencom/types`

Decision:

- Introduce shared types for condition operators, property refs, inline rules, and segment references.
- Keep inline rules strictly condition/group recursive (no nested segments).

Rationale:

- Aligns frontend typing with Convex validator behavior and removes duplicated local contracts.

### 2) Use backend-compatible segment reference shape in web

Decision:

- Represent segment targeting as `{ segmentId }` in web payload/state where applicable.

Rationale:

- Matches `audienceRulesOrSegmentValidator` payload expectations and avoids runtime/schema drift.

### 3) Split inline-only vs segment-capable usage by screen

Decision:

- Keep outbound targeting as inline-only state because outbound update/create validators only accept inline audience rules.
- Keep segment-capable state in screens backed by `audienceRulesOrSegmentValidator`.

Rationale:

- Prevents type unsoundness and user-facing configurations that backend rejects.

## Risks / Trade-offs

- [Risk] Existing saved data using legacy segment shape may still appear from old records.
  - Mitigation: parsing helpers treat unknown and legacy forms defensively.
- [Risk] UI behavior regressions in targeting mode toggles.
  - Mitigation: add focused helper tests and rerun targeted web tests/typecheck.

## Migration Plan

1. Add shared audience-rule types in `@opencom/types` and export them.
2. Refactor web audience rule builder/helper types to shared contracts.
3. Update outbound page to inline-only targeting state.
4. Patch article export union narrowing.
5. Run targeted package checks and tests.

Rollback:

- Revert web adoption of shared contracts while preserving shared type file for incremental rollout.

## Open Questions

- Should Convex also consume the shared audience-rule TypeScript contracts directly in a follow-up change to reduce backend duplication?
