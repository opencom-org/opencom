# Automation API — V1 Coverage Matrix

## Resource Coverage

| Resource | List | Get | Create | Update | Delete | Events |
|---|---|---|---|---|---|---|
| conversations | cursor + filters (status, aiWorkflowState) | by ID | — | status, assign | — | `conversation.created`, `conversation.updated` |
| messages | cursor + filters (conversationId) | by ID | send | — | — | `message.created` |
| visitors | cursor + filters | by ID | — | — | — | `visitor.updated` |
| tickets | cursor + filters (status, assigneeId) | by ID | create | update, resolve | — | `ticket.created`, `ticket.updated`, `ticket.comment_added` |
| articles | cursor + filters | by ID | create | update | delete | — (v2) |
| collections | cursor + filters | by ID | create | update | delete | — (v2) |

## Event Details

### conversation.created
- **Triggered by:** `conversations.create`, `conversations.getOrCreateForVisitor` (new branch), `conversations.createForVisitor`
- **Data payload:** `{ channel, status, visitorId }`

### conversation.updated
- **Triggered by:** `conversations.updateStatus`, `conversations.assign`
- **Data payload:** `{ status }` or `{ assignedAgentId }`

### message.created
- **Triggered by:** `messages.send`, `messages.internalSendBotMessage`
- **Data payload:** `{ conversationId, senderType, channel }`

### visitor.updated
- **Triggered by:** `visitors.identify` (direct update and merge branches)
- **Data payload:** `{ email, name, externalUserId }`

### ticket.created
- **Triggered by:** `tickets.create`, `tickets.convertFromConversation`
- **Data payload:** `{ channel: "support_ticket", status, priority }`

### ticket.updated
- **Triggered by:** `tickets.update`, `tickets.resolve`
- **Data payload:** `{ channel: "support_ticket", status, priority, assigneeId }`

### ticket.comment_added
- **Triggered by:** `tickets.addComment`
- **Data payload:** `{ channel: "support_ticket", commentId, authorType }`

## Authentication & Authorization

- **API key auth:** Bearer token with `automation_` prefix, scoped to workspace
- **Permissions:** API keys inherit automation-level access (CRUD on all supported resources)
- **Rate limits:** 100 requests/minute per API key (configurable per workspace)

## Webhook Subscriptions

- **Filters:** `eventTypes`, `resourceTypes`, `channels`, `aiWorkflowStates`
- **Delivery:** Async via scheduled function, with retry on failure
- **Test endpoint:** `POST /webhooks/{id}/test` sends a `test.ping` event
- **Secret:** HMAC-SHA256 signature in `X-Webhook-Signature` header

## Polling Event Feed

- **Endpoint:** Cursor-based pagination over `automationEvents` table
- **Ordering:** Descending by timestamp
- **Limit:** Max 100 events per page

## Known V1 Limitations

- **No events for articles/collections** — planned for v2
- **No `visitor.created` event** — visitors are created implicitly by the widget; `visitor.updated` fires on `identify()`
- **No `message.updated`/`message.deleted` events** — messages are immutable in v1
- **No `conversation.deleted` event** — conversations are not deletable
- **No fine-grained event types** — status changes, assignments, etc. are communicated via the `data` payload on broad event types (`*.updated`) rather than separate event types
- **Noisy mutations excluded:** `visitors.updateLocation` and `visitors.heartbeat` do not emit events
- **Idempotency:** Not yet supported — planned for v2
