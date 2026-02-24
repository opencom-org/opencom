# Architecture and Repository Map

This document maps Opencom's runtime architecture to concrete repository surfaces.

## System Topology

Opencom is a PNPM monorepo with four application surfaces, shared packages, and a serverless Convex backend:

```
End Users / Visitors
  │
  ├── Web Widget (Vite IIFE) ──────┐
  ├── iOS SDK (Swift) ─────────────┤
  ├── Android SDK (Kotlin) ────────┤
  └── React Native SDK (Expo) ─────┤
                                    │
                              Convex Backend
                           packages/convex
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
               Resend (Email)  ip-api (Geo)   AI Gateway
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
       Web Dashboard          Admin App           Landing Page
       (Next.js)              (Expo)              (Next.js)
       apps/web               apps/mobile         apps/landing
              │                     │
              └─────────────────────┘
                   Agents / Admins
```

## Repository Map

### Applications (`apps/*`)

| Surface          | Path           | Technology                       | Primary Users   | Responsibility                                                      |
| ---------------- | -------------- | -------------------------------- | --------------- | ------------------------------------------------------------------- |
| Web dashboard    | `apps/web`     | Next.js, React, Tailwind, Shadcn | agents/admins   | inbox, tickets, campaigns, knowledge, settings, reports, onboarding |
| Mobile admin app | `apps/mobile`  | React Native, Expo               | agents/admins   | mobile inbox, push notifications, workspace operations              |
| Widget runtime   | `apps/widget`  | Vite, React (IIFE bundle)        | visitors        | chat, tours, tooltips, surveys, outbound messages, checklists, CSAT |
| Landing site     | `apps/landing` | Next.js                          | public visitors | marketing, demo widget embed                                        |

### Packages (`packages/*`)

| Package          | Path                        | Role                                                                                        |
| ---------------- | --------------------------- | ------------------------------------------------------------------------------------------- |
| Convex backend   | `packages/convex`           | schema (50+ tables), queries, mutations, actions, HTTP routes, scheduled jobs, file storage |
| SDK core         | `packages/sdk-core`         | shared visitor/client logic: sessions, events, conversations, state management              |
| React Native SDK | `packages/react-native-sdk` | embeddable RN SDK with components, hooks, and example app                                   |
| UI kit           | `packages/ui`               | shared React components (Shadcn-based) and design tokens                                    |
| Shared types     | `packages/types`            | cross-app DTO and validation types                                                          |
| iOS SDK          | `packages/ios-sdk`          | native Swift SDK (SPM + CocoaPods distribution)                                             |
| Android SDK      | `packages/android-sdk`      | native Kotlin SDK (Gradle/Maven distribution)                                               |

### Supporting Directories

| Path                 | Purpose                                                       |
| -------------------- | ------------------------------------------------------------- |
| `scripts/`           | Build, deploy, security gate, seeding, and utility scripts    |
| `security/`          | CI gate configuration files (allowlists, budgets, registries) |
| `openspec/`          | Reserved structure for future specification workflows         |
| `docs/`              | Project documentation                                         |
| `.github/workflows/` | CI/CD pipeline definitions                                    |

## Integration Boundaries

| Boundary              | Inbound Surface                     | Trust Level           | Guard                                                         |
| --------------------- | ----------------------------------- | --------------------- | ------------------------------------------------------------- |
| Visitor runtime       | widget + mobile SDK calls to Convex | untrusted             | `resolveVisitorFromSession()` validates signed session tokens |
| Agent/admin runtime   | web/mobile app calls to Convex      | authenticated         | `getAuthenticatedUserFromSession()` + `requirePermission()`   |
| Provider webhooks     | `packages/convex/convex/http.ts`    | conditionally trusted | SVIX signature verification + internal-secret gate            |
| Public metadata route | `/.well-known/opencom.json`         | public                | CORS allowlist via `OPENCOM_PUBLIC_CORS_ORIGINS`              |
| Test mutations        | `testAdmin:runTestMutation` gateway | test-only             | `TEST_ADMIN_SECRET` + `ALLOW_TEST_DATA` env guards            |

## High-Value Code Navigation

### Authentication & Sessions

- **Auth callbacks and user creation**: `packages/convex/convex/authConvex.ts`
- **Web auth context**: `apps/web/src/contexts/AuthContext.tsx`
- **Mobile auth context**: `apps/mobile/src/contexts/AuthContext.tsx`
- **Widget session boot**: `packages/convex/convex/widgetSessions.ts`
- **Session token validation**: `resolveVisitorFromSession()` in `widgetSessions.ts`

### Backend Connection & Multi-Backend Support

- **Web backend context**: `apps/web/src/contexts/BackendContext.tsx`
- **Mobile backend context**: `apps/mobile/src/contexts/BackendContext.tsx`
- **Backend discovery endpoint**: `/.well-known/opencom.json` in `packages/convex/convex/http.ts`

### Authorization & Permissions

- **Permission definitions and checks**: `packages/convex/convex/permissions.ts`
- **Role hierarchy**: Owner > Admin > Agent > Viewer
- **Workspace membership**: `packages/convex/convex/workspaceMembers.ts`

