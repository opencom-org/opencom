## Context

The reporting module currently owns:

- reporting-access and limit helpers
- conversation and response-time metrics
- agent workload/performance metrics
- CSAT eligibility/submission/aggregation
- AI metrics, comparison, and knowledge-gap analysis
- snapshot caching and dashboard summary

This broad scope in one file increases coupling and review risk.

## Goals / Non-Goals

**Goals:**

- Split reporting logic into dedicated modules grouped by concern.
- Keep `reporting.ts` as stable entrypoint via re-exports.
- Preserve endpoint contracts and behavior.

**Non-Goals:**

- Changing reporting math semantics.
- Changing permissions required for endpoints.
- Introducing new report endpoints.

## Decisions

### 1) Module split by concern

Decision:

- Use modules for conversation, agent, CSAT, AI, snapshot, and dashboard reporting concerns.

Rationale:

- Mirrors existing logical grouping and enables focused ownership.

### 2) Centralize common auth/limit/date helpers

Decision:

- Move reusable auth and limit/date-period utilities into a shared helper module.

Rationale:

- Avoids drift across reporting modules and reduces duplication.

### 3) Preserve `reporting.ts` import path

Decision:

- Keep `reporting.ts` as a re-export aggregator so generated API path remains stable.

Rationale:

- Avoids downstream churn in web/widget/mobile consumers.

## Risks / Trade-offs

- [Risk] Export wiring mistakes could hide endpoints from Convex API generation.
  - Mitigation: Convex typecheck + dependent package typechecks.
- [Risk] Logic drift during movement.
  - Mitigation: move code with minimal edits and keep function bodies functionally equivalent.

## Migration Plan

1. Extract shared reporting helpers.
2. Extract grouped modules by reporting concern.
3. Recompose `reporting.ts` as re-export entrypoint.
4. Typecheck Convex and dependent packages.
5. Update progress docs and remaining map.

Rollback:

- Re-inline modules into monolithic `reporting.ts`.
