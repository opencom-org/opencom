# Data Model Reference

This document describes all database tables in the Opencom Convex schema. Source: `packages/convex/convex/schema.ts`.

All tables include Convex system fields (`_id`, `_creationTime`). Workspace isolation is enforced by `workspaceId` foreign keys and index-based query filtering.

## Core Tables

### `users`

Extends Convex Auth's built-in user table with workspace integration.

| Field                   | Type                | Description             |
| ----------------------- | ------------------- | ----------------------- |
| `email`                 | string?             | User email address      |
| `name`                  | string?             | Display name            |
| `image`                 | string?             | Profile image URL       |
| `emailVerificationTime` | number?             | When email was verified |
| `avatarUrl`             | string?             | Custom avatar URL       |
| `workspaceId`           | Id\<workspaces\>?   | Default workspace       |
| `role`                  | "admin" \| "agent"? | Legacy role field       |
| `createdAt`             | number?             | Creation timestamp      |

**Indexes:** `by_email`, `by_workspace`

### `workspaces`

Multi-tenant workspace container. Every data record belongs to a workspace.

| Field                         | Type                                 | Description                           |
| ----------------------------- | ------------------------------------ | ------------------------------------- |
| `name`                        | string                               | Workspace name                        |
| `createdAt`                   | number                               | Creation timestamp                    |
| `allowedOrigins`              | string[]?                            | CORS allowlist for widget             |
| `helpCenterAccessPolicy`      | "public" \| "restricted"?            | Help center visibility                |
| `signupMode`                  | "invite-only" \| "domain-allowlist"? | User registration mode                |
| `allowedDomains`              | string[]?                            | Domains for domain-allowlist signup   |
| `authMethods`                 | ("password" \| "otp")[]?             | Enabled authentication methods        |
| `identitySecret`              | string?                              | HMAC secret for identity verification |
| `identityVerificationEnabled` | boolean?                             | Whether identity verification is on   |
| `identityVerificationMode`    | "optional" \| "required"?            | Verification enforcement mode         |
| `sessionLifetimeMs`           | number?                              | Widget session token lifetime         |
| `hostedOnboarding*`           | various                              | Hosted onboarding flow state          |

**Indexes:** `by_name`, `by_created_at`

### `workspaceMembers`

Junction table linking users to workspaces with roles and permissions.

| Field         | Type                                      | Description              |
| ------------- | ----------------------------------------- | ------------------------ |
| `userId`      | Id\<users\>                               | Member user              |
| `workspaceId` | Id\<workspaces\>                          | Target workspace         |
| `role`        | "owner" \| "admin" \| "agent" \| "viewer" | Member role              |
| `permissions` | string[]?                                 | Granular permission list |
| `createdAt`   | number                                    | When member joined       |

**Indexes:** `by_user`, `by_workspace`, `by_user_workspace`

### `workspaceInvitations`

Pending invitations for workspace membership.

| Field         | Type                                  | Description      |
| ------------- | ------------------------------------- | ---------------- |
| `workspaceId` | Id\<workspaces\>                      | Target workspace |
| `email`       | string                                | Invitee email    |
| `role`        | "admin" \| "agent" \| "viewer"        | Invited role     |
| `invitedBy`   | Id\<users\>                           | Inviting user    |
| `status`      | "pending" \| "accepted" \| "declined" | Invitation state |
| `createdAt`   | number                                | When invited     |

**Indexes:** `by_workspace`, `by_email`, `by_email_workspace`

## Visitor & Session Tables

### `visitors`

Website/app visitors tracked by the widget and SDKs.

| Field                | Type             | Description                              |
| -------------------- | ---------------- | ---------------------------------------- |
| `sessionId`          | string           | Client-generated session identifier      |
| `userId`             | Id\<users\>?     | Linked authenticated user                |
| `workspaceId`        | Id\<workspaces\> | Owning workspace                         |
| `readableId`         | string?          | Human-readable ID (e.g., "Brave Falcon") |
| `email`              | string?          | Visitor email (via identify)             |
| `name`               | string?          | Visitor name                             |
| `externalUserId`     | string?          | Customer's user ID                       |
| `location`           | object?          | Geo: city, region, country, countryCode  |
| `device`             | object?          | Browser, OS, deviceType, platform        |
| `referrer`           | string?          | Referring URL                            |
| `currentUrl`         | string?          | Last known page URL                      |
| `customAttributes`   | object?          | Arbitrary key-value attributes           |
| `firstSeenAt`        | number?          | First visit timestamp                    |
| `lastSeenAt`         | number?          | Last activity timestamp                  |
| `identityVerified`   | boolean?         | HMAC verification status                 |
| `identityVerifiedAt` | number?          | When identity was verified               |
| `createdAt`          | number           | Creation timestamp                       |

**Indexes:** `by_session`, `by_workspace`, `by_workspace_last_seen`, `by_workspace_readable_id`, `by_email`, `by_external_user_id`
**Search indexes:** `search_visitors` (by name, filtered by workspace)

### `widgetSessions`

Signed session tokens for visitor authentication. All visitor-facing endpoints require a valid session token.

| Field              | Type             | Description                                 |
| ------------------ | ---------------- | ------------------------------------------- |
| `token`            | string           | Cryptographic token (`wst_` + 64 hex chars) |
| `visitorId`        | Id\<visitors\>   | Associated visitor                          |
| `workspaceId`      | Id\<workspaces\> | Workspace scope                             |
| `identityVerified` | boolean          | Whether visitor passed HMAC verification    |
| `expiresAt`        | number           | Token expiration timestamp                  |
| `createdAt`        | number           | Token creation timestamp                    |

**Indexes:** `by_token`, `by_visitor`, `by_workspace`, `by_expires`

### `events`

Visitor events for audience targeting and analytics.

| Field         | Type                                                                          | Description                 |
| ------------- | ----------------------------------------------------------------------------- | --------------------------- |
| `workspaceId` | Id\<workspaces\>                                                              | Workspace                   |
| `visitorId`   | Id\<visitors\>                                                                | Visitor who triggered event |
| `name`        | string                                                                        | Event name                  |
| `properties`  | object?                                                                       | Event metadata              |
| `timestamp`   | number                                                                        | When event occurred         |
| `url`         | string?                                                                       | Page URL at time of event   |
| `sessionId`   | string?                                                                       | Client session ID           |
| `eventType`   | "manual" \| "page_view" \| "screen_view" \| "session_start" \| "session_end"? | Event category              |

