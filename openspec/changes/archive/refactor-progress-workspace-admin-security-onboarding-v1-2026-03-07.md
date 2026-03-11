# Refactor Progress: Workspace Admin / Security / Onboarding Phase 1 (2026-03-07)

## Scope

- `packages/convex/convex/workspaces.ts`
- `packages/convex/convex/workspaceHostedOnboardingShared.ts`
- `packages/convex/convex/workspaceHostedOnboardingAccess.ts`
- `packages/convex/convex/workspaceHostedOnboardingQueries.ts`
- `packages/convex/convex/workspaceHostedOnboardingMutations.ts`
- `apps/web/src/app/settings/SecuritySettingsSection.tsx`
- `apps/web/src/app/settings/AuditLogViewer.tsx`
- `apps/web/src/app/settings/SecurityIdentitySettingsCard.tsx`
- `apps/web/src/app/settings/SignedSessionsSettings.tsx`
- `apps/web/src/app/audit-logs/page.tsx`

## Problem Addressed

The next cross-surface admin hotspot was the workspace admin/security/onboarding domain.

Before this pass:

- `workspaces.ts` bundled public workspace lookup, creation flows, hosted-onboarding state, hosted-onboarding verification signals, origin validation, signup policy, and help-center policy in one file.
- `SecuritySettingsSection.tsx` bundled the audit-log viewer, signed-session settings, identity-verification controls, retention settings, and route-level permission gating in one large web component.
- The backend and web surface were both carrying unrelated responsibilities inline, which made the domain harder to reason about and harder to change safely.

## What Was Refactored

1. Extracted hosted-onboarding shared logic into `workspaceHostedOnboardingShared.ts`.
2. Extracted hosted-onboarding workspace/member lookup helpers into `workspaceHostedOnboardingAccess.ts`.
3. Moved hosted-onboarding queries into `workspaceHostedOnboardingQueries.ts`.
4. Moved hosted-onboarding mutations into `workspaceHostedOnboardingMutations.ts`.
5. Rewired `workspaces.ts` into a thinner endpoint shell around:
   - workspace lookup/create/default flows
   - hosted-onboarding endpoint registration
   - remaining workspace policy/origin/update handlers
6. Moved the audit viewer into `AuditLogViewer.tsx` so it is no longer nested inside the security settings route component and can be imported directly by the audit-logs page.
7. Moved signed-session settings into `SignedSessionsSettings.tsx`.
8. Moved identity-verification controls into `SecurityIdentitySettingsCard.tsx`.
9. Reduced `SecuritySettingsSection.tsx` to permission gating, audit-retention wiring, and section composition.

## Result

- `workspaces.ts` is down to `370` lines from `756`.
- `SecuritySettingsSection.tsx` is down to `124` lines from `709`.
- `apps/web/src/app/audit-logs/page.tsx` now imports a dedicated `AuditLogViewer` component instead of reaching through the settings section file.
- Hosted onboarding is now an isolated backend module group rather than incidental logic inside the broader workspace settings file.
- The remaining work in this domain is more clearly bounded to mobile settings and the residual workspace policy/public-context slice.

## What Still Appears To Remain In This Track

- `apps/mobile/app/(app)/settings.tsx` is still the largest concentration in this domain and likely the next highest-value continuation.
- `workspaces.ts` still mixes:
  - public workspace context
  - origin validation / signup settings
  - help-center access policy
  - workspace creation/default-workspace flows
- If this track continues on the backend, the next clean pass is probably extracting the remaining workspace policy/public-context handlers rather than revisiting hosted onboarding.

## Compatibility Notes

- No `api.workspaces.*` endpoint names changed.
- No audit-log route URLs changed.
- This was a structural backend/web split, not a product-flow redesign.

## Verification

Passed:

- `pnpm --filter @opencom/convex typecheck`
- `bash -lc 'set -a; source packages/convex/.env.local; set +a; pnpm --filter @opencom/convex test -- --run tests/hostedOnboarding.test.ts tests/workspaceSettings.test.ts'`
- `pnpm --filter @opencom/web typecheck`

Notes:

- The focused Convex integration run completed green with `11` tests passed.
- That run still emitted the same remote `testing/helpers:*` stderr noise seen in other networked Convex test runs, but the assertions completed successfully.
- There is still no dedicated unit test file for `SecuritySettingsSection.tsx`; confidence for the web half of this slice comes from typecheck plus the unchanged route-level behavior.
