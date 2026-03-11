## Overview

This change makes Convex authorization boundaries easier to understand and safer to evolve by splitting central wrapper logic into clearer responsibilities. The design goal is not to remove wrappers, but to prevent wrapper modules from becoming the implicit home for all auth-related decisions.

## Goals

- Isolate authentication, workspace resolution, and permission enforcement concerns.
- Make production access-control code easier to review and test in focused units.
- Reduce drift between production boundary behavior and backend test helpers.
- Preserve current authorization semantics and handler contracts.

## Non-Goals

- Redesigning permission models or roles.
- Changing client-visible authorization behavior.
- Rewriting all Convex modules in one pass.

## Architecture

### Production boundary split

- Keep thin query/mutation/action wrapper entry points.
- Extract focused modules for:
  - authenticated user resolution
  - workspace resolution from args/entities/context
  - permission checks and denial behavior
- Keep wrapper modules responsible for orchestration rather than housing all policy details.

### Test helper consolidation

- Consolidate auth/session/internal mutation helpers under clearer test-only ownership.
- Avoid duplicating production-like access setup logic across multiple helper files.
- Ensure test helper naming makes the boundary between production semantics and test conveniences explicit.

## Risks and Mitigations

- Risk: access-control regressions during extraction.
  - Mitigation: preserve existing call paths and add focused verification around authorization scenarios.
- Risk: helper sprawl simply moves to more files.
  - Mitigation: extract by responsibility and enforce clear module ownership.
- Risk: test helpers accidentally bypass production semantics.
  - Mitigation: keep production boundary modules authoritative and make test wrappers explicit adapters.

## Rollout Notes

- Start with extraction around `authWrappers.ts`.
- Follow with helper consolidation in test support modules.
- Validate critical authorization paths before broader backend refactors build on the new boundaries.
