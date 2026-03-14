# Backend API Reference

This document covers the Convex backend API surface. All functions live in `packages/convex/convex/`. See [Data Model](data-model.md) for schema details.

## Authentication

All endpoints use one of three authentication paths:

- **Agent/admin**: Authenticated via Convex Auth session (JWT). Permission-checked via `requirePermission()`.
- **Visitor**: Authenticated via signed session token (`sessionToken`). Validated via `resolveVisitorFromSession()`.
- **Automation API**: Authenticated via bearer token (`Authorization: Bearer osk_<secret>`). Scope-checked per endpoint. See [Automation API](#automation-api) below.

Unauthenticated callers receive null/empty results or a thrown error depending on the endpoint.

## Conversations

Source: `conversations.ts`

| Function                   | Type     | Auth             | Key Args                         | Description                                       |
| -------------------------- | -------- | ---------------- | -------------------------------- | ------------------------------------------------- |
| `list`                     | query    | agent            | workspaceId, status?             | List conversations, optionally filtered by status |
| `get`                      | query    | agent or visitor | id, visitorId?                   | Get single conversation                           |
| `create`                   | mutation | agent            | workspaceId, visitorId?, userId? | Create a conversation                             |
| `createForVisitor`         | mutation | visitor          | workspaceId, sessionToken        | Create conversation as visitor                    |
| `getOrCreateForVisitor`    | mutation | visitor          | workspaceId, sessionToken        | Get existing or create new conversation           |
| `updateStatus`             | mutation | agent            | id, status                       | Change status (open/closed/snoozed)               |
| `assign`                   | mutation | agent            | id, agentId                      | Assign to an agent                                |
| `markAsRead`               | mutation | agent or visitor | id, readerType, sessionToken?    | Mark as read                                      |
| `listByVisitor`            | query    | visitor          | sessionToken, workspaceId        | List visitor's conversations                      |
| `getTotalUnreadForVisitor` | query    | visitor          | sessionToken, workspaceId        | Get unread count                                  |

### Permissions

| Operation      | Agent Permission       | Visitor Requirement                  |
| -------------- | ---------------------- | ------------------------------------ |
| `get`          | `conversations.read`   | Must own the conversation            |
| `updateStatus` | `conversations.close`  | Not allowed                          |
| `assign`       | `conversations.assign` | Not allowed                          |
| `markAsRead`   | `conversations.read`   | sessionToken + must own conversation |

## Messages

Source: `messages.ts`

| Function                 | Type     | Auth             | Key Args                                                     | Description                             |
| ------------------------ | -------- | ---------------- | ------------------------------------------------------------ | --------------------------------------- |
| `list`                   | query    | agent or visitor | conversationId, sessionToken?                                | List messages in conversation           |
| `send`                   | mutation | agent or visitor | conversationId, content, senderType, senderId, sessionToken? | Send a message                          |
| `internalSendBotMessage` | internal | system           | conversationId, content                                      | Send bot/system message (internal only) |

Bot messages (`senderType: "bot"`) are rejected by the public `send` mutation. Use `internalSendBotMessage` for system-generated messages.

## Visitors

Source: `visitors.ts`

| Function         | Type     | Auth             | Key Args                                                                | Description                     |
| ---------------- | -------- | ---------------- | ----------------------------------------------------------------------- | ------------------------------- |
| `get`            | query    | agent            | id                                                                      | Get visitor by ID               |
| `getBySession`   | query    | agent or session | sessionId                                                               | Get visitor by session ID       |
| `identify`       | mutation | visitor          | visitorId, email?, name?, externalUserId?, userHash?, customAttributes? | Identify/update visitor profile |
| `updateLocation` | mutation | visitor          | visitorId, location                                                     | Update visitor geolocation      |

## Widget Sessions

Source: `widgetSessions.ts`

| Function | Type     | Auth   | Key Args                                                                              | Description                                                            |
| -------- | -------- | ------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `boot`   | mutation | public | workspaceId, sessionId, email?, name?, externalUserId?, userHash?, device?, location? | Widget entry point. Creates/retrieves visitor, generates session token |

Returns `{ visitor, sessionToken, expiresAt }`. The `sessionToken` must be stored client-side and included in all subsequent visitor-facing calls.

### Token Lifecycle

| Parameter         | Value                      |
| ----------------- | -------------------------- |
| Default lifetime  | 24 hours                   |
| Minimum           | 1 hour                     |
| Maximum           | 7 days                     |
| Refresh threshold | 25% remaining lifetime     |
| Format            | `wst_` + 64 hex characters |

## Workspaces

Source: `workspaces.ts`

| Function                    | Type     | Auth          | Key Args | Description                                                    |
| --------------------------- | -------- | ------------- | -------- | -------------------------------------------------------------- |
| `get`                       | query    | public/member | id       | Get workspace (full data for members, public fields otherwise) |
| `getPublicWorkspaceContext` | query    | public        | (none)   | Get default workspace public context                           |
| `getByName`                 | query    | member        | name     | Get workspace by name                                          |
| `create`                    | mutation | authenticated | name     | Create workspace (caller becomes owner)                        |
| `getOrCreateDefault`        | mutation | authenticated | (none)   | Get or create user's default workspace                         |

## Articles

Source: `articles.ts`

| Function         | Type     | Auth         | Key Args                                            | Description                                     |
| ---------------- | -------- | ------------ | --------------------------------------------------- | ----------------------------------------------- |
| `list`           | query    | agent        | workspaceId, status?, collectionId?                 | List articles                                   |
| `get`            | query    | public/agent | id?, slug?, workspaceId?                            | Get by ID or slug                               |
| `search`         | query    | public       | workspaceId, query                                  | Full-text search published articles             |
| `create`         | mutation | agent        | workspaceId, title, content, collectionId?          | Create article (draft)                          |
| `update`         | mutation | agent        | id, title?, content?, collectionId?, audienceRules? | Update article                                  |
| `remove`         | mutation | agent        | id                                                  | Delete article                                  |
| `publish`        | mutation | agent        | id                                                  | Publish article (triggers embedding generation) |
| `unpublish`      | mutation | agent        | id                                                  | Revert to draft                                 |
| `submitFeedback` | mutation | public       | articleId, helpful                                  | Record article feedback                         |

## Collections

Source: `collections.ts`

| Function        | Type     | Auth         | Key Args                           | Description                          |
| --------------- | -------- | ------------ | ---------------------------------- | ------------------------------------ |
| `list`          | query    | public/agent | workspaceId, parentId?             | List collections with article counts |
| `listHierarchy` | query    | public/agent | workspaceId                        | Full collection tree                 |
| `get`           | query    | public/agent | id?, slug?, workspaceId?           | Get by ID or slug                    |
| `create`        | mutation | agent        | workspaceId, name, parentId?       | Create collection                    |
| `update`        | mutation | agent        | id, name?, description?, parentId? | Update collection                    |
| `remove`        | mutation | agent        | id                                 | Delete (must be empty)               |
| `reorder`       | mutation | agent        | id, newOrder                       | Update display order                 |

## Tours

Source: `tours.ts`

| Function     | Type     | Auth          | Key Args                                        | Description                               |
| ------------ | -------- | ------------- | ----------------------------------------------- | ----------------------------------------- |
| `list`       | query    | agent         | workspaceId, status?                            | List tours                                |
| `listAll`    | query    | agent/visitor | workspaceId, sessionToken?                      | List active tours with steps and progress |
| `get`        | query    | agent         | id                                              | Get tour by ID                            |
| `create`     | mutation | agent         | workspaceId, name, audienceRules?, displayMode? | Create tour (draft)                       |
| `update`     | mutation | agent         | id, name?, audienceRules?, displayMode?         | Update tour                               |
| `remove`     | mutation | agent         | id                                              | Delete tour and steps/progress            |
| `activate`   | mutation | agent         | id                                              | Set status to active                      |
| `deactivate` | mutation | agent         | id                                              | Set status to draft                       |
| `duplicate`  | mutation | agent         | id                                              | Clone tour with steps                     |

## Tour Steps

Source: `tourSteps.ts`

| Function  | Type     | Auth  | Key Args                                  | Description                      |
| --------- | -------- | ----- | ----------------------------------------- | -------------------------------- |
| `list`    | query    | agent | tourId                                    | List steps in order              |
| `create`  | mutation | agent | tourId, type, content, elementSelector?   | Create step (pointer/post/video) |
| `update`  | mutation | agent | id, content?, elementSelector?, position? | Update step                      |
| `remove`  | mutation | agent | id                                        | Delete step and reorder          |
| `reorder` | mutation | agent | tourId, stepIds                           | Reorder steps                    |

## Surveys

Source: `surveys.ts`

| Function               | Type     | Auth  | Key Args                                  | Description                      |
| ---------------------- | -------- | ----- | ----------------------------------------- | -------------------------------- |
| `list`                 | query    | agent | workspaceId, status?                      | List surveys                     |
| `get`                  | query    | agent | id                                        | Get survey                       |
| `create`               | mutation | agent | workspaceId, name, format, questions?     | Create survey (draft)            |
| `update`               | mutation | agent | id, name?, format?, questions?, triggers? | Update survey                    |
| `remove`               | mutation | agent | id                                        | Delete survey and responses      |
| `activate`             | mutation | agent | id                                        | Publish (requires >= 1 question) |
| `pause`                | mutation | agent | id                                        | Pause active survey              |
| `archive`              | mutation | agent | id                                        | Archive survey                   |
| `duplicate`            | mutation | agent | id                                        | Clone survey                     |
| `previewAudienceRules` | query    | agent | workspaceId, audienceRules?               | Estimate matching visitors       |

## Tickets

Source: `tickets.ts`

| Function | Type     | Auth             | Key Args                                                           | Description   |
| -------- | -------- | ---------------- | ------------------------------------------------------------------ | ------------- |
| `list`   | query    | agent            | workspaceId, status?, assigneeId?                                  | List tickets  |
| `get`    | query    | agent or visitor | id, sessionToken?                                                  | Get ticket    |
| `create` | mutation | agent or visitor | workspaceId, subject, priority?, formId?, formData?, sessionToken? | Create ticket |
| `update` | mutation | agent            | id, status?, priority?, assigneeId?                                | Update ticket |

## Outbound Messages

Source: `outboundMessages.ts`

| Function      | Type     | Auth    | Key Args                                                | Description                       |
| ------------- | -------- | ------- | ------------------------------------------------------- | --------------------------------- |
| `list`        | query    | agent   | workspaceId, type?, status?                             | List messages                     |
| `create`      | mutation | agent   | workspaceId, type, name, content, triggers?, frequency? | Create outbound message           |
| `update`      | mutation | agent   | id, name?, content?, triggers?                          | Update message                    |
| `remove`      | mutation | agent   | id                                                      | Delete message                    |
| `activate`    | mutation | agent   | id                                                      | Activate message                  |
| `pause`       | mutation | agent   | id                                                      | Pause message                     |
| `getEligible` | query    | visitor | workspaceId, currentUrl, sessionToken?                  | Get eligible messages for visitor |

## Checklists

Source: `checklists.ts`

| Function         | Type     | Auth    | Key Args                                        | Description                   |
| ---------------- | -------- | ------- | ----------------------------------------------- | ----------------------------- |
| `list`           | query    | agent   | workspaceId, status?                            | List checklists               |
| `get`            | query    | agent   | id                                              | Get checklist                 |
| `create`         | mutation | agent   | workspaceId, name, tasks                        | Create checklist              |
| `update`         | mutation | agent   | id, name?, tasks?, status?                      | Update checklist              |
| `remove`         | mutation | agent   | id                                              | Delete checklist and progress |
| `getProgress`    | query    | visitor | checklistId, workspaceId, sessionToken?         | Get visitor's progress        |
| `getAllProgress` | query    | visitor | workspaceId, sessionToken?                      | Get all checklist progress    |
| `completeTask`   | mutation | visitor | checklistId, taskId, workspaceId, sessionToken? | Mark task complete            |
| `uncompleteTask` | mutation | visitor | checklistId, taskId, workspaceId, sessionToken? | Uncheck task                  |

## Segments

Source: `segments.ts`

| Function   | Type     | Auth  | Key Args                         | Description                |
| ---------- | -------- | ----- | -------------------------------- | -------------------------- |
| `list`     | query    | agent | workspaceId                      | List segments              |
| `get`      | query    | agent | id                               | Get segment                |
| `create`   | mutation | agent | workspaceId, name, audienceRules | Create segment             |
| `update`   | mutation | agent | id, name?, audienceRules?        | Update segment             |
| `remove`   | mutation | agent | id                               | Delete segment             |
| `preview`  | query    | agent | workspaceId, audienceRules       | Estimate matching visitors |
| `getUsage` | query    | agent | id                               | Where segment is used      |

## Email Campaigns

Source: `emailCampaigns.ts`

| Function            | Type     | Auth   | Key Args                                  | Description             |
| ------------------- | -------- | ------ | ----------------------------------------- | ----------------------- |
| `list`              | query    | agent  | workspaceId, status?                      | List campaigns          |
| `get`               | query    | agent  | id                                        | Get campaign            |
| `create`            | mutation | agent  | workspaceId, name, subject, content       | Create campaign (draft) |
| `update`            | mutation | agent  | id, name?, subject?, content?, targeting? | Update (not if sent)    |
| `send`              | mutation | agent  | id                                        | Send campaign           |
| `remove`            | mutation | agent  | id                                        | Delete campaign         |
| `trackOpen`         | mutation | public | recipientId, trackingToken                | Record email open       |
| `trackClick`        | mutation | public | recipientId, trackingToken, url           | Record link click       |
| `previewRecipients` | query    | agent  | campaignId                                | Estimate recipients     |

## Push Campaigns

Source: `pushCampaigns.ts`

| Function   | Type     | Auth  | Key Args                                   | Description                                              |
| ---------- | -------- | ----- | ------------------------------------------ | -------------------------------------------------------- |
| `list`     | query    | agent | workspaceId, status?, limit?               | List push campaigns                                      |
| `get`      | query    | agent | id                                         | Get campaign                                             |
| `create`   | mutation | agent | workspaceId, name, title, body, targeting? | Create campaign (draft)                                  |
| `update`   | mutation | agent | id, name?, title?, body?, targeting?       | Update (not if sent)                                     |
| `send`     | mutation | agent | id                                         | Queue campaign recipients and transition campaign status |
| `pause`    | mutation | agent | id                                         | Pause campaign                                           |
| `remove`   | mutation | agent | id                                         | Delete campaign and recipients                           |
| `getStats` | query    | agent | id, sampleLimit?                           | Aggregate recipient delivery stats                       |

Notes:

- Visitor-targeted push delivery resolves recipients from `visitorPushTokens` using campaign audience rules.
- Agent `pushTokens` remain isolated from visitor campaign delivery semantics.

## Series

Source: `series.ts`

| Function       | Type     | Auth  | Key Args                          | Description                                   |
| -------------- | -------- | ----- | --------------------------------- | --------------------------------------------- |
| `list`         | query    | agent | workspaceId, status?              | List series                                   |
| `get`          | query    | agent | id                                | Get series                                    |
| `create`       | mutation | agent | workspaceId, name, entryTriggers? | Create series (draft)                         |
| `update`       | mutation | agent | id, name?, entryTriggers?         | Update series                                 |
| `remove`       | mutation | agent | id                                | Delete series and blocks/connections/progress |
| `activate`     | mutation | agent | id                                | Validate and activate                         |
| `deactivate`   | mutation | agent | id                                | Deactivate                                    |
| `duplicate`    | mutation | agent | id                                | Clone with blocks/connections                 |
| `readiness`    | query    | agent | id                                | Validate for activation (blockers/warnings)   |
| `getProgress`  | query    | agent | seriesId, visitorId               | Get visitor's series progress                 |
| `listProgress` | query    | agent | seriesId, status?                 | List all progress records                     |

## Snippets

Source: `snippets.ts`

| Function        | Type     | Auth  | Key Args                              | Description                     |
| --------------- | -------- | ----- | ------------------------------------- | ------------------------------- |
| `list`          | query    | agent | workspaceId                           | List snippets                   |
| `get`           | query    | agent | id                                    | Get snippet                     |
| `search`        | query    | agent | workspaceId, query                    | Search by name/content/shortcut |
| `getByShortcut` | query    | agent | workspaceId, shortcut                 | Get by keyboard shortcut        |
| `create`        | mutation | agent | workspaceId, name, content, shortcut? | Create snippet                  |
| `update`        | mutation | agent | id, name?, content?, shortcut?        | Update snippet                  |
| `remove`        | mutation | agent | id                                    | Delete snippet                  |

## Tags

Source: `tags.ts`

| Function                 | Type     | Auth  | Key Args                  | Description                             |
| ------------------------ | -------- | ----- | ------------------------- | --------------------------------------- |
| `list`                   | query    | agent | workspaceId               | List all tags                           |
| `get`                    | query    | agent | id                        | Get tag                                 |
| `create`                 | mutation | agent | workspaceId, name, color? | Create tag                              |
| `update`                 | mutation | agent | id, name?, color?         | Update tag                              |
| `remove`                 | mutation | agent | id                        | Delete tag (removes from conversations) |
| `addToConversation`      | mutation | agent | conversationId, tagId     | Tag a conversation                      |
| `removeFromConversation` | mutation | agent | conversationId, tagId     | Remove tag                              |
| `getConversationTags`    | query    | agent | conversationId            | List conversation tags                  |

## Reporting

Source: `reporting.ts`

| Function                       | Type  | Auth  | Key Args                          | Description                              |
| ------------------------------ | ----- | ----- | --------------------------------- | ---------------------------------------- |
| `getConversationMetrics`       | query | agent | workspaceId, startDate, endDate   | Volume, status, channel breakdown        |
| `getResponseTimeMetrics`       | query | agent | workspaceId, startDate, endDate   | First response time (avg/median/p90/p95) |
| `getResolutionTimeMetrics`     | query | agent | workspaceId, startDate, endDate   | Resolution time stats                    |
| `getAgentMetrics`              | query | agent | workspaceId, startDate, endDate   | Per-agent performance                    |
| `getAgentWorkloadDistribution` | query | agent | workspaceId                       | Current open conversation distribution   |
| `getCsatScore`                 | query | agent | workspaceId, startDate?, endDate? | CSAT metrics                             |
| `getAiAgentMetrics`            | query | agent | workspaceId, startDate?, endDate? | AI handling rate and performance         |

## AI Agent

Source: `aiAgent.ts`

| Function         | Type     | Auth   | Key Args                                                               | Description          |
| ---------------- | -------- | ------ | ---------------------------------------------------------------------- | -------------------- |
| `getSettings`    | query    | member | workspaceId                                                            | Get AI configuration |
| `updateSettings` | mutation | agent  | workspaceId, enabled?, model?, confidenceThreshold?, knowledgeSources? | Update AI config     |

## Identity Verification

Source: `identityVerification.ts`

| Function       | Type     | Auth   | Key Args           | Description                     |
| -------------- | -------- | ------ | ------------------ | ------------------------------- |
| `getSettings`  | query    | member | workspaceId        | Get verification status         |
| `enable`       | mutation | admin  | workspaceId, mode? | Enable and generate HMAC secret |
| `disable`      | mutation | admin  | workspaceId        | Disable verification            |
| `rotateSecret` | mutation | admin  | workspaceId        | Generate new HMAC secret        |

## Audit Logs

Source: `auditLogs.ts`

| Function         | Type     | Auth   | Key Args                                             | Description                    |
| ---------------- | -------- | ------ | ---------------------------------------------------- | ------------------------------ |
| `list`           | query    | admin  | workspaceId, action?, actorId?, startTime?, endTime? | Query logs with filters        |
| `getActions`     | query    | admin  | workspaceId                                          | Get distinct action types      |
| `getSettings`    | query    | admin  | workspaceId                                          | Get retention settings         |
| `updateSettings` | mutation | admin  | workspaceId, retentionDays                           | Set retention (30/90/365 days) |
| `getAccess`      | query    | member | workspaceId                                          | Get user's audit access level  |

## Automation Settings

Source: `automationSettings.ts`

| Function      | Type     | Auth   | Key Args                                                                                                | Description            |
| ------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------- | ---------------------- |
| `get`         | query    | member | workspaceId                                                                                             | Get automation toggles |
| `getOrCreate` | query    | member | workspaceId                                                                                             | Get or return defaults |
| `upsert`      | mutation | agent  | workspaceId, suggestArticlesEnabled?, showReplyTimeEnabled?, collectEmailEnabled?, askForRatingEnabled? | Update toggles         |

## HTTP Routes

Source: `http.ts`

| Route                       | Method | Auth    | Description                                                                  |
| --------------------------- | ------ | ------- | ---------------------------------------------------------------------------- |
| `/.well-known/opencom.json` | GET    | public  | Backend discovery endpoint. CORS controlled by `OPENCOM_PUBLIC_CORS_ORIGINS` |
| `/email/inbound`            | POST   | webhook | Resend inbound email webhook. Verified via SVIX signature                    |

## Error Codes

| Code                   | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `NOT_AUTHENTICATED`    | No auth session                                          |
| `SESSION_EXPIRED`      | JWT expired                                              |
| `NOT_AUTHORIZED`       | Missing permission                                       |
| `PERMISSION_DENIED`    | Specific permission failed                               |
| `NOT_WORKSPACE_MEMBER` | Not a workspace member                                   |
| `NOT_FOUND`            | Resource doesn't exist                                   |
| `ALREADY_EXISTS`       | Duplicate resource                                       |
| `INVALID_INPUT`        | Validation failed                                        |
| `RATE_LIMITED`         | Request throttled                                        |
| `AUTOMATION_DISABLED`  | `automationApiEnabled` is false for this workspace       |
| `INVALID_CREDENTIALS`  | Bearer token missing, malformed, or not found            |
| `SCOPE_DENIED`         | Credential lacks the required scope for this endpoint    |
| `CREDENTIAL_EXPIRED`   | Credential status is `expired` or `disabled`             |

---

## Automation API

The Automation API provides an HTTP-based interface for external systems to interact with workspace data. All endpoints are under `/api/v1/` and require bearer token authentication. The feature is gated behind the `automationApiEnabled` flag on the workspace — all routes return 403 when disabled.

Source: `automationHttpRoutes.ts`, `automationCredentials.ts`, `automationWebhooks.ts`

### Authentication

Automation API requests authenticate via bearer token:

```
Authorization: Bearer osk_<secret>
```

- **Token format**: `osk_` prefix + 48 random characters = 52 characters total
- **Storage**: SHA-256 hashed (one-way). The plaintext secret cannot be recovered after creation.
- **One-time reveal**: The full secret is returned only at credential creation time
- **Identification**: List views show the secret prefix (`osk_` + first 8 characters) for identification
- **Credential lifecycle**: `active` → `disabled` (admin toggle) or `expired` (TTL-based)
- **Actor attribution**: Each credential carries an actor name for audit trail purposes

### Scopes

Credentials carry an immutable set of scopes assigned at creation. Every request is checked against the credential's scopes (fail-closed).

| Scope                 | Grants access to                  |
| --------------------- | --------------------------------- |
| `conversations.read`  | List/get conversations            |
| `conversations.write` | Update conversation status/assign |
| `messages.read`       | List messages                     |
| `messages.write`      | Send messages                     |
| `visitors.read`       | List/get visitors                 |
| `visitors.write`      | Create/update visitors            |
| `tickets.read`        | List/get tickets                  |
| `tickets.write`       | Create/update tickets             |
| `events.read`         | Read event feed                   |
| `events.write`        | (Reserved)                        |
| `articles.read`       | List/get articles                 |
| `articles.write`      | Create/update/delete articles     |
| `collections.read`    | List/get collections              |
| `collections.write`   | Create/update/delete collections  |
| `webhooks.manage`     | Manage webhook subscriptions      |
| `claims.manage`       | Claim/release/escalate conversations |

There is no wildcard or admin scope in v1. Scopes are set at credential creation and cannot be modified afterward.

### Rate Limits

| Limit          | Value             |
| -------------- | ----------------- |
| Per credential | 60 req/min        |
| Per workspace  | 120 req/min       |
| Window         | 1-minute sliding  |

When rate-limited, the API returns HTTP 429 with a `Retry-After` header.

### Endpoints

#### Conversations

| Method | Path                                | Scope                 | Description                    |
| ------ | ----------------------------------- | --------------------- | ------------------------------ |
| GET    | `/api/v1/conversations`             | `conversations.read`  | List conversations             |
| GET    | `/api/v1/conversations/get`         | `conversations.read`  | Get conversation by ID         |
| POST   | `/api/v1/conversations/update`      | `conversations.write` | Update status or assignment    |
| POST   | `/api/v1/conversations/claim`       | `claims.manage`       | Claim conversation (5-min lease) |
| POST   | `/api/v1/conversations/release`     | `claims.manage`       | Release claimed conversation   |
| POST   | `/api/v1/conversations/escalate`    | `claims.manage`       | Escalate to human queue        |

#### Messages

| Method | Path                                      | Scope            | Description          |
| ------ | ----------------------------------------- | ---------------- | -------------------- |
| GET    | `/api/v1/conversations/messages`          | `messages.read`  | List messages        |
| POST   | `/api/v1/conversations/messages/send`     | `messages.write` | Send a message       |

#### Visitors

| Method | Path                        | Scope            | Description       |
| ------ | --------------------------- | ---------------- | ----------------- |
| GET    | `/api/v1/visitors`          | `visitors.read`  | List visitors     |
| GET    | `/api/v1/visitors/get`      | `visitors.read`  | Get visitor by ID |
| POST   | `/api/v1/visitors/create`   | `visitors.write` | Create visitor    |
| POST   | `/api/v1/visitors/update`   | `visitors.write` | Update visitor    |

#### Tickets

| Method | Path                        | Scope           | Description      |
| ------ | --------------------------- | --------------- | ---------------- |
| GET    | `/api/v1/tickets`           | `tickets.read`  | List tickets     |
| GET    | `/api/v1/tickets/get`       | `tickets.read`  | Get ticket by ID |
| POST   | `/api/v1/tickets/create`    | `tickets.write` | Create ticket    |
| POST   | `/api/v1/tickets/update`    | `tickets.write` | Update ticket    |

#### Articles

| Method | Path                         | Scope           | Description      |
| ------ | ---------------------------- | --------------- | ---------------- |
| GET    | `/api/v1/articles`           | `articles.read` | List articles    |
| GET    | `/api/v1/articles/get`       | `articles.read` | Get article by ID |
| POST   | `/api/v1/articles/create`    | `articles.write`| Create article   |
| POST   | `/api/v1/articles/update`    | `articles.write`| Update article   |
| POST   | `/api/v1/articles/delete`    | `articles.write`| Delete article   |

#### Collections

| Method | Path                            | Scope              | Description          |
| ------ | ------------------------------- | ------------------ | -------------------- |
| GET    | `/api/v1/collections`           | `collections.read` | List collections     |
| GET    | `/api/v1/collections/get`       | `collections.read` | Get collection by ID |
| POST   | `/api/v1/collections/create`    | `collections.write`| Create collection    |
| POST   | `/api/v1/collections/update`    | `collections.write`| Update collection    |
| POST   | `/api/v1/collections/delete`    | `collections.write`| Delete collection    |

#### Events

| Method | Path                    | Scope         | Description              |
| ------ | ----------------------- | ------------- | ------------------------ |
| GET    | `/api/v1/events/feed`   | `events.read` | Paginated event feed     |

#### Webhooks

| Method | Path                          | Scope            | Description                  |
| ------ | ----------------------------- | ---------------- | ---------------------------- |
| POST   | `/api/v1/webhooks/replay`     | `webhooks.manage`| Replay a failed delivery     |

### Idempotency

The `Idempotency-Key` header is supported on message send (`POST /api/v1/conversations/messages/send`) only.

- **TTL**: 24 hours
- **Scope**: Per workspace + key combination
- **Duplicate response**: Returns `cached: true` when a matching key is found within the TTL window

### Pagination & Filtering

All list endpoints use cursor-based pagination:

- **Default page size**: 20
- **Maximum page size**: 100
- **Cursor**: Opaque string returned in response; pass as `cursor` query parameter for next page

**Conversation filters**: `status`, `assignee`, `channel`, `email`, `externalUserId`, `customAttribute.*`
**Visitor filters**: `email`, `externalUserId`, `customAttribute.*`
**Ticket filters**: `status`, `priority`, `assigneeId`
**Article filters**: `status`, `collectionId`
**Collection filters**: `parentId`
**Message filters**: `conversationId` (required)

### Automation Credentials (Admin)

Managed via Convex mutations (admin UI), not HTTP endpoints.

| Operation           | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| Create credential   | Returns one-time secret. Stores SHA-256 hash.                  |
| List credentials    | Shows prefix (`osk_` + 8 chars), scopes, status, last used    |
| Disable credential  | Sets status to `disabled`, blocks all requests                 |
| Enable credential   | Re-enables a disabled credential                               |
| Delete credential   | Permanently removes the credential                             |

### Webhook Subscriptions (Admin)

Managed via Convex mutations (admin UI).

| Operation              | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| Create subscription    | Returns one-time signing secret (`whsec_` prefix)            |
| List subscriptions     | Shows URL, status, event/resource filter summary             |
| Update subscription    | Modify URL, filters, or status                               |
| Delete subscription    | Remove subscription and stop deliveries                      |
| Test ping              | Sends a `test.ping` event to the subscription URL            |

### Webhook Deliveries (Admin)

| Operation         | Description                                                       |
| ----------------- | ----------------------------------------------------------------- |
| List deliveries   | Recent-window view of deliveries, filterable by subscription      |
| View details      | Status, HTTP response code, error message, attempt count          |
| Replay delivery   | Creates a new delivery attempt (resets attempt count to 1)        |

Delivery logs show a recent window, not full historical data.

### Events

Events are emitted by UI/domain mutations and most automation API write mutations.

| Event                   | Triggered by                                          | Data payload                                  |
| ----------------------- | ----------------------------------------------------- | --------------------------------------------- |
| `conversation.created`  | `conversations.create`, `getOrCreateForVisitor` (new) | `{ channel, status, visitorId }`              |
| `conversation.updated`  | `updateStatus`, `assign`, API update                  | `{ status }` and/or `{ assignedAgentId }`     |
| `message.created`       | `messages.send`, bot message, API send                | `{ conversationId, senderType, channel }`     |
| `visitor.updated`       | `visitors.identify`, API update                       | `{ visitorId }`                               |
| `ticket.created`        | `tickets.create`, convert from conversation, API      | `{ channel: "support_ticket", status, priority }` |
| `ticket.updated`        | `tickets.update`, `tickets.resolve`, API update       | `{ channel: "support_ticket", status, priority, assigneeId }` |
| `ticket.comment_added`  | `tickets.addComment` (external comments only)         | `{ channel: "support_ticket", commentId, authorType }` |

### Known V1 Limitations

- No events for articles/collections — planned for v2
- No `visitor.created` event — visitors can be created via the API, but no event is emitted; `visitor.updated` fires on `identify()` and API update
- No `message.updated`/`message.deleted` events — messages are immutable in v1
- No `conversation.deleted` event — conversations are not deletable
- No fine-grained event types — status changes, assignments, etc. are communicated via the `data` payload on broad event types (`*.updated`) rather than separate event types
- Noisy mutations excluded: `visitors.updateLocation` and `visitors.heartbeat` do not emit events
- `aiWorkflowStates` webhook filter is reserved for future use; no production mutations currently populate this field in event data
- `ticket.updated` payload is coarse — includes status, priority, assigneeId on every emit regardless of what changed; does not include teamId or resolutionSummary

See `packages/convex/AUTOMATION_V1_COVERAGE.md` for the canonical coverage matrix.
