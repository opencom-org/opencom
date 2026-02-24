# Architecture Overview

This document describes the high-level architecture of the Opencom platform, including system components, data flows, authentication, deployment topology, and real-time subscriptions.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         End Users / Visitors                        │
└──────┬──────────────┬──────────────┬──────────────┬─────────────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
┌─────────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────┐
│  Web Widget │ │ iOS SDK  │ │Android SDK│ │   RN SDK     │
│  (Vite)     │ │ (Swift)  │ │ (Kotlin)  │ │ (Expo)       │
│ apps/widget │ │ ios-sdk  │ │android-sdk│ │ rn-sdk       │
└──────┬──────┘ └────┬─────┘ └─────┬─────┘ └──────┬───────┘
       │              │              │              │
       └──────────────┴──────┬───────┴──────────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │   Convex Backend    │
                  │  packages/convex    │
                  │                     │
                  │  • Mutations        │
                  │  • Queries          │
                  │  • HTTP Routes      │
                  │  • Scheduled Jobs   │
                  │  • File Storage     │
                  └──────┬──────────────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
              ▼          ▼          ▼
       ┌───────────┐ ┌────────┐ ┌────────────┐
       │  Resend   │ │ip-api  │ │ AI Gateway │
       │  (Email)  │ │(Geo)   │ │ OpenAI /   │
       │           │ │        │ │ Anthropic  │
       └───────────┘ └────────┘ └────────────┘

                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌─────────────┐ ┌──────────┐ ┌──────────────┐
       │Web Dashboard│ │Admin App │ │ Landing Page │
       │  (Next.js)  │ │ (Expo)   │ │  (Next.js)   │
       │  apps/web   │ │apps/mobile│ │ apps/landing │
       └─────────────┘ └──────────┘ └──────────────┘
              │              │
              ▼              ▼
       ┌──────────────────────────┐
       │   Agents / Admins        │
       └──────────────────────────┘
```

### Component Roles

| Component            | Technology                          | Purpose                                                                            |
| -------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| **Web Dashboard**    | Next.js, React, Tailwind, Shadcn UI | Agent/admin interface for managing conversations, content, settings                |
| **Admin App**        | React Native, Expo                  | Mobile app for agents to respond to conversations on-the-go                        |
| **Web Widget**       | Vite, React                         | Embeddable chat widget for customer websites                                       |
| **Landing Page**     | Next.js                             | Public marketing website                                                           |
| **React Native SDK** | React Native, Expo                  | SDK for embedding Opencom in customer mobile apps                                  |
| **iOS SDK**          | Swift (SPM + CocoaPods)             | Native iOS SDK for customer apps                                                   |
| **Android SDK**      | Kotlin (Gradle)                     | Native Android SDK for customer apps                                               |
| **Convex Backend**   | Convex (serverless)                 | Database, real-time subscriptions, mutations, queries, HTTP routes, scheduled jobs |
| **Resend**           | External API                        | Transactional email (OTP, campaigns) and inbound email webhooks                    |
| **ip-api.com**       | External API                        | Visitor IP geolocation (via HTTPS)                                                 |
| **AI Gateway**       | External API                        | LLM providers (OpenAI, Anthropic) for AI agent responses                           |

---

## Data Flow

### Visitor Interaction Flow

```
1. Visitor loads page with widget script
2. Widget initializes → creates/retrieves visitor session (sessionId in localStorage)
3. Visitor sends message:
   Widget → messages.send(conversationId, content, senderType: "visitor")
         → Convex stores message
         → Real-time subscription notifies agent dashboard
         → If AI agent enabled: scheduler triggers AI response pipeline
4. AI Agent response (if enabled):
   Scheduler → search knowledge base (vector similarity)
            → call LLM with context
            → check confidence threshold
            → if confident: internalSendBotMessage(conversationId, response)
            → if not confident: handoff to human agent
5. Agent responds:
   Dashboard → messages.send(conversationId, content, senderType: "agent")
            → Convex stores message
            → Real-time subscription notifies widget
            → Push notification sent to visitor (if mobile SDK)
```

### Email Channel Flow

```
1. Inbound email:
   Resend webhook → http.ts /email/inbound
                  → verify SVIX signature
                  → find or create conversation by email thread
                  → store as message with senderType: "visitor"
                  → notify agents via real-time subscription

2. Outbound email:
   Agent replies to email conversation
   → messages.send stores message
   → scheduler triggers email sending via Resend API
   → track delivery status (sent/delivered/opened/bounced)
```

### Campaign Delivery Flow

```
1. Admin creates campaign with audience rules and trigger conditions
2. Campaign activated → stored as "active" in database
3. Widget/SDK checks for active campaigns on load:
   → evaluate audience rules against visitor attributes
   → evaluate trigger conditions (page, time, scroll, event)
   → if matched: display campaign content (chat/post/banner/carousel)
   → track impression (shown/clicked/dismissed)