**Indexes:** `by_workspace`, `by_visitor`, `by_visitor_name`, `by_workspace_type`

## Conversation & Messaging Tables

### `conversations`

Chat and email conversations between visitors and agents.

| Field              | Type                                 | Description                  |
| ------------------ | ------------------------------------ | ---------------------------- |
| `workspaceId`      | Id\<workspaces\>                     | Workspace                    |
| `visitorId`        | Id\<visitors\>?                      | Visitor participant          |
| `userId`           | Id\<users\>?                         | User who created it          |
| `assignedAgentId`  | Id\<users\>?                         | Assigned agent               |
| `status`           | "open" \| "closed" \| "snoozed"      | Conversation state           |
| `channel`          | "chat" \| "email"?                   | Communication channel        |
| `subject`          | string?                              | Email subject line           |
| `createdAt`        | number                               | Creation time                |
| `updatedAt`        | number                               | Last update time             |
| `lastMessageAt`    | number?                              | Latest message timestamp     |
| `unreadByAgent`    | number?                              | Unread count for agent       |
| `unreadByVisitor`  | number?                              | Unread count for visitor     |
| `firstResponseAt`  | number?                              | Time of first agent response |
| `resolvedAt`       | number?                              | When resolved                |
| `aiWorkflowState`  | "none" \| "ai_handled" \| "handoff"? | AI handling state            |
| `aiLastConfidence` | number?                              | Last AI confidence score     |

**Indexes:** `by_workspace`, `by_visitor`, `by_status`, `by_last_message`, `by_channel`, `by_workspace_ai_state`, `by_workspace_ai_state_status`

### `messages`

Individual messages within conversations.

| Field            | Type                                                         | Description                                                        |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------------ |
| `conversationId` | Id\<conversations\>                                          | Parent conversation                                                |
| `senderId`       | string                                                       | Sender identifier                                                  |
| `senderType`     | "user" \| "visitor" \| "agent" \| "bot"                      | Who sent it                                                        |
| `content`        | string                                                       | Message body                                                       |
| `channel`        | "chat" \| "email"?                                           | Channel type                                                       |
| `emailMetadata`  | object?                                                      | Email-specific: subject, from, to, cc, bcc, messageId, attachments |
| `deliveryStatus` | "pending" \| "sent" \| "delivered" \| "bounced" \| "failed"? | Email delivery state                                               |
| `createdAt`      | number                                                       | Send timestamp                                                     |

**Indexes:** `by_conversation`, `by_email_message_id`

### `csatResponses`

Customer satisfaction ratings on conversations.

| Field            | Type                | Description        |
| ---------------- | ------------------- | ------------------ |
| `workspaceId`    | Id\<workspaces\>    | Workspace          |
| `conversationId` | Id\<conversations\> | Rated conversation |
| `visitorId`      | Id\<visitors\>?     | Rating visitor     |
| `agentId`        | Id\<users\>?        | Rated agent        |
| `rating`         | number              | Satisfaction score |
| `feedback`       | string?             | Free-text feedback |
| `createdAt`      | number              | Rating timestamp   |

**Indexes:** `by_workspace`, `by_conversation`, `by_agent`, `by_created`

## Ticket Tables

### `tickets`

Issue tracking with priority, status, and assignment.

| Field               | Type                                                                | Description         |
| ------------------- | ------------------------------------------------------------------- | ------------------- |
| `workspaceId`       | Id\<workspaces\>                                                    | Workspace           |
| `conversationId`    | Id\<conversations\>?                                                | Linked conversation |
| `visitorId`         | Id\<visitors\>?                                                     | Submitting visitor  |
| `subject`           | string                                                              | Ticket title        |
| `description`       | string?                                                             | Ticket description  |
| `status`            | "submitted" \| "in_progress" \| "waiting_on_customer" \| "resolved" | Ticket state        |
| `priority`          | "low" \| "normal" \| "high" \| "urgent"                             | Priority level      |
| `assigneeId`        | Id\<users\>?                                                        | Assigned agent      |
| `formId`            | Id\<ticketForms\>?                                                  | Form template used  |
| `formData`          | object?                                                             | Custom field values |
| `resolutionSummary` | string?                                                             | Resolution notes    |

**Indexes:** `by_workspace`, `by_visitor`, `by_status`, `by_assignee`, `by_conversation`

### `ticketComments`

Comments and internal notes on tickets.

| Field        | Type                             | Description                |
| ------------ | -------------------------------- | -------------------------- |
| `ticketId`   | Id\<tickets\>                    | Parent ticket              |
| `authorId`   | string                           | Comment author             |
| `authorType` | "agent" \| "visitor" \| "system" | Author type                |
| `content`    | string                           | Comment body               |
| `isInternal` | boolean                          | Internal note (agent-only) |
| `createdAt`  | number                           | Comment timestamp          |

**Indexes:** `by_ticket`

### `ticketForms`

Custom form templates for ticket submission.

| Field         | Type             | Description                                                            |
| ------------- | ---------------- | ---------------------------------------------------------------------- |
| `workspaceId` | Id\<workspaces\> | Workspace                                                              |
| `name`        | string           | Form name                                                              |
| `description` | string?          | Form description                                                       |
| `fields`      | object[]         | Field definitions (text, textarea, select, multi-select, number, date) |
| `isDefault`   | boolean          | Whether this is the default form                                       |

**Indexes:** `by_workspace`, `by_workspace_default`

## Help Center Tables

### `collections`

Hierarchical article categories for the public help center.

| Field         | Type               | Description                 |
| ------------- | ------------------ | --------------------------- |
| `workspaceId` | Id\<workspaces\>   | Workspace                   |
| `name`        | string             | Collection name             |
| `slug`        | string             | URL slug                    |
| `description` | string?            | Collection description      |
| `icon`        | string?            | Icon identifier             |
| `parentId`    | Id\<collections\>? | Parent collection (nesting) |
| `order`       | number             | Display order               |

**Indexes:** `by_workspace`, `by_slug`, `by_parent`

### `articles`

Public-facing help articles.

