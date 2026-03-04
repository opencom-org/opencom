## 1. Internal Service Setup

- [ ] 1.1 Define internal module interfaces for session, storage, push, and lifecycle responsibilities.
- [ ] 1.2 Introduce a shared state container used by orchestrator services.

## 2. Incremental Extraction

- [ ] 2.1 Move session initialization/identify/logout logic into session service.
- [ ] 2.2 Move persistence logic into storage service.
- [ ] 2.3 Move push registration/unregistration logic into push service.
- [ ] 2.4 Move app lifecycle/timer orchestration into lifecycle service.

## 3. Parity Verification

- [ ] 3.1 Add/extend RN SDK tests for public API behavior parity across extracted services.
- [ ] 3.2 Run RN SDK typecheck/tests and fix regressions.

## 4. Cleanup

- [ ] 4.1 Remove obsolete monolithic branches from `OpencomSDK.ts`.
- [ ] 4.2 Document internal module ownership and extension guidance.