4. Series (multi-step):
   → visitor enters series based on entry rules
   → scheduler processes series blocks sequentially
   → wait blocks pause for configured duration
   → rule blocks evaluate conditions for branching
   → exit/goal rules remove visitor from series
```

### Notification Routing and Delivery Flow

```
1. Domain event occurs (chat/ticket/outbound/campaign)
2. Backend normalizes event into canonical notification envelope
   → stores event key, workspace context, actor, and content preview
3. Router resolves recipients and channels:
   → agent/visitor audience resolution
   → push/email/web/widget channel eligibility
   → workspace defaults + member overrides + token-level enablement
4. Suppression and deduplication:
   → sender/session suppression for self-originated events
   → idempotency key per event-recipient-channel combination
5. Delivery outcomes are persisted:
   → delivered / suppressed / failed
   → machine-readable reason and transport metadata
```

### Visitor Merge Auditability Flow

```
1. Visitor is identified with email that matches existing canonical visitor
2. Backend merges duplicate visitor profile into canonical record
3. Conversations/messages are re-bound to canonical visitor
4. Audit log entry is written with action "visitor.merged"
   → metadata includes sourceVisitorId, targetVisitorId, and mergedAt
5. Operators can trace merge lineage from audit logs during support/debugging
```

---

## Authentication Flows

### Password Authentication

```
1. User enters email + password on login page
2. Client calls signIn("password", { email, password })
3. Convex Auth verifies credentials against stored hash
4. On success: creates auth session, returns JWT
5. Client stores JWT → subsequent requests include auth token
6. createOrUpdateUser callback:
   → lookup user by email (index: by_email)
   → if exists: link to existing user
   → if new: create workspace + user + membership
   → process pending invitations (index: by_email)
```

### OTP (Magic Code) Authentication

```
1. User enters email on login page
2. Client calls signIn("resend-otp", { email })
3. Convex Auth generates 6-digit code
4. Resend sends verification email with code
5. User enters code
6. Client calls signIn("resend-otp", { email, code })
7. Convex Auth verifies code (valid for 10 minutes)
8. On success: creates auth session, returns JWT
9. createOrUpdateUser callback (same as password flow)
```

### Session Management

```
• Sessions are managed by Convex Auth
• JWT tokens include user ID and expiration
• getAuthenticatedUserFromSession(ctx) extracts user from session
• Sessions persist across page reloads (stored in browser/app)
• Logout invalidates the session server-side
```

### Visitor Session (Signed Sessions)

```
• Visitors authenticate via signed session tokens (widgetSessions:boot)
• On first load the widget/SDK calls boot with workspaceId + sessionId
  → Convex creates or retrieves the visitor
  → Creates a widgetSessions record with a cryptographic token (wst_…)
  → Returns { visitor, sessionToken, expiresAt }
• The sessionToken is stored client-side and sent with every visitor-facing call
• All visitor queries/mutations call resolveVisitorFromSession() which:
  1. Validates the token exists and is not expired
  2. Confirms the token's workspaceId matches the request
  3. Returns the resolved visitorId
• Raw visitorId alone is never accepted — sessionToken is mandatory
• Optional: identify() call links visitor to known user (email, userId)
• Optional: HMAC identity verification prevents impersonation
• Tokens expire after 24 h (configurable 1 h – 7 d per workspace)
  and are refreshed automatically when <25 % lifetime remains
```

---

## Authorization Model

### Dual-Path Authorization

Most queries and mutations support two authorization paths:

1. **Agent path**: Authenticated user → workspace membership check → permission check
2. **Visitor path**: Signed session token → resolveVisitorFromSession() → ownership verification

```
Request arrives
├─ Has auth session (JWT)?
│  ├─ Yes → getAuthenticatedUserFromSession()
│  │        → getWorkspaceMembership() or requirePermission()
│  │        → Allow/deny based on role permissions
│  └─ No → Has sessionToken + workspaceId?
│          ├─ Yes → resolveVisitorFromSession(token, workspaceId)
│          │        → Verify visitor owns the resource
│          └─ No → Deny (return null / [] or throw)
```

### Role Hierarchy

```
Owner > Admin > Agent > Viewer
  │       │       │       │
  │       │       │       └─ Read-only (conversations, articles, audit)
  │       │       └─ Day-to-day support (reply, assign, close, snippets, checklists)
  │       └─ Management (users, settings, security, data)
  └─ Full access (billing, ownership transfer)
```

---

## Deployment Topology

### Option A: Fully Hosted

```
┌──────────────┐     ┌──────────────┐
│ Opencom      │     │ Opencom      │
│ Convex Cloud │◄────│ Web App      │
│ (shared)     │     │ (hosted)     │
└──────────────┘     └──────────────┘
       ▲
       │
