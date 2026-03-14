## Why

Opencom is a fully open-source Intercom alternative (AGPL-3.0). Users can self-host for free on their own Convex deployment, but we also offer a hosted service. Today, the hosted service has no billing, pricing, or usage enforcement — anyone who signs up gets unlimited access indefinitely. We need a billing system to make the hosted offering sustainable: covering infrastructure costs (Convex, Resend, AI providers, Vercel) while keeping pricing simple, transparent, and fair.

The pricing philosophy is **cost-reflective, not feature-gated**. Tiers exist because AI and bulk email cost real money, not to create artificial scarcity. Self-hosted users get every feature with no limits. Hosted users get simple pricing that covers the full product with generous fair-use limits, and pay-as-you-go beyond those limits to cover actual costs.

## What Changes

### Pricing Structure

Two paid tiers with a 7-day free trial (no credit card required):

**Starter — $15/mo (£15/mo)**

- Up to 3 seats (all workspace member roles count equally: owner/admin/agent/viewer)
- Full product access: inbox, help center, tickets, product tours, outbound messages, surveys, segments, reports, checklists, tooltips, carousels
- Up to 10,000 emails/mo (all emails count: OTP, conversation replies, campaigns, series)
- No AI agent
- No email campaigns or series (bulk outbound email sending)
- Fair-use Convex compute/storage (enforced via usage metering)

**Pro — $45/mo (£45/mo)**

- Up to 10 seats (all workspace member roles count equally), PAYG per seat beyond 10
- Everything in Starter
- AI agent enabled
- $20/mo in AI credits included (charged at provider rates, no markup via Vercel AI Gateway)
- Email campaigns and series enabled
- Up to 10,000 emails/mo included (all emails count)
- PAYG beyond included limits (AI credits, emails, and seats)

**Trial**

- 7-day free trial on Pro tier (full access)
- No credit card required to start
- At trial end: must choose a plan or workspace enters a restricted state (read-only, can export data, cannot send messages or use features)

**Currency**

- USD and GBP at nominal parity ($15 = £15, $45 = £45)
- Stripe handles currency at checkout; we configure separate GBP prices

**PAYG Overages (Pro tier only)**

- AI credits beyond $20 included: billed at actual provider token rates via Vercel AI Gateway's native Stripe metered billing integration (no manual reporting needed — AI Gateway emits meter events per request)
- Emails beyond 10,000/mo: billed per email at cost-plus rate, reported to Stripe as metered usage
- Seats beyond 10: billed per additional seat per month
- All overages billed at end of billing cycle
- Usage dashboard visible to workspace owner in billing settings
- Configurable hard caps per dimension: workspace owner can set a hard cap that disables the feature when the limit is hit (default: warnings only, PAYG continues)

### Architecture (Option A+)

The billing system spans two repositories to keep Stripe integration logic private while the open-source codebase remains fully functional for self-hosted users.

**Public repository (`opencom`) — what changes:**

- **Schema additions**: New `subscriptions` and `usageRecords` tables in Convex schema, following the existing modular pattern (separate table definition files in `packages/convex/convex/schema/` spread into `schema.ts`)
- **Feature gating module** (`convex/billing/gates.ts`): Queries that check subscription status and usage limits. Returns entitlements for the current workspace. Self-hosted (no subscription record) defaults to all features enabled, no limits.
- **Usage tracking hooks**: Increment usage counters when billable events occur (AI token consumption, all emails sent, workspace member added). These live in the public repo because the events happen in core product code.
- **Vercel AI Gateway Stripe billing**: AI cost metering to Stripe is handled natively by the Vercel AI Gateway. The AI agent currently uses `createOpenAI()` from `@ai-sdk/openai` in `lib/aiGateway.ts`, routing through `https://ai-gateway.vercel.sh/v1` when the `AI_GATEWAY_API_KEY` starts with `vck_`. When a workspace has an active paid subscription with a `stripeCustomerId`, the `createAIClient()` function must be extended to accept and pass `stripe-customer-id` and `stripe-restricted-access-key` HTTP headers, which the gateway uses to automatically emit per-request meter events for input/output tokens. This eliminates the need for manual AI usage reporting to Stripe.
- **Type definitions** (`convex/billing/types.ts`): Plan types, limit definitions, usage dimension enums, shared between public and private code.
- **Stubs** (`convex/billing/stubs.ts`): No-op implementations of Stripe-dependent functions. Used when billing is not enabled (self-hosted). The private overlay replaces these at deploy time.
- **Pricing page** (`apps/landing`): New `/pricing` route. Public — it's marketing content. Shows tiers, comparison, links to hosted signup and self-host docs.
- **Billing settings placeholder** (`apps/web`): Settings page shows a billing section only when billing is active. Placeholder stub when billing is disabled.
- **`isBillingEnabled()` utility**: Checks for presence of Stripe configuration (environment variable). All billing-related code paths check this first. Self-hosted deployments never trigger Stripe calls.

