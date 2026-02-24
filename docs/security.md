# Platform Security

This document describes the security features available in Opencom, including RBAC (Role-Based Access Control), audit logging, and identity verification.

## Roles & Permissions

Opencom uses a granular permission system with predefined roles. Each role has a set of permissions that determine what actions members can perform.

### Available Roles

| Role       | Description                                                                               |
| ---------- | ----------------------------------------------------------------------------------------- |
| **Owner**  | Full access including billing and ownership transfer. Only one per workspace.             |
| **Admin**  | Can manage users, settings, and security but cannot access billing or transfer ownership. |
| **Agent**  | Day-to-day support work: conversations, articles, snippets.                               |
| **Viewer** | Read-only access to conversations, users, and articles.                                   |

### Permission Categories

- **Conversations**: `read`, `reply`, `assign`, `close`, `delete`
- **Users & Team**: `read`, `invite`, `manage`, `remove`
- **Content**: `articles.read/create/publish/delete`, `snippets.manage`, `tours.manage`
- **Settings**: `workspace`, `security`, `integrations`, `billing`
- **Data**: `export`, `delete`
- **Audit**: `read`

### Permission Checks

All mutations and sensitive queries check permissions before executing. The system is **fail-closed**: if a permission check fails, the action is denied.

```typescript
// Example: Check if user can manage team members
import { requirePermission } from "./permissions";

await requirePermission(ctx, userId, workspaceId, "users.manage");
```

## Identity Verification (HMAC)

Identity verification prevents users from impersonating others in the widget by requiring a server-generated hash.

### How It Works

1. **Enable** identity verification in Settings > Security
2. **Copy** the HMAC secret (shown once)
3. **Generate** a hash server-side when identifying users
4. **Pass** the hash to the widget

### Server-Side Integration

```javascript
// Node.js example
const crypto = require("crypto");

function generateUserHash(userId, secret) {
  return crypto.createHmac("sha256", secret).update(userId).digest("hex");
}

// When initializing the widget for a logged-in user
const userHash = generateUserHash(user.id, process.env.OPENCOM_HMAC_SECRET);
```

### Widget Integration

```javascript
Opencom.identify({
  userId: user.id,
  email: user.email,
  name: user.name,
  userHash: userHash, // HMAC hash from server
});
```

### Verification Modes

