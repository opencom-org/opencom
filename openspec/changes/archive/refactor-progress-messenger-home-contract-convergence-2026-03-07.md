# Refactor Progress: Messenger / Home Contract Convergence (2026-03-07)

## Scope

- `packages/types/src/messengerSettings.ts`
- `packages/types/src/homeConfig.ts`
- `packages/types/src/index.ts`
- `packages/convex/convex/messengerSettings.ts`
- `apps/widget/src/hooks/useWidgetSettings.ts`
- `apps/widget/src/components/Home.tsx`
- `packages/react-native-sdk/src/hooks/useMessengerSettings.ts`
- `packages/react-native-sdk/src/components/OpencomHome.tsx`

Incidental type-alignment cleanup triggered by the stricter Convex-generated tour types:

- `apps/widget/src/tourOverlay/useTourOverlayActions.ts`
- `apps/widget/src/tourOverlay/useTourOverlayPositioning.ts`

## Problem Addressed

The next high-value cross-surface drift point was the public messenger/home contract.

Before this pass:

- Convex shaped public messenger settings inline in `messengerSettings.ts`
- widget had its own local `MessengerSettings` default model
- React Native had its own local `MessengerSettings`, `HomeCard`, and `HomeConfig` definitions
- widget and RN each carried their own fallback home config defaults
- optional public fields like `logo`, `teamIntroduction`, and `privacyPolicyUrl` were not consistently normalized to the same nullability contract

That made the public messenger/home surface harder to trust than it needed to be, especially across widget and RN.

## What Was Refactored

1. Added a shared public messenger settings contract in `@opencom/types`:
   - `PublicMessengerSettings`
   - `getDefaultPublicMessengerSettings`
   - `normalizePublicMessengerSettings`
2. Added a shared default home configuration factory in `@opencom/types`:
   - `getDefaultHomeConfig`
3. Rewired Convex public messenger settings shaping to use the shared normalizer:
   - `getPublicSettings` now returns the shared public contract
   - optional public fields are normalized consistently
4. Rewired widget settings consumption to use the shared public settings contract and normalizer.
5. Rewired React Native settings consumption to use the shared public settings contract and normalizer.
6. Removed the React Native-local home config and home card contract definitions in favor of the shared `@opencom/types` model.
7. Replaced widget and RN local home fallback config literals with the shared default home config.
8. Fixed one widget-side tour typing mismatch that surfaced once the Convex handler contract became stricter:
   - `checkpoint` mode is now treated correctly as the backend `AdvanceMode` contract instead of accepting a synthetic `"system"` input from the widget side

## Result

- Public messenger settings are now authored once in `@opencom/types` and consumed by Convex, widget, and RN.
- Shared home config defaults now come from one source instead of separate widget/RN/Convex literals.
- React Native no longer carries local `HomeCard` and `HomeConfig` drift for this surface.
- The remaining messenger/home-config work is no longer a basic cross-surface contract problem.
- The remaining work in this track is now mainly:
  - backend decomposition inside `packages/convex/convex/messengerSettings.ts`
  - web authoring/settings decomposition inside `apps/web/src/app/settings/MessengerSettingsSection.tsx`

## What Still Appears To Remain In This Track

- `packages/convex/convex/messengerSettings.ts` still mixes:
  - admin settings mutations
  - public settings shaping
  - logo storage flows
  - audience-rule handling
  - home-card CRUD
- `apps/web/src/app/settings/MessengerSettingsSection.tsx` still owns a lot of authoring state and preview logic inline.
- If this track continues, the next clean pass should be backend/web decomposition, not more public contract cleanup.

## Compatibility Notes

- No Convex endpoint names changed.
- No widget- or RN-facing public messenger/home query names changed.
- This pass is contract-convergence and normalization work, not a UX/behavior redesign.

## Verification

Passed:

- `pnpm --filter @opencom/types typecheck`
- `pnpm --filter @opencom/convex typecheck`
- `pnpm --filter @opencom/widget typecheck`
- `pnpm --filter @opencom/react-native-sdk typecheck`
- `bash -lc 'set -a; source packages/convex/.env.local; set +a; pnpm --filter @opencom/convex test -- --run tests/messengerSettings.test.ts'`

Notes:

- The focused Convex test needed network access to the configured Convex deployment.
- The integration run emitted stderr noise from remote `testing/helpers:*` lookups, but Vitest completed green with `5` tests passed.
