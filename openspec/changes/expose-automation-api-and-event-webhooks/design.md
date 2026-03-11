## Context

Opencom already has rich backend behavior for conversations, tickets, outbound messages, visitors, and knowledge content, but that behavior is exposed today through Convex-authenticated functions and widget/session flows rather than a stable external platform API. Teams that want to run their own AI automation currently have no supported way to:

- sync an existing knowledge base into Opencom,
- filter and analyze conversations against custom attributes or external business IDs,
- poll for new work without scraping internal contracts,
- receive signed outbound events when inbox or AI trigger state changes,
- or safely let a custom agent reply without racing built-in AI or human agents.

The repo already has two useful building blocks:

- `packages/convex/convex/http.ts` provides the place to expose stable HTTP routes and existing webhook verification patterns.
- `notificationEvents` provides canonical internal event envelopes for chat/ticket/outbound/campaign activity, but it is notification-oriented and does not yet cover the full automation domain.

This change spans `packages/convex`, `apps/web`, docs, and likely shared types. The key constraints are multi-tenant isolation, least-privilege access, retry safety, durable observability, and preventing duplicate automated responses in active conversations.

## Goals / Non-Goals

**Goals:**

- Provide a stable versioned HTTP API for automation-critical support resources.
- Support polling and webhook-based automation using a shared canonical event model.
- Make external writes safe via scopes, idempotency, actor attribution, and audit logs.
- Let external automation coexist with built-in AI and human agents without ambiguous ownership.
- Support common migration and automation use cases such as knowledge import, conversation enrichment, ticket/report joins, and fallback reply generation.

**Non-Goals:**

- Exposing raw Convex function names or internal schema tables as the public contract.
- Shipping a hosted no-code automation builder in this change.
- Covering billing, authentication-provider management, or full workspace-admin parity in v1.
- Guaranteeing exactly-once webhook delivery or global ordering across every event type.

## Decisions

### 1) Publish a resource-oriented HTTP API instead of exposing Convex refs directly

Decision:

- Expose a versioned `/api/v1/...` HTTP API with JSON request/response contracts and resource-specific endpoints backed by shared domain services.

Rationale:

- External automation needs a durable contract that is decoupled from internal module names, Convex visibility rules, and refactoring churn.
- A resource API is easier for scripts, agents, and third-party tooling to consume than raw Convex function references.

Alternatives considered:

- Expose Convex HTTP wrappers around existing function names: rejected because it would leak internal structure and make refactors far riskier.
- Rely only on SDKs: rejected because many automation users want server-side scripts and non-JS agents.

### 2) Introduce workspace automation credentials and named automation actors

Decision:

- Add workspace-scoped automation credentials with explicit scopes, expiration/disable controls, and named automation actor metadata for attribution.

Rationale:

- External AI agents need machine credentials that do not inherit full admin access.
- Named actors make it possible to distinguish custom automation from human agents and built-in AI in audit logs and inbox history.

Alternatives considered:

- Reuse existing user sessions: rejected because service integrations should not depend on interactive user auth or long-lived browser sessions.
- OAuth-only install flow: rejected for v1 because API keys are simpler to ship and sufficient for first integrations.

### 3) Build a dedicated automation event ledger that powers both polling and webhooks

Decision:

- Add a dedicated automation event stream for resource and workflow changes, with bridge emitters from existing domains and compatible envelopes for webhook and poll consumers.

Rationale:

- `notificationEvents` covers only part of the needed domain and is optimized for internal notification fanout.
- A dedicated ledger lets us include article, collection, visitor, AI workflow, and webhook-replay semantics without coupling the public contract to internal notification routing.

Alternatives considered:

- Reuse `notificationEvents` as-is: rejected because it misses important automation events and would bind the external API to internal notification semantics.
- Separate polling and webhook payload models: rejected because it would create two inconsistent contracts for the same automation use cases.

### 4) Require idempotency keys and external-reference support on mutation hot paths

Decision:

- Require idempotency handling on create/send/activate-style endpoints and allow automation-managed resources to carry external references or mappings.

Rationale:

- Automation clients will retry aggressively after timeouts and network failures.
- External references are needed for knowledge imports, downstream joins, and safe upsert behavior across systems.

Alternatives considered:

