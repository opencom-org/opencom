## Why

Web audience-rule typing has drifted from Convex validator contracts, causing `@opencom/web` typecheck failures across campaign/tour/outbound screens and the shared rule builder. The current segment-reference shape also differs from backend expectations.

## What Changes

- Introduce shared audience-rule contract types in `@opencom/types`.
- Refactor web `AudienceRuleBuilder` and audience-rule helpers to use shared contracts and backend-compatible segment references.
- Constrain outbound editor targeting to inline rules only (matching Convex API).
- Fix related web typecheck blockers, including article export file union narrowing.
- Add tests for audience-rule conversion helpers.

## Capabilities

### New Capabilities

- `shared-audience-rule-contracts`: Canonical shared audience-rule types and segment-reference contract reused by web and backend-facing consumers.

### Modified Capabilities

- None.

## Impact

- Affected code:
  - `packages/types/src/*`
  - `apps/web/src/components/AudienceRuleBuilder.tsx`
  - `apps/web/src/lib/audienceRules.ts`
  - targeted campaign/tour/outbound/article pages
- APIs:
  - No endpoint renames; payload shapes align with existing Convex validators.
- Dependencies:
  - No external dependency additions.
