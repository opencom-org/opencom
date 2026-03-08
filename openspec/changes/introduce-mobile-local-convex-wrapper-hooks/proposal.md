## Why

The mobile app performs direct Convex hook calls inside screens, contexts, and onboarding/inbox flows that also own navigation, permission-aware rendering, and device-local state. As mobile parity work expands across inbox, onboarding, settings, workspace selection, and visitor flows, direct generated hook usage increases coupling between transport concerns and mobile screen orchestration. A dedicated mobile-local wrapper-hook layer would make those screens easier to evolve safely while containing type and gating complexity in mobile-owned modules.

## What Changes

- Introduce mobile-local typed Convex wrapper hooks that isolate generated API ref usage behind app-owned mobile modules.
- Add a minimal mobile-local adapter boundary, where needed, so unavoidable type escape hatches live outside mobile screens and context modules.
- Provide explicit domain wrapper hooks first for onboarding/workspace selection, inbox/conversation flows, settings, and notification-related mobile domains.
- Allow route/controller hooks and context modules to compose domain wrappers while preserving mobile-specific navigation and state ownership.
- Preserve existing mobile behavior, Convex targets, payload semantics, and user-visible workflows.

## Capabilities

### New Capabilities
- `mobile-local-convex-wrapper-hooks`: Covers mobile-local typed wrapper hooks that isolate generated Convex hook complexity from mobile screens and contexts.

### Modified Capabilities
- `mobile-inbox-parity`: Clarify that growing mobile parity work may depend on a dedicated local data-access wrapper layer rather than embedding generated Convex hook details in screens.
- `cross-surface-backend-and-onboarding-domain-logic`: Clarify that shared onboarding/backend domain logic may be consumed through mobile-local wrapper boundaries without moving mobile screen transport concerns into shared code.

## Impact

- Affected code: `apps/mobile/app/**`, `apps/mobile/src/contexts/**`, new mobile-local wrapper layers under `apps/mobile/src`, and targeted mobile tests.
- Affected contributors: mobile contributors working on inbox, onboarding, settings, workspace selection, and notification-driven flows.
- Dependencies: no external dependency changes; mobile-local hook boundaries and typing conventions will be introduced.
