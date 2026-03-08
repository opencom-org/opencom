## Why

Web and mobile surfaces each implement overlapping backend selection, workspace selection, and onboarding decision logic. This duplication increases the likelihood of parity drift, forces bug fixes to be repeated across surfaces, and makes future contributor changes more expensive.

## What Changes

- Extract shared cross-surface domain logic for backend selection, workspace selection, and onboarding decision flows where behavior is intended to stay aligned.
- Reduce duplicated surface-specific implementations for domain rules that do not need separate ownership.
- Preserve current surface UX while clarifying the shared domain rules both surfaces depend on.
- Keep truly surface-specific rendering and navigation concerns local to each app.

## Capabilities

### New Capabilities
- `cross-surface-backend-and-onboarding-domain-logic`: Covers shared domain rules for backend selection, workspace selection, and onboarding decision behavior used across web and mobile.

### Modified Capabilities
- `cross-surface-notification-cues`: No changes.

## Impact

- Affected code: web/mobile backend context logic, workspace selection logic, onboarding decision helpers, and shared packages that may become the new home for common domain rules.
- Affected contributors: web and mobile contributors working on onboarding and environment/workspace flow logic.
- Dependencies: no external dependency changes required; shared package boundaries may expand.
