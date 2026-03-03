## 1. Module Boundary Setup

- [ ] 1.1 Define notification domain boundaries (recipients, routing, delivery channels, event emitters) and create target module layout.
- [ ] 1.2 Add typed internal contracts for shared notification context and payload helpers.

## 2. Incremental Extraction

- [ ] 2.1 Extract pure helper logic (formatting, truncation, metadata rendering, batch selection) into focused utility modules.
- [ ] 2.2 Extract recipient-resolution logic into dedicated modules for agent and visitor audiences.
- [ ] 2.3 Extract channel-dispatch orchestration (email/push scheduling and logging) into dedicated modules.
- [ ] 2.4 Extract event-specific emitters for chat and ticket events while keeping existing exported entry points stable.

## 3. Parity Verification

- [ ] 3.1 Add tests for new visitor message routing and recipient selection parity.
- [ ] 3.2 Add tests for debounced support-reply email batching parity.
- [ ] 3.3 Add tests for ticket notification routing parity (assignment/status/comment paths).

## 4. Cleanup And Validation

- [ ] 4.1 Remove obsolete monolithic logic from `notifications.ts` after extraction.
- [ ] 4.2 Run targeted Convex typecheck/tests and strict OpenSpec validation for the change.
- [ ] 4.3 Document notification module ownership and extension patterns for contributors.