| Field           | Type                   | Description           |
| --------------- | ---------------------- | --------------------- |
| `workspaceId`   | Id\<workspaces\>       | Workspace             |
| `collectionId`  | Id\<collections\>?     | Parent collection     |
| `folderId`      | Id\<contentFolders\>?  | Internal folder       |
| `title`         | string                 | Article title         |
| `slug`          | string                 | URL slug              |
| `content`       | string                 | Markdown content      |
| `status`        | "draft" \| "published" | Publication state     |
| `order`         | number                 | Display order         |
| `authorId`      | Id\<users\>?           | Author                |
| `audienceRules` | any?                   | Targeting rules       |
| `publishedAt`   | number?                | Publication timestamp |

**Indexes:** `by_workspace`, `by_collection`, `by_folder`, `by_slug`, `by_status`

### `articleFeedback`

Visitor feedback on articles (helpful/not helpful).

| Field       | Type            | Description            |
| ----------- | --------------- | ---------------------- |
| `articleId` | Id\<articles\>  | Rated article          |
| `helpful`   | boolean         | Whether marked helpful |
| `visitorId` | Id\<visitors\>? | Feedback author        |
| `createdAt` | number          | Feedback timestamp     |

**Indexes:** `by_article`

## Knowledge Hub Tables

### `contentFolders`

Hierarchical folders for internal knowledge organization.

| Field         | Type                  | Description   |
| ------------- | --------------------- | ------------- |
| `workspaceId` | Id\<workspaces\>      | Workspace     |
| `name`        | string                | Folder name   |
| `parentId`    | Id\<contentFolders\>? | Parent folder |
| `order`       | number                | Display order |

**Indexes:** `by_workspace`, `by_parent`

### `internalArticles`

Agent-only documentation not visible to visitors.

| Field         | Type                                 | Description   |
| ------------- | ------------------------------------ | ------------- |
| `workspaceId` | Id\<workspaces\>                     | Workspace     |
| `folderId`    | Id\<contentFolders\>?                | Parent folder |
| `title`       | string                               | Article title |
| `content`     | string                               | Article body  |
| `tags`        | string[]?                            | Content tags  |
| `status`      | "draft" \| "published" \| "archived" | Article state |
| `authorId`    | Id\<users\>?                         | Author        |

**Indexes:** `by_workspace`, `by_folder`, `by_status`
**Search indexes:** `search_content`, `search_title`

### `snippets`

Reusable saved replies for agent conversations.

| Field         | Type                  | Description                        |
| ------------- | --------------------- | ---------------------------------- |
| `workspaceId` | Id\<workspaces\>      | Workspace                          |
| `name`        | string                | Snippet name                       |
| `content`     | string                | Snippet content                    |
| `shortcut`    | string?               | Keyboard shortcut (e.g., `/hello`) |
| `folderId`    | Id\<contentFolders\>? | Parent folder                      |
| `createdBy`   | Id\<users\>?          | Author                             |

**Indexes:** `by_workspace`, `by_shortcut`, `by_folder`

### `recentContentAccess`

Tracks recently used content per agent for quick access.

| Field         | Type                                        | Description        |
| ------------- | ------------------------------------------- | ------------------ |
| `userId`      | Id\<users\>                                 | Accessing user     |
| `workspaceId` | Id\<workspaces\>                            | Workspace          |
| `contentType` | "article" \| "internalArticle" \| "snippet" | Content type       |
| `contentId`   | string                                      | Content identifier |
| `accessedAt`  | number                                      | Access timestamp   |

**Indexes:** `by_user_workspace`, `by_user_content`

## Product Tour Tables

### `tours`

Product tour definitions with targeting and display configuration.

| Field            | Type                                    | Description                             |
| ---------------- | --------------------------------------- | --------------------------------------- |
| `workspaceId`    | Id\<workspaces\>                        | Workspace                               |
| `name`           | string                                  | Tour name                               |
| `description`    | string?                                 | Tour description                        |
| `status`         | "draft" \| "active" \| "archived"       | Tour state                              |
| `targetingRules` | object?                                 | Page URL and user attribute targeting   |
| `audienceRules`  | any?                                    | Audience segment rules                  |
| `displayMode`    | "first_time_only" \| "until_dismissed"? | Show frequency                          |
| `priority`       | number?                                 | Display priority (higher = shown first) |
| `buttonColor`    | string?                                 | Custom button color                     |
| `senderId`       | Id\<users\>?                            | Sender avatar                           |
| `showConfetti`   | boolean?                                | Confetti on completion                  |
| `allowSnooze`    | boolean?                                | Allow snooze                            |
| `allowRestart`   | boolean?                                | Allow restart                           |

**Indexes:** `by_workspace`, `by_workspace_status`

### `tourSteps`

Individual steps within a product tour.

| Field             | Type                                               | Description                    |
| ----------------- | -------------------------------------------------- | ------------------------------ |
| `tourId`          | Id\<tours\>                                        | Parent tour                    |
| `type`            | "pointer" \| "post" \| "video"                     | Step type                      |
| `order`           | number                                             | Step sequence number           |
| `title`           | string?                                            | Step title                     |
| `content`         | string                                             | Step body                      |
| `elementSelector` | string?                                            | CSS selector for pointer steps |
| `position`        | "auto" \| "left" \| "right" \| "above" \| "below"? | Tooltip position               |
| `size`            | "small" \| "large"?                                | Step size                      |
| `advanceOn`       | "click" \| "elementClick" \| "fieldFill"?          | Advance trigger                |
| `routePath`       | string?                                            | Required page route            |
| `mediaUrl`        | string?                                            | Image/video URL                |
| `mediaType`       | "image" \| "video"?                                | Media type                     |

**Indexes:** `by_workspace`, `by_tour`, `by_tour_order`

### `tourProgress`

Per-visitor progress through tours.

| Field          | Type                                                     | Description          |
| -------------- | -------------------------------------------------------- | -------------------- |
| `visitorId`    | Id\<visitors\>                                           | Visitor              |
| `tourId`       | Id\<tours\>                                              | Tour                 |
| `currentStep`  | number                                                   | Current step index   |
| `status`       | "in_progress" \| "completed" \| "dismissed" \| "snoozed" | Progress state       |
| `snoozedUntil` | number?                                                  | Snooze expiry        |
| `completedAt`  | number?                                                  | Completion timestamp |

**Indexes:** `by_visitor`, `by_tour`, `by_visitor_tour`

### `authoringSessions`

WYSIWYG tour builder sessions (token-based editing).

