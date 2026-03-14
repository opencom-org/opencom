## Why

Teams moving support operations into Opencom want to plug in their own AI systems, data pipelines, and automations instead of being limited to built-in behavior. Today Opencom exposes internal Convex and SDK surfaces, but it does not offer a stable external API or outbound event contract for syncing knowledge, enriching conversations with business data, or letting a custom agent safely take action.

## What Changes

- Add a versioned automation HTTP API for CRUD access to automation-critical workspace resources including conversations, messages, visitors, tickets, ticket comments, articles, collections, outbound messages, and custom attributes, with knowledge resources (articles and collections) landing before the remaining follow-on inbox surfaces.
- Add incremental sync, filter, and idempotency primitives so external scripts and agents can import knowledge, backfill metadata, and safely retry writes without creating duplicates.
- Add outbound webhook subscriptions for automation trigger events, plus a polling-friendly event feed for cron-based integrations that do not want webhooks.
- Add workspace-scoped automation credentials, scopes, rate limits, audit attribution, and delivery observability.
- Add conversation coordination controls so external automation can observe AI workflow state, take over on handoff or fallback paths, and avoid duplicate automated replies.

## Capabilities

### New Capabilities

- `automation-resource-api`: External HTTP contract for CRUD, filtering, sync, and idempotent mutations over automation-critical support resources.
- `automation-event-webhooks`: Outbound event delivery and polling feed for conversation, ticket, knowledge, visitor, outbound, and AI trigger events.
- `automation-access-governance`: Workspace automation credentials, scoped permissions, audit attribution, secret lifecycle, and rate limiting.
- `automation-conversation-coordination`: Safe coexistence rules between built-in AI, human operators, and external automation on active conversations.

### Modified Capabilities

- None.

## Impact

- `packages/convex` HTTP routing, auth middleware, event emission, webhook delivery, and new persistence for credentials, event delivery, and automation claims.
- `apps/web` settings/admin surfaces for API keys, webhook endpoints, delivery logs, and automation controls.
- Inbox and AI workflow metadata so automation-authored actions remain distinguishable from human and built-in AI actions.
- Developer and security documentation for external API usage, scopes, webhook verification, retry semantics, and rollout constraints.
