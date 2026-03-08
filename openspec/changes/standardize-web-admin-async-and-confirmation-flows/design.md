## Overview

This change reduces repeated control-flow boilerplate in the web admin by standardizing common patterns for async actions, user confirmation, and error feedback. The main goal is to let page code describe domain intent while shared helpers manage loading state, confirmation sequencing, and normalized error handling.

## Goals

- Remove repeated async save/delete control flow from covered web admin pages.
- Keep confirmation UX and non-blocking feedback consistent across covered routes.
- Preserve existing mutation and routing behavior.
- Make new admin actions faster to implement and easier to review.

## Non-Goals

- Rewriting all web admin pages at once.
- Changing domain-specific validation rules or mutation payloads.
- Replacing all local page state with a single global abstraction.

## Architecture

### Shared admin action helpers

- Introduce reusable helpers/hooks for covered admin routes.
- Separate concerns between:
  - confirmation requests
  - async action execution
  - unknown error normalization
  - user-facing feedback state

### Adoption approach

- Start with high-duplication routes such as settings and CRUD-heavy admin pages.
- Prefer small wrappers that can compose with existing page state rather than a heavyweight framework abstraction.
- Keep page-level code responsible for domain inputs and mutation selection.

### Compatibility constraints

- Shared helpers must support existing action-specific copy and next-step guidance.
- Delete flows must preserve explicit user confirmation before mutation execution.
- Error handling must continue using safe normalized messages for covered paths.

## Risks and Mitigations

- Risk: abstraction becomes too generic and hard to use.
  - Mitigation: optimize for common covered web admin patterns only.
- Risk: page-specific UX details become harder to express.
  - Mitigation: allow per-call message and feedback configuration.
- Risk: partially adopted abstractions cause inconsistency.
  - Mitigation: define a clear set of covered paths and migrate them intentionally.

## Rollout Notes

- Land shared primitives first.
- Migrate a few representative admin surfaces.
- Use the migration pattern for future refactors and new admin features.
