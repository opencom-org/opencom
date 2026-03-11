## Why

`packages/react-native-sdk/src/components/OpencomSurvey.tsx` (888 lines) and `OpencomMessenger.tsx` (739 lines) combine rendering, state orchestration, async loading, and interaction handling in large container components. This structure slows feature delivery and increases regression risk in core SDK UI flows.

## What Changes

- Decompose `OpencomSurvey` and `OpencomMessenger` into focused hooks, domain controllers, and presentational sections.
- Preserve existing runtime behavior for tab/navigation flow, conversation interactions, surveys, and UI states.
- Define explicit container contracts for shared subviews and data-loading hooks.
- Add targeted RN SDK tests for container behavior parity across key paths.

## Capabilities

### New Capabilities

- `rn-sdk-messenger-container-modularity`: RN SDK messenger and survey containers are decomposed into domain-scoped modules with explicit contracts.

### Modified Capabilities

- None.

## Impact

- RN SDK components: `OpencomMessenger.tsx`, `OpencomSurvey.tsx`, and extracted hooks/subcomponents.
- RN SDK component tests for messaging/survey behavior.
- Contributor workflow for UI feature development in SDK containers.
