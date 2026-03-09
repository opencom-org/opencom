## 1. Stabilize the current verification baseline

- [ ] 1.1 Keep the lightweight `ConversationView` import smoke test active and document it as the first verification gate for future investigation.
- [ ] 1.2 Quarantine any `ConversationView` render-path test files that still hang at suite startup so they do not block broader widget verification.
- [ ] 1.3 Re-run the targeted widget suites already fixed during the timeout-based scan to confirm the baseline remains green after quarantine.

## 2. Isolate the render-path hang into smaller seams

- [ ] 2.1 Identify the smallest mount-time orchestration or effect path inside `ConversationView` that can be extracted or independently tested without mounting the full component.
- [ ] 2.2 Add focused tests around extracted render-only or orchestration-only seams using the timeout runner as the first verification path.
- [ ] 2.3 Confirm each new focused seam test completes under the timeout wrapper before adding broader integrated coverage.

## 3. Restore contract-preserving render coverage

- [ ] 3.1 Reintroduce `ConversationView` behavior coverage in small focused specs that preserve existing props, selectors, and widget shell expectations.
- [ ] 3.2 Run the relevant widget package verification commands, including timeout-based focused runs, after restoring render-path coverage.
- [ ] 3.3 Remove temporary quarantine only after the restored `ConversationView` coverage completes reliably without startup hangs.
