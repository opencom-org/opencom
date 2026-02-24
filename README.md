# Opencom

Open-source customer messaging platform - an alternative to Intercom.

## Documentation

### Quick Links

| Document                                                                 | Description                                  |
| ------------------------------------------------------------------------ | -------------------------------------------- |
| [Contributing Guide](CONTRIBUTING.md)                                    | Development setup, code style, PR guidelines |
| [OSS Documentation Hub](docs/open-source/README.md)                      | Canonical hub for all documentation          |
| [Architecture & Repo Map](docs/open-source/architecture-and-repo-map.md) | System topology and code navigation          |
| [Setup & Deploy](docs/open-source/setup-self-host-and-deploy.md)         | Self-hosting and deployment paths            |

### Reference

| Document                             | Description                                                    |
| ------------------------------------ | -------------------------------------------------------------- |
| [Data Model](docs/data-model.md)     | Complete database schema reference (50+ tables)                |
| [Backend API](docs/api-reference.md) | Convex queries, mutations, and actions                         |
| [Widget SDK](docs/widget-sdk.md)     | Embeddable widget client-side API                              |
| [Mobile SDKs](docs/mobile-sdks.md)   | React Native, iOS (Swift), Android (Kotlin) SDK guides         |
| [Security](docs/security.md)         | RBAC, HMAC identity verification, audit logs, webhook security |
| [Testing](docs/testing.md)           | Unit, integration, E2E testing guide and CI pipeline           |
| [Scripts](docs/scripts-reference.md) | Build, deploy, security, and utility script reference          |

### Contributor Workflow

| Document                                                               | Description                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------- |
| [Testing & Verification](docs/open-source/testing-and-verification.md) | Verification workflows for contributors           |
| [Security & Operations](docs/open-source/security-and-operations.md)   | Security boundaries and operational readiness     |
| [Source-of-Truth Contract](docs/open-source/source-of-truth.md)        | Documentation ownership and update rules          |
| [Feature Audit](docs/feature-audit.md)                                 | Comprehensive feature inventory and test coverage |

## Features

- **Chat** - Real-time messaging with customers via embeddable widget and email channel
- **Product Tours** - Guide users through your product with WYSIWYG editor
- **Knowledge Base** - Self-service help center with collections and articles
- **Mobile Apps** - iOS and Android admin apps for on-the-go support with push notifications
- **Campaigns** - Targeted outbound messaging with audience rules and trigger conditions
- **Series** - Multi-step automated message sequences
- **Surveys** - In-app surveys (NPS, rating, text, multiple choice) with analytics
- **Tickets** - Issue tracking with priority, status, and agent assignment
- **Segments** - Dynamic visitor grouping by attributes and behavior
- **Reports** - Analytics dashboards for conversations, response times, and satisfaction
- **AI Agent** - Automated responses using knowledge base with confidence scoring and human handoff
- **Email Channel** - Send and receive emails as conversations via Resend integration
- **Tooltips** - Contextual UI hints attached to page elements
- **Outbound Messages** - Chat, post, and banner messages with trigger conditions
- **Checklists** - Onboarding task lists for visitors
- **Carousels** - Multi-screen promotional content for mobile SDKs
- **CSAT** - Customer satisfaction ratings on conversations
- **Identity Verification** - HMAC-based visitor identity verification
- **Native SDKs** - React Native, iOS (Swift), and Android (Kotlin) SDKs

## Tech Stack

- **Frontend**: React, Next.js, Tailwind CSS, Shadcn UI
- **Mobile**: React Native / Expo
- **Backend**: Convex (serverless)
- **Package Manager**: PNPM

## Project Structure

```
opencom/
├── apps/
│   ├── web/              # Next.js dashboard for agents/admins
│   ├── mobile/           # Expo app for iOS/Android (Admin App)
│   ├── widget/           # Embeddable chat widget for websites (Vite)
│   └── landing/          # Next.js marketing/landing page
├── packages/
│   ├── convex/           # Convex schema and functions (backend)
│   ├── types/            # Shared TypeScript types
│   ├── ui/               # Shared React components
│   ├── sdk-core/         # Shared SDK business logic
│   ├── react-native-sdk/ # React Native SDK for customer apps
│   ├── ios-sdk/          # Native iOS SDK (Swift, SPM + CocoaPods)
│   └── android-sdk/      # Native Android SDK (Kotlin)
└── openspec/             # Reserved structure for future spec workflows
```