| Field         | Type             | Description       |
| ------------- | ---------------- | ----------------- |
| `token`       | string           | Session token     |
| `tourId`      | Id\<tours\>      | Tour being edited |
| `stepId`      | Id\<tourSteps\>? | Step being edited |
| `userId`      | Id\<users\>      | Editing user      |
| `workspaceId` | Id\<workspaces\> | Workspace         |
| `targetUrl`   | string           | Target page URL   |
| `expiresAt`   | number           | Session expiry    |

**Indexes:** `by_token`, `by_tour`

## Tooltip Tables

### `tooltips`

Contextual UI hints attached to page elements.

| Field             | Type                         | Description                                    |
| ----------------- | ---------------------------- | ---------------------------------------------- |
| `workspaceId`     | Id\<workspaces\>             | Workspace                                      |
| `name`            | string                       | Tooltip name                                   |
| `elementSelector` | string                       | CSS selector for target element                |
| `content`         | string                       | Tooltip content                                |
| `triggerType`     | "hover" \| "click" \| "auto" | How to trigger                                 |
| `audienceRules`   | any?                         | Targeting rules                                |
| `triggers`        | object?                      | Display conditions (page, time, scroll, event) |

**Indexes:** `by_workspace`, `by_workspace_updated_at`

## Outbound Message Tables

### `outboundMessages`

Proactive in-app messages (chat, post, banner) with targeting and scheduling.

| Field           | Type                                          | Description                                                                 |
| --------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| `workspaceId`   | Id\<workspaces\>                              | Workspace                                                                   |
| `type`          | "chat" \| "post" \| "banner"                  | Message format                                                              |
| `name`          | string                                        | Message name                                                                |
| `content`       | object                                        | Type-specific content (text, title, body, imageUrl, buttons, clickAction)   |
| `audienceRules` | any?                                          | Audience targeting                                                          |
| `triggers`      | object?                                       | Display triggers (immediate, page_visit, time_on_page, scroll_depth, event) |
| `frequency`     | "once" \| "once_per_session" \| "always"?     | Display frequency                                                           |
| `scheduling`    | object?                                       | Start/end date windows                                                      |
| `status`        | "draft" \| "active" \| "paused" \| "archived" | Message state                                                               |
| `priority`      | number?                                       | Display priority                                                            |

**Indexes:** `by_workspace`, `by_workspace_status`, `by_workspace_type`

### `outboundMessageImpressions`

Tracks when outbound messages are shown, clicked, or dismissed.

| Field         | Type                                | Description              |
| ------------- | ----------------------------------- | ------------------------ |
| `messageId`   | Id\<outboundMessages\>              | Message shown            |
| `visitorId`   | Id\<visitors\>                      | Viewer                   |
| `action`      | "shown" \| "clicked" \| "dismissed" | Interaction type         |
| `buttonIndex` | number?                             | Which button was clicked |
| `createdAt`   | number                              | Interaction timestamp    |

**Indexes:** `by_message`, `by_visitor`, `by_visitor_message`

## Checklist Tables

### `checklists`

Onboarding task lists shown to visitors.

| Field           | Type                              | Description                                                                                           |
| --------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `workspaceId`   | Id\<workspaces\>                  | Workspace                                                                                             |
| `name`          | string                            | Checklist name                                                                                        |
| `tasks`         | object[]                          | Task items with id, title, action (tour/url/event), completionType (manual/auto_event/auto_attribute) |
| `audienceRules` | any?                              | Audience targeting                                                                                    |
| `status`        | "draft" \| "active" \| "archived" | Checklist state                                                                                       |

**Indexes:** `by_workspace`, `by_workspace_status`

### `checklistProgress`

Per-visitor checklist completion state.

| Field              | Type             | Description              |
| ------------------ | ---------------- | ------------------------ |
| `visitorId`        | Id\<visitors\>   | Visitor                  |
| `checklistId`      | Id\<checklists\> | Checklist                |
| `completedTaskIds` | string[]         | Completed task IDs       |
| `startedAt`        | number           | When visitor started     |
| `completedAt`      | number?          | When all tasks completed |

**Indexes:** `by_visitor`, `by_checklist`, `by_visitor_checklist`

## Survey Tables

### `surveys`

In-app surveys with multiple question types, targeting, and scheduling.

| Field          | Type                                          | Description                                                                                                            |
| -------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `workspaceId`  | Id\<workspaces\>                              | Workspace                                                                                                              |
| `name`         | string                                        | Survey name                                                                                                            |
| `format`       | "small" \| "large"                            | Display format                                                                                                         |
| `status`       | "draft" \| "active" \| "paused" \| "archived" | Survey state                                                                                                           |
| `questions`    | object[]                                      | Question definitions (nps, numeric_scale, star_rating, emoji_rating, dropdown, short_text, long_text, multiple_choice) |
| `introStep`    | object?                                       | Intro screen (large format only)                                                                                       |
| `thankYouStep` | object?                                       | Completion screen                                                                                                      |
| `triggers`     | object?                                       | Display triggers (immediate, page_visit, time_on_page, event)                                                          |
| `frequency`    | "once" \| "until_completed"?                  | Show frequency                                                                                                         |
| `scheduling`   | object?                                       | Start/end date windows                                                                                                 |

**Indexes:** `by_workspace`, `by_workspace_status`

### `surveyResponses`

Visitor answers to surveys.

| Field         | Type                     | Description               |
| ------------- | ------------------------ | ------------------------- |
| `surveyId`    | Id\<surveys\>            | Parent survey             |
| `workspaceId` | Id\<workspaces\>         | Workspace                 |
| `visitorId`   | Id\<visitors\>?          | Responding visitor        |
| `answers`     | object[]                 | Question ID + value pairs |
| `status`      | "partial" \| "completed" | Response completeness     |
| `startedAt`   | number                   | When started              |
| `completedAt` | number?                  | When completed            |

**Indexes:** `by_survey`, `by_workspace`, `by_visitor`, `by_visitor_survey`

### `surveyImpressions`

Survey display and interaction tracking.

| Field       | Type                                               | Description |
| ----------- | -------------------------------------------------- | ----------- |
| `surveyId`  | Id\<surveys\>                                      | Survey      |
| `visitorId` | Id\<visitors\>                                     | Viewer      |
| `action`    | "shown" \| "started" \| "completed" \| "dismissed" | Interaction |
| `createdAt` | number                                             | Timestamp   |

**Indexes:** `by_survey`, `by_visitor`, `by_visitor_survey`

## Campaign Tables

### `emailCampaigns`

Outbound email campaigns with targeting and delivery tracking.