**Private repository (`opencom-billing`) — new repo:**

- **Stripe Checkout session creation**: Convex action that creates a Stripe Checkout session for plan selection after trial or for upgrades.
- **Stripe webhook handler**: Convex HTTP endpoint processing Stripe events (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`). Updates `subscriptions` table.
- **Stripe Customer Portal session**: Convex action to create a portal session for self-serve plan management (update payment method, view invoices, cancel).
- **Subscription lifecycle mutations**: Create, upgrade, downgrade, cancel subscription. Manage trial-to-paid conversion.
- **PAYG usage reporting**: Scheduled Convex action that aggregates `usageRecords` and reports metered email and seat overage usage to Stripe. AI overage is handled automatically by the Vercel AI Gateway.
- **Billing settings UI** (`web-overlay/`): Dashboard component showing current plan, usage meters, invoices, upgrade/downgrade controls, payment method management. Replaces the stub in the public repo at deploy time.

**Deployment (hosted only):**

A deploy script copies private overlay files into the public repo before Convex and Vercel deployment:

1. Copy `convex-overlay/billing/*` → `packages/convex/convex/billing/` (replaces stubs)
2. Copy `web-overlay/settings/billing/*` → `apps/web/src/app/settings/billing/` (replaces placeholder)
3. Deploy Convex and Vercel as normal

Self-hosted users deploy the public repo as-is. No overlay, no Stripe, everything unlimited.

### Subscription Data Model

**`subscriptions` table (new):**

```
workspaceId       Id<"workspaces">     indexed
stripeCustomerId  string (optional)     for self-hosted compatibility
stripeSubscriptionId  string (optional)
plan              "starter" | "pro"
status            "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "expired"
trialEndsAt       number (optional)     timestamp
currentPeriodStart  number              timestamp
currentPeriodEnd    number              timestamp
cancelAtPeriodEnd   boolean
seatLimit         number                3 for starter, 10 for pro
aiCreditLimitCents  number              0 for starter, 2000 for pro ($20)
emailLimit        number                10000 for both tiers
hardCaps          object (optional)     per-dimension hard cap overrides set by owner
currency          "usd" | "gbp"
createdAt         number
updatedAt         number
```

**`usageRecords` table (new):**

```
workspaceId       Id<"workspaces">     indexed
dimension         "ai_cost_cents" | "emails_sent" | "seats"
periodStart       number                billing period start timestamp
periodEnd         number                billing period end timestamp
value             number                cumulative usage in this period
lastUpdatedAt     number
```

Compound index on `[workspaceId, dimension, periodStart]` for efficient per-period lookups.

### Workspace Lifecycle Changes

**Signup flow (modified):**

1. User signs up (existing flow — `authConvex.ts` `createOrUpdateUser` callback)
2. Workspace created with user as `role: "admin"` (existing flow — note: not `owner`)
3. Workspace membership created (existing flow)
4. **NEW**: Subscription record created with `status: "trialing"`, `plan: "pro"`, `trialEndsAt: now + 7 days`
5. **NEW**: Usage records initialized for current period
6. User enters onboarding (existing flow)

**Trial expiry (new scheduled job):**

- Runs periodically (e.g., hourly)
- Finds subscriptions where `status === "trialing"` and `trialEndsAt < now`
- Transitions to `status: "expired"`
- Workspace enters restricted state (read-only, export allowed)

**Plan selection (new flow):**

- Owner visits billing settings → sees current plan / trial status
- Clicks "Choose plan" → redirected to Stripe Checkout
- On successful payment → webhook updates subscription to `status: "active"`
- Workspace fully operational

**Upgrade/downgrade:**

- Starter → Pro: immediate, prorated via Stripe
- Pro → Starter: at end of billing period, AI and campaign features disabled
- Via Stripe Customer Portal or in-app billing settings

**Cancellation:**

- Owner cancels via billing settings or Stripe portal
- `cancelAtPeriodEnd: true`, access continues until period end
- After period end: workspace enters restricted state

### Feature Gating Logic

The gating module exposes a single query pattern used throughout the app:

```
getEntitlements(workspaceId) → {
  plan: "starter" | "pro" | "unlimited"    // "unlimited" for self-hosted
  status: "active" | "trialing" | "expired" | "past_due" | ...
  features: {
    aiAgent: boolean
    emailCampaigns: boolean
    series: boolean
  }
  limits: {
    seats: { used: number, limit: number }
    aiCredits: { usedCents: number, limitCents: number, payg: boolean }
    emails: { sent: number, limit: number, payg: boolean }
  }
  canUseFeature: (feature) => boolean
  isOverLimit: (dimension) => boolean
}
```

**Self-hosted behavior**: No subscription record exists → returns `plan: "unlimited"`, all features enabled, no limits. Zero billing code executes.

**Gating enforcement points:**

- AI agent toggle: check `features.aiAgent`
- Email campaign creation: check `features.emailCampaigns`
- Series creation: check `features.series`
- Team member invitation (`workspaceMembers.ts` `createInvitation`): check `limits.seats` (all roles count equally)
- AI response generation: check/increment `limits.aiCredits`, check hard cap
- Any email send (OTP, conversation reply, campaign, series): check/increment `limits.emails`, check hard cap
- PAYG: if over included limit but no hard cap set, allow but track overage. If hard cap enabled, block at limit.

### Environment Variables (new, hosted only)

```
STRIPE_SECRET_KEY              Stripe API secret key
STRIPE_PUBLISHABLE_KEY         Stripe publishable key (for Checkout)
STRIPE_WEBHOOK_SECRET          Webhook endpoint signing secret
STRIPE_RESTRICTED_ACCESS_KEY   Stripe restricted key for AI Gateway meter events (rk_...)
STRIPE_STARTER_PRICE_USD       Stripe Price ID for Starter USD
STRIPE_STARTER_PRICE_GBP       Stripe Price ID for Starter GBP
STRIPE_PRO_PRICE_USD           Stripe Price ID for Pro USD
STRIPE_PRO_PRICE_GBP           Stripe Price ID for Pro GBP
STRIPE_EMAIL_METERED_PRICE     Stripe Price ID for email overage metered billing
STRIPE_SEAT_METERED_PRICE      Stripe Price ID for seat overage metered billing
```

### Stripe Product Configuration (in Stripe Dashboard, not code)

- **Product: Opencom Starter** — two prices ($15/mo USD, £15/mo GBP), recurring
- **Product: Opencom Pro** — two prices ($45/mo USD, £45/mo GBP), recurring, with 7-day trial
- **Billing Meter: `token-billing-tokens`** — Stripe billing meter for AI Gateway token metering (input/output tokens reported automatically by Vercel AI Gateway). Pro subscription includes $20/mo billing credit to offset included AI usage.
- **Product: Email Overage** — metered price, per-email, reported usage
- **Product: Seat Overage** — metered price, per-seat per month, reported usage (Pro only, beyond 10 seats)

## Capabilities

### New Capabilities

- `subscription-plans`: Plan definitions (starter, pro), trial lifecycle, workspace plan assignment on signup, trial expiry handling, plan transitions, restricted state for expired/unpaid workspaces. Includes the subscription and usage record data model.
- `feature-gating`: Plan-based entitlement checks throughout the app. Single `getEntitlements()` query pattern. Self-hosted defaults to unlimited. Enforcement at AI agent, email campaigns, series, seat limits.
- `usage-metering`: Per-workspace usage tracking across dimensions (AI token cost, all emails sent, seat count). Counter increment on billable events. Period-based aggregation. Usage display in billing settings. All emails (OTP, conversation replies, campaigns, series) count toward the email limit.
- `stripe-integration`: Stripe Checkout sessions, webhook event processing, Customer Portal sessions, subscription CRUD, email/seat PAYG metered usage reporting to Stripe, and Vercel AI Gateway Stripe billing integration for automatic AI token metering. Lives entirely in private `opencom-billing` repo. Replaces public stubs at deploy time.
- `billing-ui`: Billing settings section in dashboard (plan display, usage meters, upgrade/downgrade, payment method, invoices). Pricing page on landing site. Trial banners and upgrade prompts throughout the app.
- `payg-overages`: Pay-as-you-go billing beyond plan limits for Pro tier. AI credits billed at provider rates via AI Gateway, emails billed per-email, seats billed per-seat. Metered usage billed at end of billing cycle. Includes overage warning thresholds (80%, 100% of included limits) and configurable hard caps per dimension.

### Modified Capabilities

_None — no existing capability specs exist. However, the following areas of existing code require integration changes:_

- **Workspace creation** (`authConvex.ts`): Must create subscription record on signup
- **AI agent** (`aiAgentActions.ts`): Must check entitlement, track token usage for display, and pass Stripe customer ID headers to AI Gateway for automatic metered billing
- **Email campaigns** (`emailCampaigns.ts`): Must check entitlement and track send count (counts toward shared email limit)
- **Series** (`series.ts`): Must check entitlement and track send count
- **All email senders** (OTP in `authConvex.ts`, conversation replies in `emailChannel.ts`): Must track send count toward email limit
- **Team member invitations** (`workspaceInvitations`, settings page): Must enforce seat limit (all roles count equally)
- **Settings page** (`apps/web/settings`): Must include billing section
- **Landing app** (`apps/landing`): Must add pricing page
- **Permissions** (`permissions.ts`): `settings.billing` permission already exists but is currently owner-only. Since workspace creators get the `admin` role (not `owner`) in `authConvex.ts`, the permission must be expanded to include `admin` so the workspace creator can manage billing. Wire this to the billing settings UI.

## Impact

### Code Changes

**`packages/convex` (public):**

- New `schema/billingTables.ts`: Define `subscriptions` and `usageRecords` tables following the existing modular schema pattern (separate file spread into `schema.ts`) (~50 lines)
- `schema.ts`: Import and spread `billingTables` (~2 lines)
- New `convex/billing/` directory: `gates.ts`, `types.ts`, `stubs.ts` (~200-300 lines)
- `authConvex.ts`: Add subscription creation to `createOrUpdateUser` callback (~20 lines)
- `permissions.ts`: Expand `settings.billing` to include `admin` role (workspace creators get `admin`, not `owner`)
- `aiAgentActions.ts`: Add Stripe billing headers to `createAIClient()` / `generateText()` calls, add usage check/increment calls (~20 lines)
- Email campaign mutations: Add usage check/increment calls (~10 lines per file)
- Workspace invitation mutations: Add seat limit check (~10 lines)

**`apps/landing` (public):**

- New `/pricing` page with tier comparison, self-host callout, and hosted signup CTA

**`apps/web` (public):**

- Settings page: conditional billing section (stub when billing disabled)
- Trial banner component in app layout
- Upgrade prompts at gated feature entry points (e.g., AI settings, campaign creation)

**`opencom-billing` (new private repo):**

- `convex-overlay/billing/`: Stripe integration actions, webhook handler, subscription mutations, usage reporter (~500-800 lines)
- `web-overlay/settings/billing/`: Billing settings React components (~300-500 lines)
- Deploy scripts for overlay injection
- README with setup instructions

### Dependencies

- `stripe` npm package (Node.js, in Convex actions) — private repo only
- `@stripe/stripe-js` (browser, for Checkout redirect) — apps/web only, loaded dynamically when billing enabled
- No new public repo dependencies required

### Infrastructure

- Stripe account configuration (products, prices, webhook endpoint)
- Private GitHub repo (`opencom-billing`)
- CI/CD pipeline modification for hosted deployment (overlay step before deploy)
- New environment variables (10 Stripe-related vars) on hosted Convex and Vercel deployments
- Stripe billing meter `token-billing-tokens` for AI Gateway integration
- Stripe restricted access key (`rk_...`) with meter event write permissions for AI Gateway

### Risk Areas

- **Webhook reliability**: Stripe webhooks can be delayed or replayed. The webhook handler must be idempotent (use Stripe event IDs for deduplication).
- **Usage counter accuracy**: Convex mutations are transactional, but high-frequency AI usage could cause contention on usage records. May need batched/buffered counter updates.
- **Trial-to-paid conversion UX**: The transition from trial expiry to restricted state must be clear and not lose customer data. Restricted state must be fully read-only but preserve everything.
- **Currency handling**: Stripe handles currency natively, but the app must display the correct currency in billing settings based on what the customer chose at checkout.
- **Overlay mechanism**: The deploy-time file overlay is simple but brittle if directory structures diverge. Needs CI validation that overlay targets exist.
- **Self-hosted compatibility**: Every billing-related code path must gracefully handle the absence of subscription data. The `isBillingEnabled()` guard and `getEntitlements()` returning "unlimited" are the safety nets.