| Mode         | Behavior                                               |
| ------------ | ------------------------------------------------------ |
| **Optional** | Unverified users allowed but marked as unverified      |
| **Required** | Unverified users rejected (widget won't load for them) |

### Secret Rotation

You can rotate the HMAC secret at any time from Settings > Security. After rotation:

- Users with the old hash will fail verification
- Generate new hashes with the new secret
- Consider a grace period during deployment

## Audit Logs

Audit logs track security-relevant actions for compliance and debugging.

### Logged Events

- **Authentication**: login, logout, session creation
- **Team changes**: invites, role changes, removals, ownership transfers
- **Settings changes**: workspace, security, integrations
- **Data access**: conversation exports, bulk operations
- **Identity verification**: enabled, disabled, secret rotated

### Viewing Audit Logs

Admins and owners can view audit logs in the dashboard. Logs include:

- Timestamp
- Actor (user/system/API)
- Action performed
- Resource affected
- Additional metadata

### Retention

Configure retention period in Settings > Security:

- **30 days** - Minimal
- **90 days** - Recommended
- **365 days** - Extended compliance

Logs older than the retention period are automatically deleted.

### Log Export

Export logs for external analysis:

```typescript
// Query exports logs in JSON or CSV format
const result = await client.query(api.auditLogs.exportLogs, {
  workspaceId,
  startTime: Date.now() - 30 * 24 * 60 * 60 * 1000, // Last 30 days
  format: "csv", // or "json"
});
```

## Migration Guide

### Existing Workspaces

When upgrading to the new permission system:

1. **Run migration**: `npx convex run migrations/migrateRolesToPermissions:migrateWorkspaceRoles`
2. **First admin becomes owner**: The earliest admin in each workspace is promoted
3. **Permissions populated**: All members get permissions based on their role
4. **Verify**: `npx convex run migrations/migrateRolesToPermissions:verifyMigration`

### Breaking Changes

- The `role` field now includes `owner` and `viewer` options
- Permission checks replace hardcoded role checks
- `settings.billing` is owner-only (was admin)

## Webhook Security

Email webhook endpoints are secured using HMAC signature verification.

### Configuring Webhook Secrets

1. Set the `RESEND_WEBHOOK_SECRET` environment variable in your Convex deployment
2. Set `EMAIL_WEBHOOK_INTERNAL_SECRET` (recommended) to restrict webhook-only Convex handlers to trusted internal callers
3. Keep `ENFORCE_WEBHOOK_SIGNATURES=true` in production (default fail-closed behavior)
4. Optionally tune `WEBHOOK_MAX_AGE_SECONDS` (default `300`) to control replay-window tolerance
5. Configure the same secret in your Resend dashboard under Webhooks
6. All incoming webhook requests will be verified against this signature

### Signature Verification

The system verifies Resend's `svix-signature` header using HMAC-SHA256:

- Timestamp replay attacks are prevented by validating the signature includes the timestamp
- Constant-time comparison prevents timing attacks
- Invalid signatures return 401 Unauthorized

### Security-Critical Env Vars

| Variable                        | Purpose                                                   | Production Guidance                                                              |
| ------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `RESEND_WEBHOOK_SECRET`         | Verifies incoming Resend webhook signatures               | Required for email webhook processing                                            |
| `EMAIL_WEBHOOK_INTERNAL_SECRET` | Authorizes webhook-only Convex email handlers             | Strongly recommended; set a unique random secret                                 |
| `ENFORCE_WEBHOOK_SIGNATURES`    | Enables fail-closed webhook security checks               | Keep `true` in production                                                        |
| `WEBHOOK_MAX_AGE_SECONDS`       | Signature replay-window bound                             | Keep low (default `300`) unless your provider requires otherwise                 |
| `OPENCOM_PUBLIC_CORS_ORIGINS`   | Comma-separated allowlist for public discovery route CORS | Set explicit production origins; defaults to localhost/127.0.0.1 only when unset |
| `ALLOW_TEST_DATA`               | Enables test data seeding/cleanup mutations               | Never enable in production                                                       |
| `TEST_ADMIN_SECRET`             | Protects `testAdmin.runTestMutation` gateway              | Only set in dedicated test deployments                                           |

## CI Supply Chain Controls

GitHub Actions workflow dependencies are treated as supply-chain inputs:

- third-party actions should be pinned to immutable commit SHAs
- pin updates should include traceability notes to upstream release/source
- avoid relying on mutable major/minor action tags alone for production CI

## Authorization Model

All mutations and queries enforce authorization checks:

### Agent/Admin Endpoints

- Require authenticated session via `getAuthenticatedUserFromSession()`
- Check workspace membership and permissions via `requirePermission()`
- Return empty results or throw for unauthorized access

### Visitor Endpoints (Signed Sessions)

- All visitor-facing endpoints require a signed session token (`sessionToken`)
- `resolveVisitorFromSession()` validates the token, checks expiry, and confirms workspace match
- Raw `visitorId` alone is never accepted — the token cryptographically binds the caller to their visitor record
- Visitors can only access their own data (conversations, tickets, messages)
- Cross-visitor and cross-workspace access is blocked

### Conversation Authorization

Conversations use a dual-path authorization model:

- **Agent path**: Authenticated agents with workspace membership and `conversations.read` permission can access any conversation in their workspace
- **Visitor path**: Visitors must provide a valid `sessionToken` + `workspaceId`. The system resolves the visitor via `resolveVisitorFromSession()` and verifies resource ownership.
- **Unauthenticated callers**: Receive null/empty results

| Operation                  | Agent Requirement                 | Visitor Requirement                               |
| -------------------------- | --------------------------------- | ------------------------------------------------- |
| `get`                      | `conversations.read` permission   | Must own the conversation                         |
| `updateStatus`             | `conversations.close` permission  | Not allowed                                       |
| `assign`                   | `conversations.assign` permission | Not allowed                                       |
| `markAsRead`               | `conversations.read` permission   | `sessionToken` + must own the conversation        |
| `listByVisitor`            | N/A                               | `sessionToken` + `workspaceId`                    |
| `getTotalUnreadForVisitor` | N/A                               | `sessionToken` + `workspaceId`                    |
| `createForVisitor`         | N/A                               | `sessionToken` + visitor must belong to workspace |
| `getOrCreateForVisitor`    | N/A                               | `sessionToken` + visitor must belong to workspace |

### Ticket Authorization

| Operation       | Agent Requirement           | Visitor Requirement            |
| --------------- | --------------------------- | ------------------------------ |
| `create`        | `tickets.manage` permission | `sessionToken` + `workspaceId` |
| `listByVisitor` | N/A                         | `sessionToken` + `workspaceId` |
| `addComment`    | Workspace membership        | `sessionToken`                 |

### Message Authorization

| Operation        | Agent Requirement                        | Visitor Requirement                              |
| ---------------- | ---------------------------------------- | ------------------------------------------------ |
| `list`           | `conversations.read` permission          | `sessionToken` (optional, for visitor filtering) |
| `send` (agent)   | `conversations.reply` permission         | N/A                                              |
| `send` (visitor) | N/A                                      | `sessionToken`                                   |
| `send` (bot)     | Internal only (`internalSendBotMessage`) | N/A                                              |

### Bot Message Restriction

Messages with `senderType: "bot"` are restricted to internal system callers only. The external `messages.send` mutation rejects bot sends. Internal callers (schedulers, actions) use `internalSendBotMessage` instead.

### Workspace Data Protection

The `workspaces.get` query returns different data based on authentication:

- **Workspace members**: Full workspace data including configuration
- **Non-members / unauthenticated**: Only public fields (name, ID, creation time) — no secrets like `identitySecret`

The `workspaces.getOrCreateDefault` mutation requires authentication.

### Visitor Data Protection

- `visitors.get`: Returns visitor data only for authenticated agents with workspace membership. Unauthenticated callers receive null.
- `visitors.getBySession`: Returns visitor data for session-based lookups (session ID serves as proof of ownership) and authenticated agents.

### AI Settings Protection

`aiAgent.getSettings` requires workspace membership. Unauthenticated callers receive default (non-workspace-specific) settings.

### Protected Mutations

| Resource      | Mutations                                  | Required Permission                       |
| ------------- | ------------------------------------------ | ----------------------------------------- |
| Conversations | create                                     | `conversations.reply`                     |
| Conversations | list, listForInbox                         | `conversations.read`                      |
| Conversations | get                                        | `conversations.read` or visitor ownership |
| Conversations | updateStatus                               | `conversations.close`                     |
| Conversations | assign                                     | `conversations.assign`                    |
| Conversations | markAsRead                                 | `conversations.read` or visitor ownership |
| Messages      | send (agent)                               | `conversations.reply`                     |
| Messages      | send (bot)                                 | Internal only (`internalSendBotMessage`)  |
| Articles      | create, update                             | `articles.create`                         |
| Articles      | remove                                     | `articles.delete`                         |
| Tours         | create, update, remove                     | `tours.manage`                            |
| Checklists    | manage                                     | `checklists.manage`                       |
| Workspaces    | get (full)                                 | Workspace membership                      |
| Workspaces    | updateAllowedOrigins, updateSignupSettings | `settings.security`                       |
| AI Settings   | getSettings                                | Workspace membership                      |
| Visitors      | get                                        | Workspace membership                      |
| Test Data     | all mutations                              | `ALLOW_TEST_DATA` env var                 |

## Test Data Protection

All test data seeding and cleanup mutations in `testData.ts` are gated behind the `ALLOW_TEST_DATA` environment variable:

- When `ALLOW_TEST_DATA` is not set to `"true"`, all test data mutations throw immediately with "Test data mutations are disabled"
- This prevents attackers from seeding arbitrary data (tours, conversations, surveys, etc.) in production
- E2E test environments should set `ALLOW_TEST_DATA=true` in their Convex deployment
- **Never set `ALLOW_TEST_DATA=true` in production deployments**

## CORS Configuration

### Best Practices

1. **Configure allowed origins** for each workspace in Settings → Security
2. The system validates widget origins against the workspace's allowlist before serving data
3. **No wildcard fallback**: When no `Origin` header is present, the response does not include `Access-Control-Allow-Origin` (prevents unintended access)
4. All CORS responses include `Vary: Origin` for proper cache behavior
5. Invalid origins receive a 403 Forbidden response
6. Public discovery route (`/.well-known/opencom.json`) uses least-privilege CORS:
   - production origins are controlled by `OPENCOM_PUBLIC_CORS_ORIGINS`
   - when unset, only localhost/127.0.0.1 origins are allowed

### How It Works

```
Request with Origin → Check workspace allowlist → Match found? → Set ACAO to origin
                                                → No match?   → Return 403
Request without Origin → No ACAO header (safe for non-browser clients)
```

### Development Mode

When no allowed origins are configured for a workspace, all origins are allowed for development convenience. **Always configure allowed origins for production.**

## Auth Callback Performance

The authentication callback (`createOrUpdateUser` in `authConvex.ts`) uses index-based lookups for optimal performance:

- **User email lookup**: Uses `withIndex("by_email")` for O(1) user deduplication (avoids full table scan)
- **Invitation lookup**: Uses `withIndex("by_email")` for O(1) pending invitation resolution (avoids full table scan)

This ensures signup/login performance doesn't degrade as the user and invitation tables grow.

## Signed Session Tokens

All visitor-facing endpoints use signed session tokens for authentication. This replaces the previous model where raw `visitorId` was accepted.

### How It Works

1. Widget/SDK calls `widgetSessions:boot` with `workspaceId` and `sessionId`
2. Convex creates or retrieves the visitor, generates a cryptographic token (`wst_` + 64 hex chars = 256-bit entropy)
3. A `widgetSessions` record is created with the token, `visitorId`, `workspaceId`, and `expiresAt`
4. The client stores the token and includes it in every subsequent visitor-facing call
5. Each endpoint calls `resolveVisitorFromSession(ctx, { sessionToken, workspaceId })` which:
   - Validates the token exists in the `widgetSessions` table (indexed by `by_token`)
   - Confirms the token's `workspaceId` matches the request
   - Checks the token is not expired
   - Returns the resolved `visitorId` and `identityVerified` status

### Token Lifecycle

| Parameter             | Value                      |
| --------------------- | -------------------------- |
| **Default lifetime**  | 24 hours                   |
| **Minimum lifetime**  | 1 hour                     |
| **Maximum lifetime**  | 7 days                     |
| **Refresh threshold** | 25% remaining lifetime     |
| **Token format**      | `wst_` + 64 hex characters |

### Endpoints Requiring Session Token

All visitor-facing mutations and queries require `sessionToken`:

- `conversations.listByVisitor`, `conversations.getTotalUnreadForVisitor`
- `conversations.createForVisitor`, `conversations.getOrCreateForVisitor`
- `conversations.markAsRead` (visitor path)
- `messages.send` (visitor path), `messages.list` (visitor filtering)
- `tickets.create` (visitor path), `tickets.listByVisitor`, `tickets.addComment` (visitor path)
- `visitors.identify`

### SDK Integration

All SDKs thread the `sessionToken` through their API calls:

- **Widget** (`apps/widget`): Stores token in component state, passes to all Convex calls
- **React Native SDK**: `getVisitorState()` from `sdk-core` provides `sessionToken`; hooks pass it to queries/mutations
- **iOS SDK**: `SessionManager` stores token; `OpencomAPIClient` methods accept `sessionToken` parameter
- **Android SDK**: `SessionManager` stores token; `OpencomAPIClient` methods accept `sessionToken` parameter
- **sdk-core**: `markAsRead()` and `addTicketComment()` accept and forward `sessionToken`

## Future Security Roadmap

The following security enhancements are planned for future releases:

- **Rate limiting**: Throttle visitor-facing mutations (getOrCreate, send message) to prevent abuse
- **Content Security Policy**: CSP headers for the widget to prevent XSS
- **Certificate pinning**: SDK-level certificate pinning for iOS and Android SDKs (requires major version bump)
- **Legacy field cleanup**: Complete removal of deprecated `passwordHash` field from schema after migration

## API Reference

### Identity Verification Endpoints

| Endpoint                                    | Type     | Args                          | Description                                |
| ------------------------------------------- | -------- | ----------------------------- | ------------------------------------------ |
| `api.identityVerification.getSettings`      | Query    | `workspaceId`                 | Get current verification settings          |
| `api.identityVerification.getSecret`        | Query    | `workspaceId`                 | Get HMAC secret (owner/admin only)         |
| `api.identityVerification.enable`           | Mutation | `workspaceId`                 | Enable verification, returns secret        |
| `api.identityVerification.disable`          | Mutation | `workspaceId, confirmDisable` | Disable verification                       |
| `api.identityVerification.updateMode`       | Mutation | `workspaceId, mode`           | Set "optional" or "required"               |
| `api.identityVerification.rotateSecret`     | Mutation | `workspaceId`                 | Generate new secret                        |
| `api.identityVerification.isRequired`       | Query    | `workspaceId`                 | Check if verification is required (widget) |
| `api.identityVerification.getVisitorStatus` | Query    | `visitorId`                   | Get visitor's verification status          |

### Audit Log Endpoints

| Endpoint                       | Type     | Args                                                           | Description               |
| ------------------------------ | -------- | -------------------------------------------------------------- | ------------------------- |
| `api.auditLogs.list`           | Query    | `workspaceId, startTime?, endTime?, action?, actorId?, limit?` | Query logs with filters   |
| `api.auditLogs.getActions`     | Query    | `workspaceId`                                                  | Get distinct action types |
| `api.auditLogs.getSettings`    | Query    | `workspaceId`                                                  | Get retention settings    |
| `api.auditLogs.updateSettings` | Mutation | `workspaceId, retentionDays`                                   | Update retention period   |
| `api.auditLogs.exportLogs`     | Query    | `workspaceId, startTime?, endTime?, format?`                   | Export logs (JSON/CSV)    |

### Role Management Endpoints

| Endpoint                           | Type     | Args                      | Description                  |
| ---------------------------------- | -------- | ------------------------- | ---------------------------- |
| `api.workspaces.updateRole`        | Mutation | `membershipId, role`      | Change member role           |
| `api.workspaces.transferOwnership` | Mutation | `workspaceId, newOwnerId` | Transfer workspace ownership |
| `api.workspaces.removeMember`      | Mutation | `membershipId`            | Remove member from workspace |

### Permission Helpers (Internal)

```typescript
import { hasPermission, requirePermission } from "./permissions";

// Check permission (returns boolean)
const canManage = await hasPermission(ctx, userId, workspaceId, "users.manage");

// Require permission (throws if denied)
await requirePermission(ctx, userId, workspaceId, "settings.security");
```

### Available Permissions

```typescript
type Permission =
  | "conversations.read"
  | "conversations.reply"
  | "conversations.assign"
  | "conversations.close"
  | "conversations.delete"
  | "users.read"
  | "users.invite"
  | "users.manage"
  | "users.remove"
  | "articles.read"
  | "articles.create"
  | "articles.publish"
  | "articles.delete"
  | "snippets.manage"
  | "tours.manage"
  | "checklists.manage"
  | "settings.workspace"
  | "settings.security"
  | "settings.integrations"
  | "settings.billing"
  | "data.export"
  | "data.delete"
  | "audit.read";
```

## Security Best Practices

1. **Enable identity verification** for production workspaces
2. **Use "required" mode** once all users are verified
3. **Review audit logs** regularly for suspicious activity
4. **Limit admin access** - use agent/viewer roles when possible
5. **Rotate secrets** periodically and after team member departures
6. **Set appropriate retention** based on compliance requirements
7. **Configure webhook secrets** for email integration security
8. **Use typed validators** for user input to prevent data injection
