## Why

`packages/react-native-sdk/src/OpencomSDK.ts` currently mixes initialization, session state, persistence, push registration, and lifecycle timers in one 792-line orchestrator with global mutable state. This makes behavior changes risky and hard to isolate.

## What Changes

- Split `OpencomSDK.ts` into focused orchestrator modules for session, storage, push, and lifecycle responsibilities.
- Keep the public `OpencomSDK` API stable while delegating internals to typed services.
- Preserve initialization, identify/logout, and push registration semantics.
- Add targeted tests for lifecycle and push/session integration behavior.

## Capabilities

### New Capabilities

- `rn-sdk-orchestrator-modularity`: React Native SDK orchestration is implemented through dedicated internal modules with stable API facade behavior.

### Modified Capabilities

- None.

## Impact

- `packages/react-native-sdk/src/OpencomSDK.ts` and new internal orchestrator modules.
- RN SDK tests for initialization, persistence, push registration, and lifecycle behavior.
- Improved maintainability for future SDK feature work.