| Field           | Type                                                      | Description                                                                         |
| --------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `workspaceId`   | Id\<workspaces\>                                          | Workspace                                                                           |
| `name`          | string                                                    | Campaign name                                                                       |
| `subject`       | string                                                    | Email subject                                                                       |
| `previewText`   | string?                                                   | Email preview text                                                                  |
| `content`       | string                                                    | Email body (HTML)                                                                   |
| `templateId`    | Id\<emailTemplates\>?                                     | Template reference                                                                  |
| `audienceRules` | any?                                                      | Targeting rules                                                                     |
| `schedule`      | object?                                                   | Immediate or scheduled delivery                                                     |
| `status`        | "draft" \| "scheduled" \| "sending" \| "sent" \| "paused" | Campaign state                                                                      |
| `stats`         | object?                                                   | Delivery metrics (pending, sent, delivered, opened, clicked, bounced, unsubscribed) |

**Indexes:** `by_workspace`, `by_workspace_status`

### `emailCampaignRecipients`

Per-recipient delivery tracking for email campaigns.

| Field           | Type                                                                                       | Description                |
| --------------- | ------------------------------------------------------------------------------------------ | -------------------------- |
| `campaignId`    | Id\<emailCampaigns\>                                                                       | Parent campaign            |
| `visitorId`     | Id\<visitors\>                                                                             | Recipient visitor          |
| `email`         | string                                                                                     | Recipient email            |
| `trackingToken` | string                                                                                     | Unique tracking identifier |
| `status`        | "pending" \| "sent" \| "delivered" \| "opened" \| "clicked" \| "bounced" \| "unsubscribed" | Delivery state             |

**Indexes:** `by_campaign`, `by_visitor`, `by_campaign_status`, `by_tracking_token`

### `emailTemplates`

Reusable HTML email templates.

| Field         | Type             | Description             |
| ------------- | ---------------- | ----------------------- |
| `workspaceId` | Id\<workspaces\> | Workspace               |
| `name`        | string           | Template name           |
| `subject`     | string?          | Default subject         |
| `html`        | string           | HTML template body      |
| `variables`   | string[]?        | Template variable names |
| `category`    | string?          | Template category       |

**Indexes:** `by_workspace`

### `pushCampaigns`

Push notification campaigns for mobile users.

| Field           | Type                                                      | Description                                        |
| --------------- | --------------------------------------------------------- | -------------------------------------------------- |
| `workspaceId`   | Id\<workspaces\>                                          | Workspace                                          |
| `name`          | string                                                    | Campaign name                                      |
| `title`         | string                                                    | Push title                                         |
| `body`          | string                                                    | Push body                                          |
| `imageUrl`      | string?                                                   | Push image                                         |
| `data`          | object?                                                   | Custom push data payload                           |
| `deepLink`      | string?                                                   | Deep link URL                                      |
| `audienceRules` | any?                                                      | Targeting rules                                    |
| `targeting`     | any?                                                      | Targeting rules (legacy/compat field)              |
| `schedule`      | object?                                                   | Immediate/scheduled send metadata                  |
| `status`        | "draft" \| "scheduled" \| "sending" \| "sent" \| "paused" | Campaign state                                     |
| `stats`         | object?                                                   | Delivery metrics (sent, delivered, opened, failed) |
| `sentAt`        | number?                                                   | Send completion timestamp                          |

**Indexes:** `by_workspace`, `by_workspace_status`

### `pushCampaignRecipients`

Per-recipient delivery records for push campaigns.

| Field           | Type                                                       | Description                                             |
| --------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| `campaignId`    | Id\<pushCampaigns\>                                        | Parent campaign                                         |
| `recipientType` | "agent" \| "visitor"?                                      | Recipient domain (visitor campaign sends use `visitor`) |
| `userId`        | Id\<users\>?                                               | Agent recipient (legacy/agent domain)                   |
| `visitorId`     | Id\<visitors\>?                                            | Visitor recipient                                       |
| `tokenId`       | Id\<pushTokens\> \| Id\<visitorPushTokens\>                | Referenced push token document                          |
| `status`        | "pending" \| "sent" \| "delivered" \| "opened" \| "failed" | Delivery state                                          |
| `sentAt`        | number?                                                    | Sent timestamp                                          |
| `deliveredAt`   | number?                                                    | Delivered timestamp                                     |
| `openedAt`      | number?                                                    | Opened timestamp                                        |
| `error`         | string?                                                    | Failure reason                                          |
| `createdAt`     | number                                                     | Creation timestamp                                      |

**Indexes:** `by_campaign`, `by_user`, `by_visitor`, `by_campaign_status`

### `carousels`

Multi-screen promotional content for mobile SDKs.

| Field           | Type                                          | Description                                             |
| --------------- | --------------------------------------------- | ------------------------------------------------------- |
| `workspaceId`   | Id\<workspaces\>                              | Workspace                                               |
| `name`          | string                                        | Carousel name                                           |
| `screens`       | object[]                                      | Screen definitions (id, title, body, imageUrl, buttons) |
| `audienceRules` | any?                                          | Targeting rules                                         |
| `status`        | "draft" \| "active" \| "paused" \| "archived" | Carousel state                                          |
| `priority`      | number?                                       | Display priority                                        |

**Indexes:** `by_workspace`, `by_workspace_status`

## Series Tables

### `series`

Multi-step automated campaign sequences.

| Field           | Type                                          | Description                                                                            |
| --------------- | --------------------------------------------- | -------------------------------------------------------------------------------------- |
| `workspaceId`   | Id\<workspaces\>                              | Workspace                                                                              |
| `name`          | string                                        | Series name                                                                            |
| `description`   | string?                                       | Description                                                                            |
| `entryTriggers` | object[]?                                     | Entry conditions (event, auto_event, visitor_attribute_changed, visitor_state_changed) |
| `entryRules`    | any?                                          | Entry audience rules                                                                   |
| `exitRules`     | any?                                          | Exit conditions                                                                        |
| `goalRules`     | any?                                          | Goal conditions                                                                        |
| `status`        | "draft" \| "active" \| "paused" \| "archived" | Series state                                                                           |
| `stats`         | object?                                       | Aggregate metrics (entered, active, completed, exited, goalReached)                    |

**Indexes:** `by_workspace`, `by_workspace_status`

### `seriesBlocks`

Individual blocks in a series graph (actions, waits, conditions).

