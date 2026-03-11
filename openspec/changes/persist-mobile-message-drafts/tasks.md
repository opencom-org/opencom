## 1. Draft Persistence Primitive

- [ ] 1.1 Add a typed mobile draft storage helper that reads, writes, and clears conversation drafts using a backend/operator/workspace/conversation-scoped key.
- [ ] 1.2 Add focused mobile unit coverage for draft payload persistence and scope-key isolation behavior.

## 2. Conversation Composer Integration

- [ ] 2.1 Hydrate `apps/mobile/app/(app)/conversation/[id].tsx` from persisted draft state when a conversation loads and keep draft storage synchronized while the operator edits or backgrounds the app.
- [ ] 2.2 Clear the persisted draft only after successful send, while preserving current retry behavior when send fails or the conversation scope changes.

## 3. Verification

- [ ] 3.1 Add or update mobile tests covering draft restore after app switch/remount, conversation/account isolation, and clear-on-send behavior.
- [ ] 3.2 Run targeted mobile verification, including `pnpm --filter @opencom/mobile typecheck` and the touched draft-persistence tests.