┌──────────────┐
│ Customer     │
│ Website      │
│ + Widget     │
└──────────────┘
```

### Option B: Self-Hosted Backend

```
┌──────────────┐     ┌──────────────┐
│ Your Convex  │     │ Opencom      │
│ Project      │◄────│ Hosted Apps  │
│ (self-hosted)│     │ (web/mobile) │
└──────────────┘     └──────────────┘
       ▲
       │
┌──────────────┐
│ Customer     │
│ Website      │
│ + Widget     │
└──────────────┘
```

### Option C: Self-Hosted Backend + Web

```
┌──────────────┐     ┌──────────────┐
│ Your Convex  │     │ Your Vercel/ │
│ Project      │◄────│ Netlify      │
│              │     │ (web app)    │
└──────────────┘     └──────────────┘
       ▲
       │
┌──────────────┐
│ Customer     │
│ Website      │
│ + Widget     │
└──────────────┘
```

### Option D: Fully Self-Hosted

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Your Convex  │     │ Your Web     │     │ Your Mobile  │
│ Project      │◄────│ Deployment   │     │ Apps (Store) │
│              │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
       ▲                                         │
       └─────────────────────────────────────────┘
```

---

## Real-Time Subscription Model

Convex provides real-time reactivity via subscriptions. Components subscribe to queries that automatically re-run when underlying data changes.

### Web Dashboard Subscriptions

| Component           | Subscribes To                | Data                                   |
| ------------------- | ---------------------------- | -------------------------------------- |
| Inbox               | `conversations.listForInbox` | Open conversations with latest message |
| Conversation Detail | `messages.list`              | Messages for selected conversation     |
| Conversation Detail | `conversations.get`          | Conversation metadata, status          |
| Visitor Panel       | `visitors.get`               | Visitor profile, attributes            |
| Unread Count        | `conversations.listForInbox` | Derived unread count                   |
| Team Members        | `workspaceMembers.list`      | Workspace member list                  |
| Settings            | `workspaces.get`             | Workspace configuration                |

### Widget Subscriptions

| Component         | Subscribes To                            | Data                                |
| ----------------- | ---------------------------------------- | ----------------------------------- |
| Conversation View | `messages.list`                          | Messages for visitor's conversation |
| Unread Badge      | `conversations.getTotalUnreadForVisitor` | Unread message count                |
| Tour Overlay      | `tours.getActiveForVisitor`              | Active tours matching targeting     |
| Tooltip Overlay   | `tooltips.getActiveForVisitor`           | Active tooltips matching targeting  |
| Outbound Overlay  | `outboundMessages.getActiveForVisitor`   | Outbound messages matching triggers |
| Survey Overlay    | `surveys.getActiveForVisitor`            | Active surveys matching targeting   |
| Checklist Overlay | `checklists.getActiveForVisitor`         | Active checklists for visitor       |

### Mobile App Subscriptions

| Component | Subscribes To                     | Data                               |
| --------- | --------------------------------- | ---------------------------------- |
| Inbox     | `conversations.listForInbox`      | Open conversations                 |
| Chat      | `messages.list`                   | Messages for selected conversation |
| Push      | N/A (push notifications via Expo) | New message alerts                 |

### Mobile SDK Subscriptions

| Component | Subscribes To                            | Data                                |
| --------- | ---------------------------------------- | ----------------------------------- |
| Messenger | `messages.list`                          | Messages for visitor's conversation |
| Carousels | `carousels.getActiveForVisitor`          | Active carousels                    |
| Unread    | `conversations.getTotalUnreadForVisitor` | Badge count                         |

---

## Key Technical Decisions

1. **Convex as sole backend**: All data, auth, real-time, file storage, and scheduled jobs run on Convex. No separate API server.
2. **Multi-tenant via workspaces**: Every data record belongs to a workspace. Queries filter by `workspaceId`.
3. **Dual auth paths**: Agent endpoints use session auth + RBAC. Visitor endpoints use session/ownership verification.
4. **Internal mutations for system actions**: Bot messages, scheduled campaigns, and AI responses use `internalMutation` to bypass external auth checks.
5. **Index-based lookups**: All high-traffic queries use Convex indexes to avoid table scans (e.g., `by_workspace`, `by_email`, `by_session`).
6. **Widget as separate Vite app**: The widget is built independently to keep bundle size small (<50KB gzipped) and embeddable on any website.
7. **SDK-core shared logic**: Common business logic (API client, event tracking) shared between React Native, iOS, and Android SDKs via `packages/sdk-core`.
8. **Signed visitor sessions**: All visitor-facing endpoints require a cryptographic session token (`wst_…`) validated via `resolveVisitorFromSession()`. Raw visitor IDs are never trusted alone.
9. **Readable visitor IDs are deterministically generated and persisted**: The backend stores `visitors.readableId` at creation time using deterministic formatting from canonical `visitorId`, and web UI uses this value when available (falling back to deterministic client derivation for legacy records). This enables direct admin/debug lookup in data tools while keeping labels consistent across surfaces. Because output depends on ordered word lists, treat those lists as append-only unless remapping historical labels is intentional.