### Conversation & Messaging

- **Conversation queries/mutations**: `packages/convex/convex/conversations.ts`
- **Message handling**: `packages/convex/convex/messages.ts`
- **AI agent responses**: `packages/convex/convex/aiAgent.ts` + `packages/convex/convex/aiAgentActions.ts`
- **Web inbox**: `apps/web/src/app/inbox/page.tsx`

### Visitor Engagement Layer

- **Widget entry point**: `apps/widget/src/Widget.tsx`
- **Tour overlay**: `apps/widget/src/TourOverlay.tsx`
- **Survey overlay**: `apps/widget/src/SurveyOverlay.tsx`
- **Outbound overlay**: `apps/widget/src/OutboundOverlay.tsx`
- **Tooltip overlay**: `apps/widget/src/TooltipOverlay.tsx`
- **Checklist overlay**: `apps/widget/src/ChecklistOverlay.tsx`
- **CSAT prompt**: `apps/widget/src/CsatPrompt.tsx`
- **Authoring mode**: `apps/widget/src/AuthoringOverlay.tsx`

### Email Channel

- **HTTP webhook processing**: `packages/convex/convex/http.ts`
- **Email channel logic**: `packages/convex/convex/emailChannel.ts`
- **Email config**: `packages/convex/convex/emailConfigs.ts` (not a file — inline in schema)

### Security & HTTP Boundary

- **HTTP routes and CORS**: `packages/convex/convex/http.ts`
- **Origin validation**: `packages/convex/convex/originValidation.ts`
- **Identity verification (HMAC)**: `packages/convex/convex/identityVerification.ts`
- **Audit logging**: `packages/convex/convex/auditLogs.ts`

### Campaign & Automation

- **Series orchestration**: `packages/convex/convex/series.ts`
- **Email campaigns**: `packages/convex/convex/emailCampaigns.ts`
- **Push campaigns**: `packages/convex/convex/pushCampaigns.ts`
- **Assignment rules**: `packages/convex/convex/assignmentRules.ts`
- **Auto-tag rules**: `packages/convex/convex/autoTagRules.ts`

### Reporting & Analytics

- **Report metrics**: `packages/convex/convex/reporting.ts`
- **Cached snapshots**: `reportSnapshots` table
- **Web reports**: `apps/web/src/app/reports/`

### Testing Infrastructure

- **Test helpers**: `packages/convex/convex/testing/helpers.ts`
- **Test admin gateway**: `packages/convex/convex/testAdmin.ts`
- **Test data mutations**: `packages/convex/convex/testData.ts`
- **E2E test helpers**: `apps/web/e2e/helpers/`
- **Playwright config**: `playwright.config.ts`
- **Vitest config**: `packages/convex/vitest.config.ts`

## Key Technical Decisions

1. **Convex as sole backend**: All data, auth, real-time subscriptions, file storage, and scheduled jobs run on Convex. No separate API server.
2. **Multi-tenant via workspaces**: Every record belongs to a workspace. All queries filter by `workspaceId` using indexes.
3. **Dual auth paths**: Agent endpoints use session auth + RBAC. Visitor endpoints use signed session tokens + ownership verification.
4. **Internal mutations for system actions**: Bot messages, scheduled campaigns, and AI responses use `internalMutation` to bypass external auth.
5. **Index-based lookups**: All high-traffic queries use Convex indexes to avoid table scans.
6. **Widget as separate Vite app**: IIFE bundle keeps size small (<50KB gzipped) and embeddable on any website.
7. **SDK-core shared logic**: Common business logic shared between React Native, iOS, and Android SDKs.
8. **Signed visitor sessions**: All visitor-facing endpoints require a cryptographic session token (`wst_…`) validated via `resolveVisitorFromSession()`.

## Deep-Dive Documentation

| Topic                     | Document                                             |
| ------------------------- | ---------------------------------------------------- |
| Full system architecture  | [`../architecture.md`](../architecture.md)           |
| Database schema reference | [`../data-model.md`](../data-model.md)               |
| Backend API reference     | [`../api-reference.md`](../api-reference.md)         |
| Widget SDK reference      | [`../widget-sdk.md`](../widget-sdk.md)               |
| Mobile SDK reference      | [`../mobile-sdks.md`](../mobile-sdks.md)             |
| Security deep dive        | [`../security.md`](../security.md)                   |
| Testing deep dive         | [`../testing.md`](../testing.md)                     |
| Scripts reference         | [`../scripts-reference.md`](../scripts-reference.md) |
| Feature audit             | [`../feature-audit.md`](../feature-audit.md)         |

## Related OSS Hub Docs

- Setup and deployment: [`./setup-self-host-and-deploy.md`](./setup-self-host-and-deploy.md)
- Testing and verification: [`./testing-and-verification.md`](./testing-and-verification.md)
- Security and operations: [`./security-and-operations.md`](./security-and-operations.md)
- Documentation ownership model: [`./source-of-truth.md`](./source-of-truth.md)
