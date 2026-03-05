## 1. Module Boundary Setup

- [x] 1.1 Define notification domain boundaries (recipients, routing, delivery channels, event emitters) and create target module layout.
- [x] 1.2 Add typed internal contracts for shared notification context and payload helpers.

## 2. Incremental Extraction

- [x] 2.1 Extract pure helper logic (formatting, truncation, metadata rendering, batch selection) into focused utility modules.
- [x] 2.2 Extract recipient-resolution logic into dedicated modules for agent and visitor audiences.
- [x] 2.3 Extract channel-dispatch orchestration (email/push scheduling and logging) into dedicated modules.
- [x] 2.4 Extract event-specific emitters for chat and ticket events while keeping existing exported entry points stable.

## 3. Parity Verification

- [x] 3.1 Add tests for new visitor message routing and recipient selection parity.
- [x] 3.2 Add tests for debounced support-reply email batching parity.
- [x] 3.3 Add tests for ticket notification routing parity (assignment/status/comment paths).

## 4. Cleanup And Validation

- [x] 4.1 Remove obsolete monolithic logic from `notifications.ts` after extraction.
- [x] 4.2 Run targeted Convex typecheck/tests and strict OpenSpec validation for the change.
- [x] 4.3 Document notification module ownership and extension patterns for contributors.
