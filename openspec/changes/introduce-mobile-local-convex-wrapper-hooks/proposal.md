## Why

The mobile app still performs direct Convex hook calls inside screens and context modules that also own navigation, permission-aware rendering, and device-local state. A March 11, 2026 repo scan confirmed the remaining direct usage is concentrated in `AuthContext.tsx`, `NotificationContext.tsx`, `app/(app)/index.tsx`, `app/(app)/conversation/[id].tsx`, `app/(app)/settings.tsx`, and `app/(app)/onboarding.tsx`, which makes this the highest-value remaining wrapper-boundary migration.

## What Changes

- Introduce mobile-local typed Convex wrapper hooks that isolate generated API ref usage behind app-owned mobile modules.
- Add a minimal mobile-local adapter boundary, where needed, so unavoidable type escape hatches live outside mobile screens and context modules.
- Provide explicit domain wrapper hooks first for auth/workspace selection, onboarding, inbox/conversation, settings, and notification-related mobile domains.
- Allow route/controller hooks and context modules to compose domain wrappers while preserving mobile-specific navigation and state ownership.
- Cover the remaining direct mobile hook consumers identified in the March 11, 2026 scan while keeping `app/_layout.tsx` as the accepted provider boundary.
- Preserve existing mobile behavior, Convex targets, payload semantics, and user-visible workflows.

## Capabilities

### New Capabilities
- `mobile-local-convex-wrapper-hooks`: Covers mobile-local typed wrapper hooks that isolate generated Convex hook complexity from mobile screens and contexts.

### Modified Capabilities
- `mobile-inbox-parity`: Clarify that growing mobile parity work may depend on a dedicated local data-access wrapper layer rather than embedding generated Convex hook details in screens.
- `cross-surface-backend-and-onboarding-domain-logic`: Clarify that shared onboarding/backend domain logic may be consumed through mobile-local wrapper boundaries without moving mobile screen transport concerns into shared code.

## Impact

- Affected code: `apps/mobile/src/contexts/{AuthContext,NotificationContext}.tsx`, `apps/mobile/app/(app)/{index,onboarding,settings}.tsx`, `apps/mobile/app/(app)/conversation/[id].tsx`, `apps/mobile/app/_layout.tsx` as the allowed provider boundary, new mobile-local wrapper layers under `apps/mobile/src`, and targeted mobile verification flows.
- Affected contributors: mobile contributors working on inbox, onboarding, settings, workspace selection, and notification-driven flows.
- Dependencies: no external dependency changes; mobile-local hook boundaries and typing conventions will be introduced.
