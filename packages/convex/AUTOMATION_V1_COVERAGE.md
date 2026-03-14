# Automation API — V1 Coverage Matrix

## Resource Coverage

| Resource | List | Get | Create | Update | Delete | Events |
|---|---|---|---|---|---|---|
| conversations | cursor + filters (status, assignee, channel, email, externalUserId, customAttribute) | by ID | — | status, assign | — | `conversation.created`, `conversation.updated` |
| messages | cursor + filters (conversationId) | — | send | — | — | `message.created` |
| visitors | cursor + filters (email, externalUserId, customAttribute) | by ID | create | update | — | `visitor.updated` |
| tickets | cursor + filters (status, priority, assigneeId) | by ID | create | update, resolve | — | `ticket.created`, `ticket.updated`, `ticket.comment_added` |
| articles | cursor + filters (status, collectionId) | by ID | create | update | delete | — (v2) |
| collections | cursor + filters (parentId) | by ID | create | update | delete | — (v2) |

## Event Details

Events are emitted by both UI/domain mutations and automation API mutations.

### conversation.created
- **Triggered by:** `conversations.create`, `conversations.getOrCreateForVisitor` (new branch), `conversations.createForVisitor`
- **Data payload:** `{ channel, status, visitorId }`

### conversation.updated
- **Triggered by:** `conversations.updateStatus`, `conversations.assign`, `automationApi.updateConversation`
- **Data payload:** `{ status }` and/or `{ assignedAgentId }`

### message.created
- **Triggered by:** `messages.send`, `messages.internalSendBotMessage`, `automationApi.sendMessage`
- **Data payload:** `{ conversationId, senderType, channel }`
- **Note:** `channel` is derived from the conversation's channel field (defaults to `"chat"` if unset)

### visitor.updated
- **Triggered by:** `visitors.identify` (direct update and merge branches), `automationApi.updateVisitor`
- **Data payload:** `{ email, name, externalUserId }`
- **Note:** Payload may include visitor identity fields (email, name, externalUserId)

### ticket.created
- **Triggered by:** `tickets.create`, `tickets.convertFromConversation`, `automationApi.createTicket`
- **Data payload:** `{ channel: "support_ticket", status, priority }`

### ticket.updated
- **Triggered by:** `tickets.update`, `tickets.resolve`, `automationApi.updateTicket`
- **Data payload:** `{ channel: "support_ticket", status, priority, assigneeId }`

### ticket.comment_added
- **Triggered by:** `tickets.addComment`
- **Data payload:** `{ channel: "support_ticket", commentId, authorType, isInternal }`

## Authentication & Authorization

- **API key auth:** Bearer token with `osk_` prefix, scoped to workspace
- **Permissions:** API keys carry explicit scopes (e.g. `conversations.read`, `messages.write`)
- **Rate limits:** 60 requests/minute per credential, 120 requests/minute per workspace

## Webhook Subscriptions

- **Filters:** `eventTypes`, `resourceTypes`, `channels`, `aiWorkflowStates` (reserved — not yet emitted by production mutations)
- **Delivery:** Async via scheduled function, with exponential backoff retry (30s, 2m, 10m, 1h, 4h; max 5 attempts)
- **Test endpoint:** `POST /webhooks/{id}/test` sends a `test.ping` event
- **Signature:** HMAC-SHA256 in `X-Opencom-Signature` header (format: `t={timestamp},v1={hex}`)
- **Additional headers:** `X-Opencom-Event-Id`, `X-Opencom-Delivery-Id`, `X-Opencom-Timestamp`

## Polling Event Feed

- **Endpoint:** Cursor-based pagination over `automationEvents` table
- **Ordering:** Descending by timestamp
- **Limit:** Max 100 events per page

## Idempotency

- **Supported:** Message send (`POST /messages`) accepts `Idempotency-Key` header
- **TTL:** 24 hours
- **Scope:** Per workspace + key

## Known V1 Limitations

- **No events for articles/collections** — planned for v2
- **No `visitor.created` event** — visitors can be created via the API, but no event is emitted; `visitor.updated` fires on `identify()` and API update
- **No `message.updated`/`message.deleted` events** — messages are immutable in v1
- **No `conversation.deleted` event** — conversations are not deletable
- **No fine-grained event types** — status changes, assignments, etc. are communicated via the `data` payload on broad event types (`*.updated`) rather than separate event types
- **Noisy mutations excluded:** `visitors.updateLocation` and `visitors.heartbeat` do not emit events
- **`aiWorkflowStates` webhook filter:** Reserved for future use; no production mutations currently populate this field in event data
