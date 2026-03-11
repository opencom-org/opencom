# Refactor Progress: Convex Campaign Delivery Domains Decomposition (2026-03-05)

## Scope

- `packages/convex/convex/carousels.ts`
- `packages/convex/convex/carousels/helpers.ts`
- `packages/convex/convex/carousels/authoring.ts`
- `packages/convex/convex/carousels/delivery.ts`
- `packages/convex/convex/carousels/triggering.ts`
- `packages/convex/convex/surveys.ts`
- `packages/convex/convex/surveys/helpers.ts`
- `packages/convex/convex/surveys/authoring.ts`
- `packages/convex/convex/surveys/responses.ts`
- `packages/convex/convex/surveys/delivery.ts`

Supporting type-depth mitigation:

- `packages/convex/convex/lib/authWrappers.ts`
- `packages/convex/convex/aiAgentActions.ts`

## Problem Addressed

`carousels.ts` and `surveys.ts` were large mixed-concern modules combining authoring, delivery, tracking, triggering, and analytics logic.

## What Was Refactored

1. Split carousel domain into:
   - shared helper/normalization module
   - authoring/status module
   - delivery/tracking module
   - triggering module
2. Split survey domain into:
   - shared helper module
   - authoring module
   - responses/export module
   - delivery/impression/analytics module
3. Replaced monolithic `carousels.ts` and `surveys.ts` with stable re-export entrypoints.
4. Added targeted type-depth mitigations in Convex wrapper/call sites to keep downstream package typechecks stable with expanded generated API surface.

## Result

- `packages/convex/convex/carousels.ts` reduced to 20 lines (from ~1038).
- `packages/convex/convex/surveys.ts` reduced to 16 lines (from ~968).
- Endpoint names/signatures preserved while internal ownership boundaries are clearer.

## Compatibility Notes (Web / Widget / Mobile / SDKs)

- No endpoint name/signature changes.
- Verified across web/widget/mobile/sdk-core/react-native-sdk typechecks.

## Verification

Passed:

- `pnpm --filter @opencom/convex typecheck`
- `pnpm --filter @opencom/web typecheck`
- `pnpm --filter @opencom/widget typecheck`
- `pnpm --filter @opencom/mobile typecheck`
- `pnpm --filter @opencom/sdk-core typecheck`
- `pnpm --filter @opencom/react-native-sdk typecheck`
- `openspec validate decompose-convex-campaign-delivery-domains --strict --no-interactive`
