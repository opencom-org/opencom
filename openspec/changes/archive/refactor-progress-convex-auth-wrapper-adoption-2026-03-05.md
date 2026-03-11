# Refactor Progress: Convex Auth Wrapper Adoption (2026-03-05)

## Scope

- `packages/convex/convex/segments.ts`
- `packages/convex/convex/assignmentRules.ts`
- `packages/convex/convex/commonIssueButtons.ts`
- `packages/convex/convex/identityVerification.ts`
- `packages/convex/convex/workspaceMembers.ts`
- `packages/convex/convex/workspaces.ts`
- `openspec/changes/expand-convex-auth-wrapper-adoption/*`

## Problem Addressed

These modules still duplicated auth + permission logic with repeated `getAuthenticatedUserFromSession` and `requirePermission` patterns.

## What Was Refactored

1. Adopted `authMutation`/`authQuery` wrappers for endpoints with throw-on-unauthorized semantics.
2. Added resolver-based workspace permission resolution for ID-only mutation endpoints (`update/remove` patterns).
3. Preserved soft-fail read paths that intentionally return `null` / `[]` / `0`.
4. Added bounded typing in one deep generated API callsite (`workspaceMembers.inviteToWorkspace`) to keep downstream typechecks stable.

## Result

- Auth boundary behavior is more centralized and consistent across major Convex domains.
- Endpoint names/signatures remain unchanged.
- Soft-fail access behavior is preserved where previously intentional.

## Compatibility Notes (Web / Widget / Mobile / SDKs)

- No contract changes for callers.
- Verified compatibility across web/widget/mobile/sdk-core/react-native-sdk typechecks.

## Verification

Passed:

- `pnpm --filter @opencom/convex typecheck`
- `pnpm --filter @opencom/web typecheck`
- `pnpm --filter @opencom/widget typecheck`
- `pnpm --filter @opencom/mobile typecheck`
- `pnpm --filter @opencom/sdk-core typecheck`
- `pnpm --filter @opencom/react-native-sdk typecheck`
- `openspec validate expand-convex-auth-wrapper-adoption --strict --no-interactive`
