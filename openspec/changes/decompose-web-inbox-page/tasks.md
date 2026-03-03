## 1. Refactor Baseline And Contracts

- [ ] 1.1 Define domain boundaries for inbox orchestration (selection sync, compact panels, suggestions, attention cues, message actions).
- [ ] 1.2 Add typed contracts for each domain hook/module and establish page-level composition interfaces.

## 2. Domain Extraction

- [ ] 2.1 Extract query-param and selected-conversation synchronization into a dedicated hook/module.
- [ ] 2.2 Extract compact panel open/close/reset behavior into a dedicated hook/module.
- [ ] 2.3 Extract suggestions-count loading/error behavior into a dedicated hook/module.
- [ ] 2.4 Extract attention-cue snapshot, suppression, sound/browser notification, and title-update behavior into a dedicated hook/module.
- [ ] 2.5 Extract message-action helpers (send/resolve/convert/mark-read side effects) into focused helpers/hooks.

## 3. Behavioral Parity Tests

- [ ] 3.1 Add tests for URL-selection synchronization invariants.
- [ ] 3.2 Add tests for compact panel reset rules across viewport and sidecar toggles.
- [ ] 3.3 Add tests for unread cue suppression and title-update behavior.

## 4. Verification And Cleanup

- [ ] 4.1 Remove obsolete page-local state/effect logic after extraction.
- [ ] 4.2 Run targeted web lint/typecheck/tests for inbox paths and resolve regressions.
- [ ] 4.3 Document inbox module ownership and extension points for future contributors.
