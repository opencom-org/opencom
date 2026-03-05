# Refactor Progress: Web Settings Domain Decomposition (2026-03-05)

## Scope

- `apps/web/src/app/settings/page.tsx`
- `apps/web/src/app/settings/useTeamMembersSettings.ts`
- `apps/web/src/app/settings/TeamMembersSection.tsx`
- `apps/web/src/app/settings/SignupAuthSection.tsx`
- `apps/web/src/app/settings/HelpCenterAccessSection.tsx`
- `apps/web/src/app/settings/EmailChannelSection.tsx`

## Problem Addressed

`settings/page.tsx` mixed multiple domain concerns (team membership, signup/auth policy, help center policy, email channel) with page composition behavior in a single large file.

## What Was Refactored

1. Extracted team domain mutation/state logic into `useTeamMembersSettings`.
2. Extracted team members UI (including role-confirm + transfer-ownership modals) into `TeamMembersSection`.
3. Extracted signup/auth policy UI into `SignupAuthSection`.
4. Extracted help-center policy UI into `HelpCenterAccessSection`.
5. Extracted email-channel UI into `EmailChannelSection`.
6. Recomposed `settings/page.tsx` to orchestrate sections and shared page concerns only.

## Result

- `apps/web/src/app/settings/page.tsx` reduced to 778 lines (from ~1399 lines before extraction).
- Domain-specific logic now lives in dedicated modules aligned with OpenSpec slice boundaries.
- Section visibility, deep-link section expansion, and permissions behavior are preserved.

## Compatibility Notes (Mobile / SDK / Convex)

- No Convex function signatures changed.
- No shared package APIs changed (`@opencom/types`, `@opencom/sdk-core`, `@opencom/react-native-sdk`).
- This slice is web-only composition refactoring.

## Verification

Passed:

- `pnpm --filter @opencom/web typecheck`
- `pnpm --filter @opencom/web test -- src/app/settings/MessengerSettingsSection.test.tsx`