## App Naming Convention

| App               | Purpose                                                   | Location                    | Users                      |
| ----------------- | --------------------------------------------------------- | --------------------------- | -------------------------- |
| **Admin App**     | Agent/teammate mobile app for responding to conversations | `apps/mobile`               | Support agents             |
| **Mobile SDK**    | Embeddable SDK for customer mobile apps                   | `packages/react-native-sdk` | End users of customer apps |
| **Web Widget**    | Embeddable widget for customer websites                   | `apps/widget`               | Website visitors           |
| **Web Dashboard** | Admin dashboard for managing workspace                    | `apps/web`                  | Admins and agents          |
| **Landing Page**  | Marketing website                                         | `apps/landing`              | Public visitors            |

## Getting Started

For the canonical setup paths (quickstart, self-host, env vars, deployment profiles), use:
[`docs/open-source/setup-self-host-and-deploy.md`](docs/open-source/setup-self-host-and-deploy.md)

### Quick Start (Self-Hosters)

The fastest way to get Opencom running locally:

```bash
# Clone the repository
git clone https://github.com/opencom-org/opencom.git
cd opencom

# Run the setup script
./scripts/setup.sh
```

The setup script will:

1. Check prerequisites (Node.js 18+, PNPM 9+)
2. Install dependencies
3. Create a Convex project and deploy
4. Prompt for your admin email and password
5. Create your workspace and admin account
6. Generate all `.env.local` files
7. Start the web dashboard and widget

**Prerequisites:**

