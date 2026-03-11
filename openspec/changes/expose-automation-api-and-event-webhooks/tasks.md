## 1. Automation Platform Foundations

- [ ] 1.1 Add persistence and shared services for automation credentials, automation actors, conversation claims, automation events, webhook subscriptions, and delivery attempts.
- [ ] 1.2 Implement HTTP auth, scope enforcement, secret hashing, one-time secret reveal, rate limiting, and idempotency middleware for automation routes.
- [ ] 1.3 Define the v1 resource and event coverage matrix used by implementation, docs, and rollout gating.

## 2. Resource API Surface

- [ ] 2.1 Implement versioned HTTP endpoints for core automation resources: conversations, messages, visitors, tickets, ticket comments, articles, collections, outbound messages, and custom events.
- [ ] 2.2 Add cursor pagination, updated-since sync, external reference support, and server-side filters including custom-attribute-aware lookups where applicable.
- [ ] 2.3 Implement idempotent mutation handling for create, update, send, activate, and delete hot paths that automation clients will retry.

## 3. Event Feed And Webhook Delivery

- [ ] 3.1 Implement a canonical automation event ledger and emit events from conversation, ticket, visitor, knowledge, outbound, and AI workflow changes.
- [ ] 3.2 Expose a polling endpoint that reads the same canonical event stream used for webhook delivery.
- [ ] 3.3 Implement webhook subscription management, HMAC signatures, retry/backoff scheduling, delivery attempt storage, and manual replay.

## 4. Conversation Coordination

- [ ] 4.1 Expose automation-relevant conversation metadata including AI workflow state, handoff reason, claim state, and automation eligibility.
- [ ] 4.2 Implement claim, release, and escalate flows for automation-managed conversations with bounded lease semantics.
- [ ] 4.3 Enforce conflict protection so built-in AI and concurrent external automations cannot post duplicate automated replies into the same conversation window.

## 5. Admin Experience And Documentation

- [ ] 5.1 Build admin settings UI for credential management, scope review, webhook endpoints, delivery logs, and replay actions.
- [ ] 5.2 Update developer and security docs for authentication, scopes, rate limits, idempotency, webhook verification, event semantics, and rollout limitations.
- [ ] 5.3 Gate the feature behind workspace flags and add rollout instrumentation for request volume, webhook failures, and automation conflict rates.

## 6. Verification

- [ ] 6.1 Add focused tests for auth scopes, rate limits, idempotency, external references, and filtered incremental sync behavior.
- [ ] 6.2 Add focused tests for event emission parity, webhook signature verification, retry/replay flows, and delivery observability.
- [ ] 6.3 Add focused tests for automation claim leases, AI/external race handling, and duplicate automated reply prevention.
- [ ] 6.4 Run targeted package checks for touched surfaces and strict `openspec validate expose-automation-api-and-event-webhooks --strict --no-interactive`.
