## 1. Automation Platform Foundations

- [x] 1.1 Add persistence and shared services for automation credentials, automation actors, conversation claims, automation events, webhook subscriptions, and delivery attempts.
- [x] 1.2 Implement HTTP auth, scope enforcement, secret hashing, one-time secret reveal, rate limiting, and idempotency middleware for automation routes.
- [ ] 1.3 Define the v1 resource and event coverage matrix used by implementation, docs, and rollout gating.

## 2. Resource API Surface

- [x] 2.1 Implement versioned HTTP endpoints for v1 core resources: conversations, messages, visitors, and tickets.
- [ ] 2.1b Extend API to remaining resources: ticket comments, articles, collections, outbound messages, and custom events.
- [x] 2.2 Add cursor pagination, updated-since sync, and server-side filters for v1 resources.
- [ ] 2.2b Add external reference support and custom-attribute-aware lookups.
- [x] 2.3 Implement idempotent mutation handling for message send path via Idempotency-Key header.
- [ ] 2.3b Extend idempotency to remaining mutation hot paths (create, update, activate, delete).

## 3. Event Feed And Webhook Delivery

- [x] 3.1 Implement a canonical automation event ledger with emitEvent internal mutation.
- [ ] 3.1b Wire emitEvent calls into existing domain files (conversations, messages, tickets, visitors) so events are actually emitted on resource changes.
- [x] 3.2 Expose a polling endpoint that reads the canonical event stream.
- [x] 3.3 Implement webhook subscription management, HMAC signatures, retry/backoff scheduling, delivery attempt storage, and manual replay.

## 4. Conversation Coordination

- [x] 4.1 Expose automation-relevant conversation metadata including AI workflow state, handoff reason, claim state, and automation eligibility.
- [x] 4.2 Implement claim, release, and escalate flows for automation-managed conversations with bounded lease semantics.
- [x] 4.3 Enforce conflict protection: claimed conversations require active claim for automation message send.
- [x] 4.3b Modify AI agent response path to check for active automation claim before posting AI response.

## 5. Admin Experience And Documentation

- [ ] 5.1 Build admin settings UI for credential management, scope review, webhook endpoints, delivery logs, and replay actions.
- [ ] 5.2 Update developer and security docs for authentication, scopes, rate limits, idempotency, webhook verification, event semantics, and rollout limitations.
- [x] 5.3 Gate the feature behind workspace flags (`automationApiEnabled` on workspaces table).
- [ ] 5.3b Add rollout instrumentation for request volume, webhook failures, and automation conflict rates.

## 6. Verification

- [x] 6.1 Add unit tests for automation scopes and API helper utilities (21 tests passing).
- [x] 6.2 Add integration test stubs for credential auth enforcement.
- [ ] 6.2b Add integration tests for full credential CRUD, API resource endpoints, event emission, webhook delivery, and claim lifecycle (requires test deployment).
- [x] 6.3 Run typecheck — passes clean with 0 errors.
- [ ] 6.4 Run full test suite against test deployment and validate end-to-end flow.