- Node.js 18+
- PNPM 9+ (`npm install -g pnpm`)
- Convex account (free at [convex.dev](https://convex.dev))

**Non-interactive mode (for CI/scripts):**

```bash
./scripts/setup.sh --email admin@example.com --password yourpassword --non-interactive --skip-dev
```

**Update environment files:**

```bash
./scripts/update-env.sh --url https://your-project.convex.cloud --workspace your_workspace_id
```

### Manual Setup

If you prefer manual setup:

```bash
# Install dependencies
pnpm install

# Navigate to convex package
cd packages/convex

# Login to Convex
npx convex login

# Initialize and deploy
npx convex dev
```

Then create `.env.local` files manually (see Environment Variables Reference below).

## Development

```bash
# Start all apps
pnpm dev

# Start specific app
pnpm dev:web      # Next.js dashboard
pnpm dev:mobile   # Expo mobile app
pnpm dev:widget   # Widget dev server
pnpm dev:convex   # Convex backend

# Build all apps
pnpm build

# Lint
pnpm lint

# Format
pnpm format
```

## Deployment Options

Opencom supports multiple deployment configurations depending on your needs:

| Option | Backend     | Web App     | Mobile Apps | Best For                       |
| ------ | ----------- | ----------- | ----------- | ------------------------------ |
| **A**  | Hosted      | Hosted      | Hosted      | Quick start, no infrastructure |
| **B**  | Self-hosted | Hosted      | Hosted      | Data control with hosted apps  |
| **C**  | Self-hosted | Self-hosted | Hosted      | Full web control               |
| **D**  | Self-hosted | Self-hosted | Self-hosted | Complete self-hosting          |

### Option A: Fully Hosted (Recommended for Getting Started)

The simplest way to use Opencom:

1. Sign up at [app.opencom.dev](https://app.opencom.dev)
2. Create a workspace
3. Copy the widget snippet from Settings → Widget Installation
4. Add the snippet to your website

No infrastructure setup required. Your data is stored on the default Opencom Convex instance.

### Option B: Self-Hosted Backend with Hosted Apps

Control your data while using the hosted web and mobile apps.

**1. Create a Convex project:**

```bash
# Clone the repository
git clone https://github.com/opencom-org/opencom.git
cd opencom

# Install dependencies
pnpm install

# Navigate to convex package
cd packages/convex

# Login to Convex
npx convex login

# Create and deploy your project
npx convex dev --once
```

**2. Configure environment variables in Convex Dashboard:**

Go to your Convex dashboard → Settings → Environment Variables and set:

| Variable         | Required  | Description                                                              |
| ---------------- | --------- | ------------------------------------------------------------------------ |
| `AUTH_SECRET`    | Yes       | Random string for JWT signing (generate with `openssl rand -base64 32`)  |
| `RESEND_API_KEY` | For email | API key from [Resend](https://resend.com) for sending emails             |
| `EMAIL_FROM`     | For email | Email address to send from (e.g., `YourCompany<noreply@yourdomain.com>`) |

**3. Connect hosted apps to your backend:**

- **Web**: Go to [app.opencom.dev](https://app.opencom.dev), enter your Convex URL on the login page
- **Mobile**: Open the Opencom app, tap "Connect to Backend", enter your Convex URL

Your Convex URL looks like: `https://your-project-123.convex.cloud`

### Option C: Self-Hosted Backend + Web App

Full control over backend and web dashboard.

**1. Complete Option B steps first** (create and deploy Convex project)

**2. Deploy the web app:**

```bash
# From repository root
cd apps/web

# Create .env.local
cat > .env.local << EOF
NEXT_PUBLIC_OPENCOM_DEFAULT_BACKEND_URL=https://your-project-123.convex.cloud
EOF

# Build
pnpm build

# Deploy to Vercel
npx vercel --prod

# Or deploy to Netlify
npx netlify deploy --prod --dir=.next
```

**3. Configure your domain** (optional):

Set up a custom domain in your hosting provider (Vercel/Netlify) dashboard.

### Option D: Fully Self-Hosted (Including Mobile)

Complete self-hosting including mobile apps.

**1. Complete Options B and C steps first**

**2. Build mobile apps:**

```bash
# From repository root
cd apps/mobile

# Create .env.local
cat > .env.local << EOF
EXPO_PUBLIC_OPENCOM_DEFAULT_BACKEND_URL=https://your-project-123.convex.cloud
EOF

# Build for iOS (requires macOS and Xcode)
npx expo build:ios

# Build for Android
npx expo build:android
```

**3. Distribute apps:**

- Submit to App Store / Play Store for public distribution
- Use enterprise distribution for internal apps
- Use Expo's internal distribution for testing

> **Note**: App store submission and signing certificates are outside the scope of this guide.

---

## Widget Installation

After setting up your workspace, install the chat widget on your website.

### Basic Installation

Add this snippet before the closing `</body>` tag:

```html
<script src="https://cdn.opencom.dev/widget.js"></script>
<script>
  OpencomWidget.init({
    convexUrl: "YOUR_CONVEX_URL",
    workspaceId: "YOUR_WORKSPACE_ID",
  });
</script>
```

Find your exact snippet with pre-filled values in **Settings → Widget Installation** after logging into your workspace.

### Self-hosting the widget asset

If you prefer to serve the widget script from your own infrastructure instead of `cdn.opencom.dev`, keep using the local bundle path:

```bash
bash scripts/build-widget-for-tests.sh
```

This builds `apps/widget/dist/opencom-widget.iife.js` and copies it into:

- `apps/web/public/opencom-widget.iife.js`
- `apps/landing/public/opencom-widget.iife.js`

For your own hosted frontend, publish that file (or use `scripts/deploy-widget-cdn.sh` with your Cloudflare R2 bucket) and point your embed snippet or `NEXT_PUBLIC_WIDGET_URL` at your hosted script URL.

### Identifying Users

Link conversations to logged-in users:

```javascript
OpencomWidget.identify({
  email: "user@example.com",
  name: "John Doe",
  userId: "user_123",
  company: "Acme Inc",
  customAttributes: {
    plan: "pro",
    signupDate: "2024-01-15",
  },
});
```

### Tracking Events

Track custom events for analytics:

```javascript
OpencomWidget.trackEvent("feature_used", {
  featureName: "export",
});
```

### Configuration Options

| Option           | Type    | Default   | Description                    |
| ---------------- | ------- | --------- | ------------------------------ |
| `convexUrl`      | string  | required  | Your Convex deployment URL     |
| `workspaceId`    | string  | required  | Your workspace ID              |
| `trackPageViews` | boolean | false     | Automatically track page views |
| `user`           | object  | undefined | Pre-identify user on init      |

---

## Environment Variables Reference

### Convex Backend (packages/convex)

Set these in your Convex Dashboard → Settings → Environment Variables:

| Variable                                            | Required              | Description                                                                                                                         |
| --------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`                                       | Yes                   | Secret for JWT signing                                                                                                              |
| `AUTH_RESEND_KEY`                                   | For email             | Resend API key for OTP email sending                                                                                                |
| `RESEND_API_KEY`                                    | For email             | Resend API key for transactional/campaign emails                                                                                    |
| `EMAIL_FROM`                                        | For email             | Sender email address (e.g., `Opencom <noreply@yourdomain.com>`)                                                                     |
| `RESEND_WEBHOOK_SECRET`                             | For email             | Secret for verifying Resend webhook signatures                                                                                      |
| `EMAIL_WEBHOOK_INTERNAL_SECRET`                     | Recommended for email | Internal secret used to authorize webhook-only Convex email handlers                                                                |
| `ENFORCE_WEBHOOK_SIGNATURES`                        | Recommended (`true`)  | Enforce webhook signature/internal-secret checks; set to `"false"` only for local debugging                                         |
| `WEBHOOK_MAX_AGE_SECONDS`                           | Optional              | Max webhook signature age before rejection (replay window); defaults to `300`                                                       |
| `OPENCOM_DEMO_BLOCKED_EMAIL_CAMPAIGN_WORKSPACE_IDS` | Optional (demo)       | Comma-separated workspace IDs where outbound email campaign sends are blocked by policy; transactional auth emails continue to work |
| `ALLOW_TEST_DATA`                                   | For testing           | Set to `"true"` to enable test data seeding mutations                                                                               |
| `TEST_ADMIN_SECRET`                                 | For testing           | Shared secret for `testAdmin.runTestMutation` gateway in test deployments                                                           |

### Demo campaign guardrails (optional)

To prevent accidental marketing-email blasts in hosted/demo environments while keeping signup/sign-in verification emails operational, set:

```bash
OPENCOM_DEMO_BLOCKED_EMAIL_CAMPAIGN_WORKSPACE_IDS=workspace_id_1,workspace_id_2
```

- The guard is enforced in `emailCampaigns.send`.
- Leave this variable unset to allow campaign sends normally.
- Transactional auth email flows are not blocked by this guard.

### Web App (apps/web)

Set in `.env.local` or your hosting provider:

| Variable                                  | Required | Description                   |
| ----------------------------------------- | -------- | ----------------------------- |
| `NEXT_PUBLIC_OPENCOM_DEFAULT_BACKEND_URL` | No       | Pre-fill backend URL on login |

### Mobile App (apps/mobile)

Set in `.env.local` or EAS secrets:

| Variable                                  | Required | Description                   |
| ----------------------------------------- | -------- | ----------------------------- |
| `EXPO_PUBLIC_OPENCOM_DEFAULT_BACKEND_URL` | No       | Pre-fill backend URL on login |

### Widget (apps/widget)

For local development only:

| Variable            | Required | Description                 |
| ------------------- | -------- | --------------------------- |
| `VITE_CONVEX_URL`   | Dev only | Convex URL for dev server   |
| `VITE_WORKSPACE_ID` | Dev only | Workspace ID for dev server |

---

## Connecting to a Self-Hosted Backend

Opencom apps support connecting to any self-hosted Convex backend at runtime:

**Web App:**

- On the login page, enter your backend URL
- The app validates the connection before proceeding

**Mobile App:**

- On first launch, tap "Connect to Backend"
- Enter your Convex deployment URL
- Recent backends are saved for quick switching

**Backend URL Format:**

- Use your Convex deployment URL: `https://your-project-123.convex.cloud`
- HTTPS is required for security
- The app validates the backend by fetching `/.well-known/opencom.json`

---

## Workspace Settings

### Signup Settings

Workspace admins can configure signup restrictions:

- **Invite Only** (default): Users must be invited to join
- **Domain Allowlist**: Users with emails from specified domains can self-signup

### Authentication Methods

Configure which login methods are available:

- **Password**: Traditional email/password login
- **Email Code (OTP)**: Passwordless magic link authentication

## Testing

### Test Environment Setup

Opencom uses a dedicated Convex test deployment to avoid polluting development or production data.

**Setting up the test deployment:**

```bash
# Navigate to convex package
cd packages/convex

# Create and deploy to test project (first time only)
npx convex dev --project opencom-test --once

# Create a local test env file from template
cp .env.test.example .env.test

# Update CONVEX_URL in packages/convex/.env.test
```

**Running tests:**

```bash
# Run all tests
pnpm test

# Run unit tests only (Vitest)
pnpm test:unit

# Run E2E tests only (Playwright)
pnpm test:e2e

# Run tests with coverage
pnpm test:ci
```

See `docs/testing.md` for detailed testing guidelines.

For the canonical OSS verification flow (targeted checks + CI-equivalent path), use:
`docs/open-source/testing-and-verification.md`.

---

## Open-Source Release Operations

Security and release operations guidance is centralized in:
`docs/open-source/security-and-operations.md`.

---

## React Native SDK Example

After running the setup script, the React Native SDK example is ready to use:

```bash
cd packages/react-native-sdk/example
pnpm start
```

This will start Expo and allow you to run the example app on:

- iOS Simulator (press `i`)
- Android Emulator (press `a`)
- Physical device via Expo Go

The example app demonstrates all SDK features including chat, user identification, and push notifications.

---

## Security Considerations for Self-Hosters

When self-hosting Opencom, consider these security best practices:

### Environment Variables

- **Never commit secrets** - All `.env.local` files are gitignored
- **Rotate secrets periodically** - Especially after team member departures
- **Use strong API keys** - Generate secure random keys for production

### Required Security Configuration

| Variable                        | Purpose                                                                         | Where to Set                             |
| ------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| `RESEND_WEBHOOK_SECRET`         | Verify email webhook signatures                                                 | Convex Dashboard                         |
| `EMAIL_WEBHOOK_INTERNAL_SECRET` | Restrict webhook-only email handlers to trusted internal callers                | Convex Dashboard                         |
| `ENFORCE_WEBHOOK_SIGNATURES`    | Fail closed on webhook signature/internal-secret validation (`true` by default) | Convex Dashboard                         |
| `WEBHOOK_MAX_AGE_SECONDS`       | Replay-window bound for webhook signatures (default: 300s)                      | Convex Dashboard                         |
| `AUTH_SECRET`                   | Sign authentication/session tokens                                              | Convex Dashboard                         |
| `CONVEX_SITE_URL`               | Auth callback domain used by Convex Auth provider                               | Convex Dashboard                         |
| `ALLOW_TEST_DATA`               | Enable/disable test data mutations                                              | Convex Dashboard                         |
| `TEST_ADMIN_SECRET`             | Secure test admin gateway for internal test mutations                           | Convex Dashboard (test deployments only) |

### Authorization Model

All mutations enforce authentication and permission checks:

- **Workspace isolation** - Users can only access their workspace's data
- **Role-based permissions** - Owner > Admin > Agent > Viewer
- **Signed visitor sessions** - All visitor-facing endpoints require a cryptographic session token (`wst_…`) validated via `resolveVisitorFromSession()`; raw visitor IDs are never trusted alone
- **Conversation authorization** - Dual-path: authenticated agents with permission OR visitors with valid session token who own the conversation
- **Bot message restriction** - Bot/system messages restricted to internal callers only
- **Test data protection** - All test data mutations gated behind `ALLOW_TEST_DATA` environment variable
- **CORS hardening** - No wildcard `Access-Control-Allow-Origin`; workspace-level origin allowlists

### Identity Verification (Production)

For production deployments, enable HMAC identity verification:

1. Go to Settings → Security in your dashboard
2. Enable identity verification and copy the secret
3. Generate user hashes server-side when identifying users
4. Pass the hash to the widget to prevent impersonation

### CORS Configuration

- Configure allowed origins in Settings → Security for each workspace
- The system validates widget origins against the workspace's allowlist
- Requests without an `Origin` header do not receive CORS headers (no wildcard fallback)
- All CORS responses include `Vary: Origin` for proper caching

See [docs/security.md](docs/security.md) for detailed security documentation.

---

## Error Codes Reference

Opencom uses standardized error codes for consistent error handling across all API endpoints:

### Authentication Errors

| Code                  | Message                   | Description                              |
| --------------------- | ------------------------- | ---------------------------------------- |
| `NOT_AUTHENTICATED`   | Authentication required   | User is not logged in                    |
| `SESSION_EXPIRED`     | Session has expired       | JWT token has expired, re-login required |
| `INVALID_CREDENTIALS` | Invalid email or password | Login failed due to wrong credentials    |

### Authorization Errors

| Code                   | Message                               | Description                                           |
| ---------------------- | ------------------------------------- | ----------------------------------------------------- |
| `NOT_AUTHORIZED`       | Not authorized to perform this action | User lacks required permissions                       |
| `PERMISSION_DENIED`    | Permission denied                     | Specific permission check failed                      |
| `NOT_WORKSPACE_MEMBER` | Not a member of this workspace        | User tried to access a workspace they don't belong to |

### Resource Errors

| Code             | Message                                | Description                      |
| ---------------- | -------------------------------------- | -------------------------------- |
| `NOT_FOUND`      | Resource not found                     | Requested entity doesn't exist   |
| `ALREADY_EXISTS` | Resource already exists                | Attempted to create a duplicate  |
| `CONFLICT`       | Operation conflicts with existing data | Concurrent modification conflict |

### Validation Errors

| Code                     | Message                   | Description                                |
| ------------------------ | ------------------------- | ------------------------------------------ |
| `INVALID_INPUT`          | Invalid input provided    | Request data failed validation             |
| `MISSING_REQUIRED_FIELD` | Required field is missing | A required field was not provided          |
| `INVALID_FORMAT`         | Invalid format            | Data format doesn't match expected pattern |

### Rate Limiting

| Code           | Message           | Description                        |
| -------------- | ----------------- | ---------------------------------- |
| `RATE_LIMITED` | Too many requests | Request was throttled, retry later |

### Handling Errors in Your Code

```javascript
try {
  await client.mutation(api.conversations.create, { ... });
} catch (error) {
  if (error.name === 'NOT_AUTHENTICATED') {
    // Redirect to login
  } else if (error.name === 'PERMISSION_DENIED') {
    // Show permission error UI
  } else if (error.name === 'NOT_FOUND') {
    // Show 404 page
  } else {
    // Generic error handling
  }
}
```

---

## Troubleshooting

### Setup Script Issues

**"Could not determine Convex deployment URL"**

- Ensure you're logged into Convex: `npx convex whoami`
- Try running `npx convex dev --once` manually in `packages/convex/`

**"npx convex login" hangs or fails**

- Check your internet connection
- Try `npx convex logout` then `npx convex login` again

**Permission denied running setup.sh**

- Run `chmod +x scripts/setup.sh` to make it executable

### Development Issues

**"CONVEX_URL is not set"**

- Run `./scripts/update-env.sh` to regenerate environment files
- Or manually create `.env.local` files (see Environment Variables Reference)

**Widget not connecting**

- Verify `VITE_WORKSPACE_ID` in `apps/widget/.env.local` matches your workspace
- Check browser console for CORS errors - add your origin in workspace settings

**OTP emails not sending**

- OTP requires `RESEND_API_KEY` in Convex environment variables
- Use password authentication for initial setup (works without Resend)

### Windows Users

The setup script requires Bash. Options:

- Use WSL (Windows Subsystem for Linux)
- Use Git Bash
- Follow the Manual Setup instructions instead

## License

GNU Affero General Public License v3.0 (AGPL-3.0). See [LICENSE](LICENSE).

All contributions are subject to the [Contributor License Agreement](CLA.md).