- Best-effort retry with no idempotency guarantee: rejected because it invites duplicate articles, duplicate replies, and duplicate outbound activations.
- Deduplicate only by natural keys: rejected because many resources do not have a safe global natural key.

### 5) Add explicit claim/lease semantics for automation-managed conversation replies

Decision:

- External automation must claim a conversation for a bounded lease before posting automation-authored replies, and the claim can be released or escalated back to human handling.

Rationale:

- This prevents built-in AI, multiple external automations, and human operators from posting conflicting replies during the same automation window.
- Lease semantics keep failure recovery manageable when an external worker dies mid-flow.

Alternatives considered:

- Allow any authorized automation to reply at any time: rejected because it creates race conditions and duplicate responses.
- Hard disable built-in AI whenever an API key exists: rejected because many teams want hybrid automation, not full replacement.

### 6) Deliver webhooks with signed at-least-once semantics and replay tooling

Decision:

- Webhook events use HMAC signatures, stable event IDs, retry with backoff, delivery attempt records, and manual replay from stored payloads.

Rationale:

- This is the most practical reliability model for automation consumers and matches the need for cron/webhook hybrid strategies.
- Delivery logs and replay are necessary for debugging production automations.

Alternatives considered:

- Fire-and-forget webhook delivery: rejected because silent loss is unacceptable for automation triggers.
- Exactly-once delivery guarantees: rejected because the complexity is not justified for a first public contract.

### 7) Roll out behind a feature flag with a documented v1 resource matrix

Decision:

- Gate the automation platform behind workspace feature flags and document the exact resource/event coverage that is supported in v1.

Rationale:

- The requested surface area is broad, so a controlled rollout is the safest way to validate rate limits, event volume, and cross-domain consistency.
- A published coverage matrix avoids ambiguity around what “CRUD on everything” means in the first supported release.

Alternatives considered:

- Immediate GA with implicit coverage: rejected because support burden and contract ambiguity would be too high.

## Risks / Trade-offs

- [Risk] Broad public API scope increases maintenance burden and versioning pressure.
  - Mitigation: keep the external contract resource-oriented, publish a v1 coverage matrix, and require versioned additive evolution.
- [Risk] Webhook/event volume could create noisy retry storms for busy workspaces.
  - Mitigation: per-subscription filters, backoff, replay tooling, and rate-limited delivery workers.
- [Risk] External credentials create a high-value exfiltration path.
  - Mitigation: hashed secret storage, one-time reveal, least-privilege scopes, audit logs, and admin-only management.
- [Risk] Built-in AI and external automation can race on active conversations.
  - Mitigation: claim leases, explicit automation eligibility state, and conflict rejection for concurrent automated sends.
- [Risk] Knowledge migrations and analytics joins may need bulk throughput beyond naive CRUD loops.
  - Mitigation: support idempotent upserts now and leave async batch endpoints as a documented follow-on if real usage proves necessary.

## Migration Plan

1. Add persistence and shared services for automation credentials, named actors, claims, event ledger, webhook subscriptions, and webhook delivery attempts.
2. Expose HTTP auth middleware, scope enforcement, rate limiting, and idempotency handling in `packages/convex/convex/http.ts` and related modules.
3. Ship read/write endpoints for the initial resource matrix, including filters, cursors, external references, and automation-authored reply paths.
4. Emit automation events from conversations, messages, tickets, visitors, knowledge, outbound, and AI workflow transitions.
5. Ship webhook management, delivery logs, and replay UI in `apps/web`.
6. Publish developer and security docs, run beta with flagged workspaces, then expand after event and latency review.

Rollback strategy:

- Disable the feature flag for new automation API and webhook usage.
- Stop webhook dispatch workers while preserving stored events, delivery attempts, and audit history.
- Revoke active automation credentials if necessary while keeping authored resource history intact.

## Open Questions

- Should v1 support only API keys, or should service-account/OAuth install flows be part of the first external release?
- Which proactive-send actions belong in v1: conversation replies only, outbound message CRUD only, or direct proactive message send as well?
- Is a per-workspace monotonic event cursor sufficient, or do some domains require stronger per-resource ordering guarantees?
- Do large knowledge-base and visitor backfills require async bulk job endpoints in v1, or can idempotent paginated upserts cover the first release?
