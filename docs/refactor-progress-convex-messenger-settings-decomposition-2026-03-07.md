# Refactor Progress: Convex Messenger Settings Decomposition (2026-03-07)

## Scope

- `packages/convex/convex/messengerSettings.ts`
- `packages/convex/convex/messengerSettingsShared.ts`
- `packages/convex/convex/messengerSettingsAccess.ts`
- `packages/convex/convex/messengerSettingsCore.ts`
- `packages/convex/convex/messengerHomeConfig.ts`
- `packages/convex/tests/messengerSettings.test.ts`

## Problem Addressed

After the public messenger/home contract convergence pass, the main concentration in this track was still the Convex backend implementation.

`messengerSettings.ts` still mixed:

- workspace permission checks
- messenger settings reads
- public settings shaping
- branding/settings validation and upserts
- logo upload/delete flows
- home-config validators
- home-config reads and card CRUD

That made the backend side harder to reason about than the already-converged shared contract layer.

## What Was Refactored

1. Extracted shared defaults, validators, and normalization helpers into `messengerSettingsShared.ts`:
   - persisted/public defaults
   - shared arg validators
   - color/url validation
   - public settings normalization
   - home-config normalization/filtering
2. Extracted permission and record-loading helpers into `messengerSettingsAccess.ts`:
   - workspace settings permission checks
   - settings record lookup
   - logo URL resolution
   - workspace existence checks
3. Extracted branding/public-settings handlers into `messengerSettingsCore.ts`:
   - `get`
   - `getOrCreate`
   - `getPublicSettings`
   - `upsert`
   - `generateLogoUploadUrl`
   - `saveLogo`
   - `deleteLogo`
4. Extracted home-config handlers into `messengerHomeConfig.ts`:
   - `getHomeConfig`
   - `getPublicHomeConfig`
   - `updateHomeConfig`
   - `toggleHomeEnabled`
   - `addHomeCard`
   - `removeHomeCard`
   - `reorderHomeCards`
   - `updateHomeCard`
5. Reduced `messengerSettings.ts` to endpoint wiring plus validator composition only.

## Result

- `packages/convex/convex/messengerSettings.ts` is down to `129` lines from `792`.
- Branding/public-settings logic, logo flows, and home-config CRUD are now isolated by purpose.
- Existing `api.messengerSettings.*` endpoint names and argument shapes did not change.
- The remaining work in this broader track is no longer a mixed Convex backend file problem.

## What Still Appears To Remain In This Track

- `apps/web/src/app/settings/MessengerSettingsSection.tsx` is still the main concentrated authoring surface in this domain.
- `messengerSettingsCore.ts` and `messengerHomeConfig.ts` still contain real logic, but they are now isolated by responsibility rather than mixed together.
- The next clean continuation in this track is the web settings-side decomposition, not another mandatory Convex pass.

## Compatibility Notes

- No Convex endpoint signatures changed.
- No shared messenger/home public contract changed in this pass.
- This is internal backend decomposition only.

## Verification

Passed:

- `pnpm --filter @opencom/convex typecheck`
- `bash -lc 'set -a; source packages/convex/.env.local; set +a; pnpm --filter @opencom/convex test -- --run tests/messengerSettings.test.ts'`

Notes:

- The focused integration test needed network access to the configured Convex deployment.
- The run still emitted stderr noise from remote `testing/helpers:*` lookups, but Vitest completed green with `5` tests passed.