| Field      | Type                                                                             | Description                                                                       |
| ---------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `seriesId` | Id\<series\>                                                                     | Parent series                                                                     |
| `type`     | "rule" \| "wait" \| "email" \| "push" \| "chat" \| "post" \| "carousel" \| "tag" | Block type                                                                        |
| `position` | object                                                                           | Canvas position (x, y)                                                            |
| `config`   | object                                                                           | Type-specific configuration (rules, waitDuration, subject, body, tagAction, etc.) |

**Indexes:** `by_series`

### `seriesConnections`

Directed edges between series blocks (conditional branching).

| Field         | Type                        | Description      |
| ------------- | --------------------------- | ---------------- |
| `seriesId`    | Id\<series\>                | Parent series    |
| `fromBlockId` | Id\<seriesBlocks\>          | Source block     |
| `toBlockId`   | Id\<seriesBlocks\>          | Target block     |
| `condition`   | "yes" \| "no" \| "default"? | Branch condition |

**Indexes:** `by_series`, `by_from_block`, `by_to_block`

### `seriesProgress`

Per-visitor progress through a series.

| Field            | Type                                                                           | Description                 |
| ---------------- | ------------------------------------------------------------------------------ | --------------------------- |
| `visitorId`      | Id\<visitors\>                                                                 | Visitor                     |
| `seriesId`       | Id\<series\>                                                                   | Series                      |
| `currentBlockId` | Id\<seriesBlocks\>?                                                            | Current block               |
| `status`         | "active" \| "waiting" \| "completed" \| "exited" \| "goal_reached" \| "failed" | Progress state              |
| `waitUntil`      | number?                                                                        | Wait block expiry           |
| `waitEventName`  | string?                                                                        | Event to wait for           |
| `enteredAt`      | number                                                                         | When visitor entered series |

**Indexes:** `by_visitor`, `by_series`, `by_visitor_series`, `by_status`, `by_visitor_status`, `by_series_wait_until`

## Email Channel Tables

### `emailConfigs`

Workspace email channel configuration.

| Field               | Type                                  | Description           |
| ------------------- | ------------------------------------- | --------------------- |
| `workspaceId`       | Id\<workspaces\>                      | Workspace             |
| `forwardingAddress` | string                                | Inbound email address |
| `fromName`          | string?                               | Sender display name   |
| `fromEmail`         | string?                               | Sender email          |
| `signature`         | string?                               | Email signature       |
| `provider`          | "resend" \| "sendgrid" \| "postmark"? | Email provider        |
| `enabled`           | boolean                               | Channel enabled state |

**Indexes:** `by_workspace`, `by_forwarding_address`

### `emailThreads`

Email thread tracking for conversation threading.

| Field               | Type                | Description              |
| ------------------- | ------------------- | ------------------------ |
| `workspaceId`       | Id\<workspaces\>    | Workspace                |
| `conversationId`    | Id\<conversations\> | Linked conversation      |
| `messageId`         | string              | Email Message-ID header  |
| `subject`           | string              | Email subject            |
| `normalizedSubject` | string              | Subject without Re:/Fwd: |
| `senderEmail`       | string              | Sender address           |

**Indexes:** `by_conversation`, `by_message_id`, `by_subject_sender`

## AI Agent Tables

### `aiAgentSettings`

Per-workspace AI agent configuration.

| Field                 | Type                                               | Description                        |
| --------------------- | -------------------------------------------------- | ---------------------------------- |
| `workspaceId`         | Id\<workspaces\>                                   | Workspace                          |
| `enabled`             | boolean                                            | AI agent enabled                   |
| `knowledgeSources`    | ("articles" \| "internalArticles" \| "snippets")[] | Content sources for responses      |
| `confidenceThreshold` | number                                             | Minimum confidence to auto-respond |
| `personality`         | string?                                            | AI personality prompt              |
| `handoffMessage`      | string?                                            | Message on human handoff           |
| `model`               | string                                             | LLM model identifier               |
| `suggestionsEnabled`  | boolean?                                           | Enable agent-facing suggestions    |
| `embeddingModel`      | string?                                            | Embedding model for vector search  |

**Indexes:** `by_workspace`

### `contentEmbeddings`

Vector embeddings for AI-powered content search.

| Field         | Type                                        | Description                          |
| ------------- | ------------------------------------------- | ------------------------------------ |
| `workspaceId` | Id\<workspaces\>                            | Workspace                            |
| `contentType` | "article" \| "internalArticle" \| "snippet" | Source content type                  |
| `contentId`   | string                                      | Source content ID                    |
| `embedding`   | float64[]                                   | 1536-dimension vector                |
| `textHash`    | string                                      | Content hash for staleness detection |
| `title`       | string                                      | Content title                        |
| `snippet`     | string                                      | Content preview                      |

**Indexes:** `by_content`, `by_workspace`
**Vector indexes:** `by_embedding` (1536 dimensions, filtered by workspace and contentType)

### `aiResponses`

Individual AI response records for analytics and feedback.

| Field              | Type                        | Description                    |
| ------------------ | --------------------------- | ------------------------------ |
| `conversationId`   | Id\<conversations\>         | Conversation                   |
| `messageId`        | Id\<messages\>              | Generated message              |
| `query`            | string                      | Visitor's question             |
| `response`         | string                      | AI response                    |
| `sources`          | object[]                    | Knowledge sources used         |
| `confidence`       | number                      | Response confidence score      |
| `feedback`         | "helpful" \| "not_helpful"? | User feedback                  |
| `handedOff`        | boolean                     | Whether human handoff occurred |
| `model`            | string                      | Model used                     |
| `provider`         | string                      | Provider (openai, anthropic)   |
| `generationTimeMs` | number                      | Response generation time       |

**Indexes:** `by_conversation`, `by_message`, `by_feedback`

## Automation & Targeting Tables

### `automationSettings`

Workspace-level toggle settings for automated behaviors.

| Field                    | Type             | Description                     |
| ------------------------ | ---------------- | ------------------------------- |
| `workspaceId`            | Id\<workspaces\> | Workspace                       |
| `suggestArticlesEnabled` | boolean          | Auto-suggest articles in widget |
| `showReplyTimeEnabled`   | boolean          | Show expected reply time        |
| `collectEmailEnabled`    | boolean          | Prompt for email capture        |
| `askForRatingEnabled`    | boolean          | CSAT prompt after resolution    |

**Indexes:** `by_workspace`

### `segments`

Saved audience segments for reuse across features.

