## 1. Refactor Baseline And Contracts

- [x] 1.1 Define domain boundaries for inbox orchestration (selection sync, compact panels, suggestions, attention cues, message actions).
- [x] 1.2 Add typed contracts for each domain hook/module and establish page-level composition interfaces.

## 2. Domain Extraction

- [x] 2.1 Extract query-param and selected-conversation synchronization into a dedicated hook/module.
- [x] 2.2 Extract compact panel open/close/reset behavior into a dedicated hook/module.
- [x] 2.3 Extract suggestions-count loading/error behavior into a dedicated hook/module.
- [x] 2.4 Extract attention-cue snapshot, suppression, sound/browser notification, and title-update behavior into a dedicated hook/module.
- [x] 2.5 Extract message-action helpers (send/resolve/convert/mark-read side effects) into focused helpers/hooks.

## 3. Behavioral Parity Tests

- [x] 3.1 Add tests for URL-selection synchronization invariants.
- [x] 3.2 Add tests for compact panel reset rules across viewport and sidecar toggles.
- [x] 3.3 Add tests for unread cue suppression and title-update behavior.

## 4. Verification And Cleanup

- [x] 4.1 Remove obsolete page-local state/effect logic after extraction.
- [x] 4.2 Run targeted web lint/typecheck/tests for inbox paths and resolve regressions.
- [x] 4.3 Document inbox module ownership and extension points for future contributors.
