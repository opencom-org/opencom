# Refactor Progress: Centralize Outbound + Trigger Contracts (2026-03-06)

## Slice

- `centralize-outbound-and-trigger-contracts` (P0, in progress)

## Why

The earlier validator centralization pass removed backend/schema drift, but visitor-facing outbound message record shapes were still duplicated across `sdk-core`, `react-native-sdk`, and `widget`.
That left cross-surface consumers free to drift on the same payload contract even though they all read the same Convex outbound data.

## What Changed In This Pass

1. Added shared outbound message record contracts to `@opencom/types`:
   - `packages/types/src/index.ts`
   - Added:
     - `EligibleOutboundMessage`
     - `PersistedOutboundMessage`
2. Rewired `sdk-core` outbound API types to the shared persisted contract:
   - `packages/sdk-core/src/api/outbound.ts`
3. Rewired React Native outbound hook types to the shared eligible contract:
   - `packages/react-native-sdk/src/hooks/useOutboundMessages.ts`
4. Rewired widget outbound runtime typing to the same eligible contract:
   - `apps/widget/src/OutboundOverlay.tsx`
5. Added shared authoring-safe outbound button/content contracts to `@opencom/types`:
   - `packages/types/src/index.ts`
   - Added:
     - `AuthoringOutboundButtonAction`
     - `AuthoringOutboundPrimaryButtonAction`
     - `AuthoringMessageButton`
     - `AuthoringOutboundMessageContent`
6. Rewired authoring-side consumers to those shared contracts:
   - `apps/web/src/app/outbound/[id]/editorState.ts`
   - `packages/convex/convex/testData/seeds.ts`

## Verification Run Notes

Executed in this pass:

- `pnpm --filter @opencom/widget typecheck` -> pass
- `pnpm --filter @opencom/web typecheck` -> pass
- `pnpm --filter @opencom/convex typecheck` -> pass
- `pnpm --filter @opencom/convex test` -> pass (`32` files, `216` tests)
- `pnpm --filter @opencom/widget test -- --run src/test/outboundOverlay.test.tsx` -> pass
- `pnpm --filter @opencom/sdk-core test -- --run tests/contracts.test.ts` -> pass
- `pnpm --filter @opencom/react-native-sdk test -- --run tests/outboundContracts.test.ts` -> pass
- `pnpm test:compat:cross-surface` -> pass
  - `@opencom/sdk-core`: `8` files, `58` tests passed
  - `@opencom/react-native-sdk`: `7` files, `39` tests passed
  - `apps/mobile`: typecheck passed
- `pnpm web:test:e2e -- apps/web/e2e/outbound.spec.ts --project=chromium` -> pass (`36` passed, `0` unexpected)

## Notes

- This pass centralizes shared TypeScript record shapes only. It does not change Convex function names, runtime trigger evaluation, or widget outbound behavior.
- A later repo-wide duplication audit found no remaining active outbound contract drift inside the live outbound web routes or cross-surface consumers.
- The only notable leftover trigger-shape duplication is the dormant `apps/web/src/components/TriggerConfigEditor.tsx`, which is currently unused in `apps/web/src` and also carries non-outbound extras like `exit_intent` and `eventProperties`.
- Remaining work in this track is now mostly a judgment call on whether that dormant trigger editor should be aligned to shared types or left alone until it becomes a live surface again.
