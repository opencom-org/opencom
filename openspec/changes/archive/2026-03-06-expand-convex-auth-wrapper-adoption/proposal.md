## Why

Several Convex modules still hand-roll authentication/permission checks via repeated `getAuthenticatedUserFromSession` + `requirePermission` patterns.

This duplicates logic, increases drift risk, and makes permission semantics harder to reason about across domains.

## What Changes

- Adopt `authMutation` / `authQuery` / `authAction` wrappers in remaining high-impact modules where behavior is compatible.
- Centralize workspace permission resolution via wrapper `workspaceIdArg` and `resolveWorkspaceId` options.
- Preserve endpoint names, args, and non-auth behavior semantics.

## Capabilities

### New Capabilities

- `convex-auth-wrapper-adoption`: remaining Convex domain endpoints use shared auth wrappers for consistent authentication/permission boundaries.

### Modified Capabilities

- None.

## Impact

- Affected code (target set):
  - `packages/convex/convex/workspaces.ts`
  - `packages/convex/convex/workspaceMembers.ts`
  - `packages/convex/convex/identityVerification.ts`
  - `packages/convex/convex/segments.ts`
  - `packages/convex/convex/assignmentRules.ts`
  - `packages/convex/convex/commonIssueButtons.ts`
- APIs:
  - No endpoint name/signature changes.
- Dependencies:
  - No new external dependencies.