| Field           | Type             | Description         |
| --------------- | ---------------- | ------------------- |
| `workspaceId`   | Id\<workspaces\> | Workspace           |
| `name`          | string           | Segment name        |
| `description`   | string?          | Segment description |
| `audienceRules` | any              | Rule definitions    |
| `createdBy`     | Id\<users\>?     | Creator             |

**Indexes:** `by_workspace`, `by_workspace_name`

### `assignmentRules`

Automatic conversation routing based on visitor/conversation attributes.

| Field         | Type             | Description                                    |
| ------------- | ---------------- | ---------------------------------------------- |
| `workspaceId` | Id\<workspaces\> | Workspace                                      |
| `name`        | string           | Rule name                                      |
| `priority`    | number           | Evaluation order                               |
| `enabled`     | boolean          | Active state                                   |
| `conditions`  | object[]         | Match conditions (field, operator, value)      |
| `action`      | object           | Assignment target (assign_user or assign_team) |

**Indexes:** `by_workspace`, `by_workspace_priority`

### `tags` / `conversationTags`

Workspace-level tags and their application to conversations.

**`tags`:** `workspaceId`, `name`, `color`
**`conversationTags`:** `conversationId`, `tagId`, `appliedBy` ("manual" \| "auto"), `appliedByUserId`

### `autoTagRules`

Rules for automatically applying tags to conversations.

| Field         | Type             | Description      |
| ------------- | ---------------- | ---------------- |
| `workspaceId` | Id\<workspaces\> | Workspace        |
| `name`        | string           | Rule name        |
| `enabled`     | boolean          | Active state     |
| `conditions`  | object[]         | Match conditions |
| `tagId`       | Id\<tags\>       | Tag to apply     |

**Indexes:** `by_workspace`

## Operational Tables

### `auditLogs`

Security event tracking for compliance and debugging.

| Field          | Type                        | Description            |
| -------------- | --------------------------- | ---------------------- |
| `workspaceId`  | Id\<workspaces\>            | Workspace              |
| `actorId`      | Id\<users\>?                | Acting user            |
| `actorType`    | "user" \| "system" \| "api" | Actor category         |
| `action`       | string                      | Action performed       |
| `resourceType` | string                      | Affected resource type |
| `resourceId`   | string?                     | Affected resource ID   |
| `metadata`     | any?                        | Additional context     |
| `timestamp`    | number                      | Event timestamp        |

**Indexes:** `by_workspace`, `by_workspace_action`, `by_workspace_timestamp`, `by_actor`

Notable action contract: visitor email-based dedup/merge writes
`action: "visitor.merged"` with metadata containing source visitor ID, target
visitor ID, and merge timestamp for lineage/debug traceability.

### `auditLogSettings`

Per-workspace audit log retention configuration.

| Field           | Type             | Description                            |
| --------------- | ---------------- | -------------------------------------- |
| `workspaceId`   | Id\<workspaces\> | Workspace                              |
| `retentionDays` | number           | Retention period (30, 90, or 365 days) |

**Indexes:** `by_workspace`

### `messengerSettings`

Widget/messenger appearance and behavior customization.

| Field                   | Type                          | Description                         |
| ----------------------- | ----------------------------- | ----------------------------------- |
| `workspaceId`           | Id\<workspaces\>              | Workspace                           |
| `primaryColor`          | string                        | Brand primary color                 |
| `backgroundColor`       | string                        | Widget background                   |
| `themeMode`             | "light" \| "dark" \| "system" | Theme mode                          |
| `launcherPosition`      | "right" \| "left"             | Launcher button position            |
| `launcherSideSpacing`   | number                        | Horizontal offset (px)              |
| `launcherBottomSpacing` | number                        | Vertical offset (px)                |
| `showLauncher`          | boolean                       | Launcher visibility                 |
| `welcomeMessage`        | string                        | Welcome message text                |
| `showTeammateAvatars`   | boolean                       | Show team avatars                   |
| `homeConfig`            | object?                       | Home page card layout configuration |

**Indexes:** `by_workspace`

### `reportSnapshots`

Cached aggregated metrics for dashboard reports.

| Field         | Type                                                | Description             |
| ------------- | --------------------------------------------------- | ----------------------- |
| `workspaceId` | Id\<workspaces\>                                    | Workspace               |
| `reportType`  | "conversations" \| "agents" \| "csat" \| "ai_agent" | Report type             |
| `periodStart` | number                                              | Period start timestamp  |
| `periodEnd`   | number                                              | Period end timestamp    |
| `granularity` | "day" \| "week" \| "month"                          | Aggregation granularity |
| `metrics`     | any                                                 | Aggregated metric data  |

**Indexes:** `by_workspace`, `by_workspace_type`, `by_workspace_period`

## Notification Tables

### `pushTokens`

Agent device push notification tokens.

| Field                  | Type               | Description                               |
| ---------------------- | ------------------ | ----------------------------------------- |
| `userId`               | Id\<users\>        | Agent user                                |
| `token`                | string             | Device push token                         |
| `platform`             | "ios" \| "android" | Device platform                           |
| `notificationsEnabled` | boolean?           | Whether sends are enabled for this token  |
| `failureCount`         | number?            | Accumulated provider delivery failures    |
| `lastFailureAt`        | number?            | Timestamp of most recent delivery failure |
| `lastFailureReason`    | string?            | Last provider failure reason              |
| `disabledAt`           | number?            | Timestamp when token was disabled         |
| `updatedAt`            | number?            | Last update timestamp                     |
| `createdAt`            | number             | Token created timestamp                   |

**Indexes:** `by_user`, `by_token`

### `visitorPushTokens`

Visitor device push notification tokens (mobile SDK).

| Field                  | Type               | Description                               |
| ---------------------- | ------------------ | ----------------------------------------- |
| `visitorId`            | Id\<visitors\>     | Visitor                                   |
| `workspaceId`          | Id\<workspaces\>   | Workspace                                 |
| `token`                | string             | Device push token                         |
| `platform`             | "ios" \| "android" | Device platform                           |
| `deviceId`             | string?            | Device identifier                         |
| `notificationsEnabled` | boolean?           | Whether sends are currently enabled       |
| `failureCount`         | number?            | Accumulated provider delivery failures    |
| `lastFailureAt`        | number?            | Timestamp of most recent delivery failure |
| `lastFailureReason`    | string?            | Last provider failure reason              |
| `disabledAt`           | number?            | Timestamp when token was disabled         |
| `createdAt`            | number             | Token created timestamp                   |
| `updatedAt`            | number             | Last update timestamp                     |

