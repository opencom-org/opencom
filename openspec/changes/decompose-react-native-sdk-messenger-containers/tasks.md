## 1. Domain Boundary Definition

- [ ] 1.1 Define messenger and survey orchestration domains and target module layout.
- [ ] 1.2 Extract presentational subcomponents with stable prop contracts.

## 2. Hook/Controller Extraction

- [ ] 2.1 Extract messenger orchestration hooks (message flow, tab state, AI feedback, article suggestions).
- [ ] 2.2 Extract survey orchestration hooks (question progression, validation, submission state).
- [ ] 2.3 Recompose shell containers using extracted hooks/components.

## 3. Parity Tests

- [ ] 3.1 Add tests for messenger flow parity (send, status, tab navigation, AI cues).
- [ ] 3.2 Add tests for survey progression parity (step transitions, completion, retry/error states).

## 4. Cleanup

- [ ] 4.1 Remove obsolete monolithic logic from container files.
- [ ] 4.2 Document module ownership and extension conventions.
