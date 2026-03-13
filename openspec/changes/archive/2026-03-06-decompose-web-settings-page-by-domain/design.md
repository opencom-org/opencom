## Context

The settings page currently owns large, mixed concerns:

- Team member lifecycle (invite, role updates, ownership transfer, invitation cancellation)
- Signup/auth policy controls
- Help-center access policy
- Email channel configuration
- Workspace and origin controls

The page includes both UI and mutation orchestration for each domain, producing a large, tightly coupled module.

## Goals / Non-Goals

**Goals**

- Isolate domain-specific settings logic and rendering into dedicated modules.
- Keep current behavior, permissions, and backend mutations unchanged.
- Make future domain changes local to their section module.

**Non-Goals**

- Rewriting section UX.
- Introducing new settings capabilities.
- Changing section ordering or visibility semantics.

## Decisions

### 1) Extract team-member business logic into a hook

Decision:

- Move invite/role/ownership/remove/cancel logic and related state into `useTeamMembersSettings`.

Rationale:

- This domain has the highest mutation/state density and can be isolated without API changes.

### 2) Extract section UI into focused components

Decision:

- Create dedicated section components for team members, signup/auth, help-center access, and email channel.

Rationale:

- Reduces page size and clarifies boundaries between orchestration and section implementation.

### 3) Preserve top-level ownership of cross-domain concerns

Decision:

- Keep global section expansion/deep-link behavior and shared page-level error feedback in `page.tsx`.

Rationale:

- These concerns coordinate all sections and should remain in the composition layer.

## Risks / Trade-offs

- [Risk] Prop wiring errors during extraction.
  - Mitigation: strict TypeScript props and targeted settings tests/typecheck.
- [Risk] Hidden behavior regressions in role/ownership flows.
  - Mitigation: preserve mutation call sequence and confirmation prompts exactly.

## Migration Plan

1. Extract team domain hook and section component.
2. Extract signup/help-center/email section components.
3. Recompose `settings/page.tsx` with new modules.
4. Run web typecheck + focused tests.

Rollback:

- Revert extracted modules and re-inline sections in `page.tsx` if regressions are found.

## Open Questions

- Should remaining sections (workspace/origins/backend/installations) follow the same extraction pattern in the next slice, or be combined with settings layout cleanup?