**Indexes:** `by_visitor`, `by_workspace`, `by_workspace_updated_at`, `by_token`

### `notificationPreferences`

Agent notification settings per workspace.

| Field         | Type             | Description                          |
| ------------- | ---------------- | ------------------------------------ |
| `userId`      | Id\<users\>      | Agent                                |
| `workspaceId` | Id\<workspaces\> | Workspace                            |
| `muted`       | boolean          | Whether notifications are muted      |
| `events`      | object?          | Per-event channel settings overrides |
| `createdAt`   | number           | Created timestamp                    |
| `updatedAt`   | number           | Last update timestamp                |

**Indexes:** `by_user`, `by_user_workspace`

### `workspaceNotificationDefaults`

Workspace-level default notification event/channel settings.

| Field         | Type             | Description                        |
| ------------- | ---------------- | ---------------------------------- |
| `workspaceId` | Id\<workspaces\> | Workspace                          |
| `events`      | object?          | Default per-event channel settings |
| `createdAt`   | number           | Created timestamp                  |
| `updatedAt`   | number           | Last update timestamp              |

**Indexes:** `by_workspace`

### `notificationEvents`

Canonical notification event envelopes generated from chat/ticket/outbound/campaign activity.

| Field               | Type                                           | Description                                                                                       |
| ------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `workspaceId`       | Id\<workspaces\>                               | Workspace                                                                                         |
| `eventKey`          | string                                         | Stable event correlation key                                                                      |
| `eventType`         | union                                          | Event class (`chat_message`, `new_conversation`, `assignment`, ticket/outbound/campaign variants) |
| `domain`            | "chat" \| "ticket" \| "outbound" \| "campaign" | Source domain                                                                                     |
| `audience`          | "agent" \| "visitor" \| "both"                 | Recipient audience                                                                                |
| `actorType`         | "agent" \| "visitor" \| "bot" \| "system"      | Event actor category                                                                              |
| `actorUserId`       | Id\<users\>?                                   | Actor user                                                                                        |
| `actorVisitorId`    | Id\<visitors\>?                                | Actor visitor                                                                                     |
| `conversationId`    | Id\<conversations\>?                           | Related conversation                                                                              |
| `ticketId`          | Id\<tickets\>?                                 | Related ticket                                                                                    |
| `outboundMessageId` | Id\<outboundMessages\>?                        | Related outbound message                                                                          |
| `campaignId`        | Id\<pushCampaigns\>?                           | Related push campaign                                                                             |
| `title`             | string?                                        | Notification title snapshot                                                                       |
| `bodyPreview`       | string?                                        | Notification body preview                                                                         |
| `data`              | object?                                        | Additional metadata payload                                                                       |
| `createdAt`         | number                                         | Created timestamp                                                                                 |

**Indexes:** `by_workspace`, `by_workspace_created_at`, `by_event_key`

### `notificationDedupeKeys`

Idempotency keys for event-recipient-channel fanout.

| Field           | Type                                   | Description             |
| --------------- | -------------------------------------- | ----------------------- |
| `dedupeKey`     | string                                 | Unique dedupe key       |
| `eventId`       | Id\<notificationEvents\>               | Related canonical event |
| `eventKey`      | string                                 | Event correlation key   |
| `workspaceId`   | Id\<workspaces\>                       | Workspace               |
| `channel`       | "push" \| "email" \| "web" \| "widget" | Delivery channel        |
| `recipientType` | "agent" \| "visitor"                   | Recipient category      |
| `userId`        | Id\<users\>?                           | Agent recipient         |
| `visitorId`     | Id\<visitors\>?                        | Visitor recipient       |
| `createdAt`     | number                                 | Created timestamp       |

**Indexes:** `by_dedupe_key`, `by_event`, `by_workspace`

### `notificationDeliveries`

Per-attempt delivery outcomes for notification routing.

| Field           | Type                                    | Description                             |
| --------------- | --------------------------------------- | --------------------------------------- |
| `workspaceId`   | Id\<workspaces\>                        | Workspace                               |
| `eventId`       | Id\<notificationEvents\>?               | Related canonical event                 |
| `eventKey`      | string                                  | Event correlation key                   |
| `dedupeKey`     | string                                  | Event-recipient-channel dedupe key      |
| `channel`       | "push" \| "email" \| "web" \| "widget"  | Delivery channel                        |
| `recipientType` | "agent" \| "visitor"                    | Recipient category                      |
| `userId`        | Id\<users\>?                            | Agent recipient                         |
| `visitorId`     | Id\<visitors\>?                         | Visitor recipient                       |
| `tokenCount`    | number?                                 | Number of target tokens (if applicable) |
| `status`        | "delivered" \| "suppressed" \| "failed" | Delivery outcome                        |
| `reason`        | string?                                 | Suppression/failure reason code         |
| `error`         | string?                                 | Error string for failures               |
| `metadata`      | object?                                 | Additional transport/context metadata   |
| `createdAt`     | number                                  | Created timestamp                       |

**Indexes:** `by_workspace`, `by_workspace_created_at`, `by_event`, `by_dedupe_key`

### `commonIssueButtons`

Self-serve quick action buttons in the widget home screen.

| Field                 | Type                              | Description        |
| --------------------- | --------------------------------- | ------------------ |
| `workspaceId`         | Id\<workspaces\>                  | Workspace          |
| `label`               | string                            | Button label       |
| `action`              | "article" \| "start_conversation" | Button action type |
| `articleId`           | Id\<articles\>?                   | Linked article     |
| `conversationStarter` | string?                           | Pre-filled message |
| `order`               | number                            | Display order      |
| `enabled`             | boolean                           | Active state       |

**Indexes:** `by_workspace`, `by_workspace_order`

### `officeHours`

Workspace business hours configuration.

| Field                      | Type             | Description                                          |
| -------------------------- | ---------------- | ---------------------------------------------------- |
| `workspaceId`              | Id\<workspaces\> | Workspace                                            |
| `timezone`                 | string           | Timezone identifier                                  |
| `schedule`                 | object[]         | Per-day schedules (day, enabled, startTime, endTime) |
| `offlineMessage`           | string?          | Message shown outside hours                          |
| `expectedReplyTimeMinutes` | number?          | Expected response time                               |

**Indexes:** `by_workspace`
