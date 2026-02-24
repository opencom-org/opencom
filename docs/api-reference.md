# Backend API Reference

This document covers the Convex backend API surface. All functions live in `packages/convex/convex/`. See [Data Model](data-model.md) for schema details.

## Authentication

All endpoints use one of two authentication paths:

- **Agent/admin**: Authenticated via Convex Auth session (JWT). Permission-checked via `requirePermission()`.
- **Visitor**: Authenticated via signed session token (`sessionToken`). Validated via `resolveVisitorFromSession()`.

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

| Code                   | Description                |
| ---------------------- | -------------------------- |
| `NOT_AUTHENTICATED`    | No auth session            |
| `SESSION_EXPIRED`      | JWT expired                |
| `NOT_AUTHORIZED`       | Missing permission         |
| `PERMISSION_DENIED`    | Specific permission failed |
| `NOT_WORKSPACE_MEMBER` | Not a workspace member     |
| `NOT_FOUND`            | Resource doesn't exist     |
| `ALREADY_EXISTS`       | Duplicate resource         |
| `INVALID_INPUT`        | Validation failed          |
| `RATE_LIMITED`         | Request throttled          |
