## Context

Auth wrappers exist in `lib/authWrappers.ts`, but adoption is partial. Multiple modules still repeat ad-hoc auth/permission checks with varying patterns.

## Goals / Non-Goals

**Goals:**

- Adopt wrappers in remaining high-impact modules where semantics align.
- Preserve existing endpoint contracts and non-auth behavior.
- Avoid introducing permission behavior drift for endpoints that intentionally soft-fail (return `null` / `[]` / `0`).

**Non-Goals:**

- Changing product-facing permission policies.
- Changing endpoint names/args.
- Rewriting modules that intentionally need bespoke access behavior beyond wrappers.

## Decisions

### 1) Wrapper adoption where unauthorized behavior already throws

Decision:

- Use `authMutation`/`authQuery` on endpoints that currently throw for unauthorized access.

Rationale:

- Matches wrapper semantics directly and removes repetitive boilerplate.

### 2) Preserve soft-fail read paths

Decision:

- Keep bespoke `hasPermission` checks for read paths that intentionally return `null`/`[]`/`0` instead of throwing.

Rationale:

- Prevents behavior drift while still reducing duplication elsewhere.

### 3) Use resolver-based workspace permission for ID-only mutations

Decision:

- Use `resolveWorkspaceId` in wrappers for `update/remove` style endpoints where workspace ID is discovered from entity lookup.

Rationale:

- Keeps permission checks centralized without changing endpoint args.

## Risks / Trade-offs

- [Risk] Behavior drift for endpoints with nuanced auth fallback.
  - Mitigation: adopt wrappers only where semantics match, retain bespoke soft-fail paths.
- [Risk] Type-depth pressure from generated API references.
  - Mitigation: keep wrapper adoption scoped and verify dependent typechecks.

## Migration Plan

1. Convert mutation/query endpoints with direct throw-on-unauthorized semantics.
2. Keep soft-fail query paths unchanged.
3. Validate Convex + dependent package typechecks.
4. Update progress docs and remaining-map tracker.

Rollback:

- Revert wrapped endpoints back to explicit auth/permission checks.
