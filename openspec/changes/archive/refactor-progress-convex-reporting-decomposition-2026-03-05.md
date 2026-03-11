# Refactor Progress: Convex Reporting Domain Decomposition (2026-03-05)

## Scope

- `packages/convex/convex/reporting.ts`
- `packages/convex/convex/reporting/helpers.ts`
- `packages/convex/convex/reporting/conversationMetrics.ts`
- `packages/convex/convex/reporting/agentMetrics.ts`
- `packages/convex/convex/reporting/csatMetrics.ts`
- `packages/convex/convex/reporting/aiMetrics.ts`
- `packages/convex/convex/reporting/snapshots.ts`
- `packages/convex/convex/reporting/dashboard.ts`

## Problem Addressed

`packages/convex/convex/reporting.ts` previously contained all reporting concerns in one file (~1224 lines).

## What Was Refactored

1. Extracted shared reporting helpers (auth access, limits, period keying) into `reporting/helpers.ts`.
2. Extracted conversation metrics queries into `reporting/conversationMetrics.ts`.
3. Extracted agent metrics queries into `reporting/agentMetrics.ts`.
4. Extracted CSAT eligibility/submission/metrics into `reporting/csatMetrics.ts`.
5. Extracted AI metrics/comparison/knowledge gaps into `reporting/aiMetrics.ts`.
6. Extracted snapshot caching endpoints into `reporting/snapshots.ts`.
7. Extracted dashboard summary endpoint into `reporting/dashboard.ts`.
8. Recomposed `reporting.ts` as stable re-export entrypoint.

## Result

- `packages/convex/convex/reporting.ts` reduced to 24 lines (from ~1224 lines).
- Reporting endpoints remain stable while responsibilities are split by concern.

## Compatibility Notes (Web / Widget / Mobile / SDKs)

- No endpoint name/signature changes.
- Dependent package typechecks passed across web/widget/mobile/sdk-core/react-native-sdk.

## Verification

Passed:

- `pnpm --filter @opencom/convex typecheck`
- `pnpm --filter @opencom/web typecheck`
- `pnpm --filter @opencom/widget typecheck`
- `pnpm --filter @opencom/mobile typecheck`
- `pnpm --filter @opencom/sdk-core typecheck`
- `pnpm --filter @opencom/react-native-sdk typecheck`
