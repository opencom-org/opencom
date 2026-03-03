## 1. Shell Safety Baseline

- [ ] 1.1 Move hook declarations and shell callback setup so `Widget` has deterministic hook ordering across all render paths.
- [ ] 1.2 Add/adjust lint coverage and regression checks to prevent reintroduction of conditional hook declarations in widget shell code.

## 2. Domain Extraction

- [ ] 2.1 Extract workspace/origin validation flow into a dedicated shell validation hook with explicit state outputs.
- [ ] 2.2 Extract blocking arbitration (tour/outbound/large survey) into a dedicated hook that preserves existing priority semantics.
- [ ] 2.3 Extract tab/home visibility and selection maintenance into a dedicated hook, keeping current fallback behavior.
- [ ] 2.4 Extract unread cue and notification preference update flow into a dedicated hook/module.

## 3. Behavioral Parity Verification

- [ ] 3.1 Add targeted tests for blocker priority and error-path rendering behavior.
- [ ] 3.2 Add targeted tests for callback bridge registration/update/cleanup behavior.
- [ ] 3.3 Run widget package lint/typecheck/tests and relevant integration checks for widget orchestration paths.

## 4. Cleanup And Documentation

- [ ] 4.1 Remove obsolete in-file orchestration logic and dead state branches from `Widget.tsx`.
- [ ] 4.2 Document module boundaries and ownership expectations for future contributors in widget shell code comments/docs.
