## Context

Opencom is an AGPL-3.0 open-source Intercom alternative built as a PNPM monorepo. The backend is Convex (`packages/convex`), the dashboard is Next.js 15 (`apps/web`), and the marketing site is Next.js 15 (`apps/landing`). There are ~60+ Convex tables, a role-based permission system (owner/admin/agent/viewer), and Convex Auth for authentication (password + email OTP via Resend).

Today, workspace creation happens in the `createOrUpdateUser` auth callback (`authConvex.ts`). It inserts a workspace, a user (role: `admin`), and a workspace membership — with no billing awareness. The first user's role is `admin`, not `owner`. There is no subscription, usage tracking, feature gating, or payment infrastructure anywhere in the codebase. A `settings.billing` permission exists in `permissions.ts` but is currently owner-only and unwired — it must be expanded to include `admin` since workspace creators get the `admin` role. The schema uses a modular pattern: separate table files in `schema/` that are spread into `schema.ts`. There are no cron jobs — only `ctx.scheduler.runAfter()` for async work. The AI agent uses the Vercel AI Gateway via `@ai-sdk/openai` (routed through `ai-gateway.vercel.sh` when the API key starts with `vck_`).

The system must support two deployment modes: **hosted** (with billing, managed by us) and **self-hosted** (no billing, everything unlimited). The billing backend code must live in a private repository (`opencom-billing`) to prevent trivial cloning of the hosted business, while the public repository remains fully functional for self-hosted users.

## Goals / Non-Goals

**Goals:**

- Simple, transparent pricing with two tiers (Starter $15/mo, Pro $45/mo) and a 7-day free trial
- Subscription lifecycle management via Stripe (Checkout, Customer Portal, webhooks)
- Per-workspace usage metering for AI credits, outbound emails, and seat count
- Pay-as-you-go overages on the Pro tier for AI and email beyond included limits
- Feature gating that defaults to "unlimited" for self-hosted (zero billing code executes)
- Clean public/private split: public repo has gates, types, stubs, usage tracking hooks; private repo has Stripe integration, billing UI, subscription mutations
- Deploy-time overlay mechanism to inject private code for hosted deployment
- Currency support for USD and GBP at nominal parity

**Non-Goals:**

- Enterprise tier or custom pricing (future work)
- Per-seat pricing (flat tiers with seat caps instead)
- Annual billing (monthly only for now)
- Free tier for hosted (trial only, then must pay or self-host)
- Billing for self-hosted users (they pay Convex/providers directly)
- Multi-currency beyond USD/GBP
- Invoicing / purchase orders / tax compliance beyond what Stripe handles automatically
- Usage-based pricing for Convex compute/storage (rely on fair-use limits, revisit later)
- Mobile app billing (iOS/Android in-app purchases)

## Decisions

### D1: Subscription lives on the workspace, not the user

**Decision:** The `subscriptions` table has a `workspaceId` foreign key. One subscription per workspace. The workspace owner is responsible for billing.

**Rationale:** Opencom is a team product — a workspace is the billing unit. Users can belong to multiple workspaces (via `workspaceMembers`), each with its own subscription. This matches how Intercom, Crisp, and similar tools bill. It also avoids complexity around "which user's card pays for this shared workspace."

**Alternatives considered:**

- User-level subscription: Would require resolving which subscription covers which workspace. Adds complexity for multi-workspace users.
- Org-level billing entity: Over-engineered for two tiers. The workspace already serves as the org.

### D2: Stripe is the source of truth for billing state

**Decision:** Stripe webhooks are the canonical source for subscription status changes. The `subscriptions` table in Convex is a cache that mirrors Stripe state. On any discrepancy, Stripe wins.

**Rationale:** Stripe handles payment retries, dunning, proration, invoice generation, and tax calculation. Duplicating this logic is error-prone and unnecessary. The Convex table exists for fast, real-time entitlement checks without calling the Stripe API on every query.

**Implications:**

- The webhook handler must be idempotent (deduplicate by Stripe event ID)
- Subscription mutations in the private repo should always update Stripe first, then let the webhook update Convex
- A `stripeEventLog` deduplication mechanism prevents replayed webhooks from corrupting state

### D3: Feature gating via `getEntitlements()` query, not middleware

**Decision:** A single Convex query `billing.getEntitlements` returns the full entitlement object for a workspace. Callers check specific features/limits. Self-hosted returns a hardcoded "unlimited" response.

**Rationale:** Convex doesn't have middleware. The existing pattern is explicit permission checks via `requirePermission()` in `authWrappers.ts`. Entitlements follow the same pattern — an explicit check at each enforcement point. This is more transparent than implicit middleware and easier to test.

**Implementation pattern:**

```
// In a mutation/query handler (using shallow runner for TS2589 hotspots):
const runQuery = getShallowRunQuery(ctx);
const entitlements = await runQuery(GET_ENTITLEMENTS_REF, {
  workspaceId: args.workspaceId,
});
if (!entitlements.features.aiAgent) {
  throw new Error("AI agent requires a Pro plan");
}
```

Note: The codebase uses `makeFunctionReference` with shallow runner helpers (`getShallowRunQuery`, etc.) for cross-function calls due to TS2589 deep-instantiation issues. The `getEntitlements` ref should follow this pattern if it hits the TS2589 error.

**Permission model:** The `settings.billing` permission in `permissions.ts` must be expanded to include the `admin` role. Currently only `owner` has this permission, but workspace creators get `admin` (not `owner`). Without this change, the first user in a workspace cannot access billing settings.

**Self-hosted path:** `getEntitlements` checks for a subscription record. If none exists (self-hosted), it returns `{ plan: "unlimited", features: { all: true }, limits: { all: Infinity } }`. No Stripe code is imported or executed.

### D4: AI billing via Vercel AI Gateway; email/seat billing via manual reporting

**Decision:** AI cost metering to Stripe is handled natively by the Vercel AI Gateway. When making AI requests for a workspace with an active paid subscription, the AI agent actions pass `stripe-customer-id` and `stripe-restricted-access-key` HTTP headers to the AI Gateway. The gateway automatically emits per-request meter events to Stripe for input and output tokens. This is non-blocking, idempotent, and requires no manual aggregation or reporting.

Email and seat overages are tracked in the `usageRecords` table via atomic increments in Convex mutations. Email sending currently goes through `email.ts:sendEmail()` (using Resend) for transactional emails, `emailCampaigns.ts` for campaign sends, and `series/runtimeExecution.ts` for series email sends. OTP emails are sent directly via Resend in `authConvex.ts`. All of these paths need usage tracking hooks. A scheduled action periodically aggregates email/seat overage and reports it to Stripe's metered billing API.

**Rationale:** The Vercel AI Gateway's native Stripe billing integration (see https://vercel.com/docs/ai-gateway/ecosystem/stripe-billing) eliminates the most complex part of usage reporting: converting AI token counts to costs per model, aggregating them, and reporting to Stripe. The gateway handles all of this automatically per-request with a simple billing meter named `token-billing-tokens`. This means:

- No need to maintain a per-model price table
- No need for a scheduled AI usage reporter
- No risk of under/over-reporting AI usage
- The $20/mo included AI credits are handled via Stripe billing credits on the Pro subscription

Email and seat metering are simpler (integer counts, not model-dependent pricing) and don't have an equivalent gateway integration, so they use the manual approach.

**AI Gateway header pattern:**

The current AI client is created via `createAIClient()` in `lib/aiGateway.ts`, which uses `createOpenAI()` from `@ai-sdk/openai` with `AI_GATEWAY_API_KEY`. The function must be extended to accept optional Stripe headers:

```
// In lib/aiGateway.ts — extend createAIClient to accept billing headers:
export function createAIClient(options?: { stripeHeaders?: Record<string, string> }) {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) throw new Error("AI_GATEWAY_API_KEY environment variable is not set");

  const baseURL = process.env.AI_GATEWAY_BASE_URL ||
    (apiKey.startsWith("vck_") ? "https://ai-gateway.vercel.sh/v1" : "https://api.openai.com/v1");

  return createOpenAI({
    apiKey,
    baseURL,
    headers: options?.stripeHeaders,
  });
}

// In aiAgentActions.ts generateResponse handler:
const stripeHeaders: Record<string, string> = {};
if (isBillingEnabled() && subscription?.stripeCustomerId) {
  stripeHeaders["stripe-customer-id"] = subscription.stripeCustomerId;
  stripeHeaders["stripe-restricted-access-key"] = process.env.STRIPE_RESTRICTED_ACCESS_KEY!;
}
const aiClient = createAIClient({ stripeHeaders: Object.keys(stripeHeaders).length > 0 ? stripeHeaders : undefined });

const result = await generateText({
  model: aiClient(model),
  system: systemPrompt,
  messages,
  // ...existing options
});
```

**Email/seat counter update pattern:**

```
// Atomic increment in a mutation:
const existing = await ctx.db.query("usageRecords")
  .withIndex("by_workspace_dimension_period", q =>
    q.eq("workspaceId", workspaceId)
     .eq("dimension", "emails_sent")
     .eq("periodStart", currentPeriodStart)
  ).unique();

if (existing) {
  await ctx.db.patch(existing._id, {
    value: existing.value + incrementAmount,
    lastUpdatedAt: Date.now(),
  });
} else {
  await ctx.db.insert("usageRecords", {
    workspaceId, dimension: "emails_sent",
    periodStart: currentPeriodStart, periodEnd: currentPeriodEnd,
    value: incrementAmount, lastUpdatedAt: Date.now(),
  });
}
```

**AI cost display:** We still track `ai_cost_cents` in the `usageRecords` table for display purposes (showing the user their AI spend in the billing settings). This is calculated from `tokensUsed` after each AI response. It doesn't need to be perfectly precise — it's for the user's awareness, not for billing (the gateway handles billing).

**Contention risk:** Email counter contention is low (campaigns batch-send, not real-time). AI counter contention is moderate but only affects display accuracy, not billing. If contention appears, shard counters per-conversation and aggregate on read.

### D5: Trial created at signup, no Stripe customer until payment

**Decision:** When a workspace is created, a `subscriptions` record is inserted with `status: "trialing"`, `plan: "pro"`, and `trialEndsAt: now + 7 days`. No Stripe customer or subscription is created at this point. The Stripe customer is only created when the user chooses a plan and enters payment details via Stripe Checkout.

**Rationale:** Creating Stripe customers for every signup (including those who never convert) pollutes the Stripe dashboard and incurs unnecessary API calls. The trial is purely a Convex-side concept until the user pays.

**Implications:**

- `stripeCustomerId` and `stripeSubscriptionId` are optional fields on `subscriptions`
- The trial expiry check is a Convex scheduled function, not a Stripe webhook
- Trial-to-paid conversion creates the Stripe customer + subscription in a single Checkout flow

### D6: Private overlay via file copy at deploy time

**Decision:** The private `opencom-billing` repo contains files that are copied into specific locations in the public `opencom` repo before deployment. The public repo contains stubs at those locations that the overlay replaces.

**Rationale:** This is the simplest approach that provides meaningful friction against cloning while maintaining a single Convex deployment. Alternatives like git submodules, npm packages, or separate Convex deployments all add significant operational complexity (see proposal for analysis).

**Overlay structure:**

```
opencom-billing/
  convex-overlay/
    billing/
      stripe.ts           → packages/convex/convex/billing/stripe.ts (replaces stub)
      webhooks.ts         → packages/convex/convex/billing/webhooks.ts (replaces stub)
      subscriptions.ts    → packages/convex/convex/billing/subscriptions.ts (replaces stub)
      usageReporter.ts    → packages/convex/convex/billing/usageReporter.ts (replaces stub)
  web-overlay/
    billing/
      BillingSettings.tsx → apps/web/src/components/billing/BillingSettings.tsx (replaces stub)
  scripts/
    overlay.sh            Deploy script that copies files
    validate-overlay.sh   CI check that overlay targets exist in public repo
```

Note: The schema tables (`subscriptions`, `usageRecords`) live in the public repo in `packages/convex/convex/schema/billingTables.ts`, following the existing modular schema pattern (each domain has its own table file spread into `schema.ts`). The overlay does not replace schema files — only the billing logic files.

**Self-hosted experience:** Stubs export no-op functions with the same signatures. The app compiles and runs. All billing-dependent UI checks `isBillingEnabled()` (which reads `process.env.STRIPE_SECRET_KEY`) and renders nothing when disabled.

**Validation:** CI runs `validate-overlay.sh` to ensure every overlay target path exists in the public repo, catching breakage from renames or restructuring.

### D7: `isBillingEnabled()` as the master guard

**Decision:** A single utility function `isBillingEnabled()` checks `process.env.STRIPE_SECRET_KEY !== undefined`. All billing-related code paths (Convex functions and React components) check this first.

**Rationale:** A single source of truth for "is this a hosted deployment" prevents drift. The Stripe secret key is the most reliable indicator — if it's set, billing is configured.

**Convex side:**

```
// convex/billing/types.ts
export function isBillingEnabled(): boolean {
  return process.env.STRIPE_SECRET_KEY !== undefined;
}
```

**React side:**

```
// Check via a Convex query that exposes billing status
// (never expose STRIPE_SECRET_KEY to the client)
const billingStatus = useQuery(api.billing.gates.getBillingStatus);
```

### D8: Restricted state preserves data, blocks actions

**Decision:** When a subscription expires (trial ended, payment failed, canceled), the workspace enters a "restricted" state. All data is preserved and readable. Mutations that create/modify content are blocked. Data export remains available. Make sure visitors can still send messages, so no disruption to visitor flow, just no way for AI or human support to respond or interact etc.

**Rationale:** Locking users out of their data is hostile and may violate GDPR. The restricted state encourages payment while maintaining trust. Users can always self-host if they want to stop paying.

**Enforcement:** `getEntitlements()` returns `status: "expired"` or `status: "past_due"`. Mutations check status and throw a descriptive error. Queries continue to work. The dashboard shows a prominent banner with reactivation instructions.

### D9: Webhook handler registered in http.ts with stub pattern

**Decision:** The webhook route (`POST /api/stripe/webhook`) is registered in the public `http.ts` file, but the handler calls a function from `billing/webhooks.ts`. The public stub version of this function returns a 200 OK with no processing. The private overlay replaces it with actual Stripe event handling.

**Rationale:** Convex HTTP routes must be registered in `http.ts` — there's no way to dynamically add routes. The stub pattern means the route exists but does nothing in self-hosted mode. This is consistent with how the rest of the overlay works.

```
// In http.ts (public):
import { handleStripeWebhook } from "./billing/webhooks";

http.route({
  path: "/api/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    return await handleStripeWebhook(ctx, request);
  }),
});
```

### D10: Pricing page is public, billing settings UI is private

**Decision:** The `/pricing` page on the landing site (`apps/landing`) is fully public — it's marketing content. The billing settings section in the dashboard (`apps/web`) is private (overlay).

**Rationale:** The pricing page is visible to anyone who visits the site anyway. Making the source public is good for SEO, transparency, and reduces overlay complexity. The billing settings UI (plan management, usage meters, invoices) is operational and only relevant to hosted users.

### D11: Seat count enforcement — all roles count equally

**Decision:** Seat limits are enforced by counting all `workspaceMembers` regardless of role. All roles (owner, admin, agent, viewer) count toward the seat limit. The count is checked when inviting or adding a member.

**Rationale:** Simplicity. Having some roles count and others not creates confusion and edge cases (what happens when a viewer is promoted to agent and the workspace is at the limit?). All seats costing the same is easy to explain and easy to enforce. Pro gets 10 seats with PAYG beyond that.

**Enforcement point:** The `inviteUser` mutation and `acceptInvitation` mutation both check the current seat count against `entitlements.limits.seats.limit` before proceeding. If the workspace is at the limit and on Pro, the seat still goes through but is tracked as overage. If on Starter at the limit (3), the invitation is blocked.

### D12: Currency determined at checkout, stored on subscription

**Decision:** The user's currency is determined by which Stripe Checkout price they select (USD or GBP). The `currency` field on the `subscriptions` record stores this for display purposes. The pricing page shows both currencies.

**Rationale:** Stripe handles multi-currency natively. We don't need to detect locale or make assumptions. The user picks their currency when they first pay, and it stays consistent for their subscription lifecycle.

### D13: Configurable hard caps per dimension

**Decision:** Workspace owners can enable a hard cap for any metered dimension (AI credits, emails, seats). When a hard cap is enabled, the feature is disabled at the included limit instead of allowing PAYG overages. Default behavior: warnings at 80% and 100%, PAYG continues. Hard caps are stored as an optional `hardCaps` object on the `subscriptions` table.

**Rationale:** Prevents bill shock for cost-conscious users. Some users prefer predictable bills over uninterrupted service. Making it opt-in means most users get the seamless PAYG experience, while those who want budget controls can enable them.

**Implementation:** The `getEntitlements()` query checks both the usage limit and the hard cap setting. If `hardCaps.ai === true` and `ai_cost_cents >= aiCreditLimitCents`, the AI agent feature is reported as disabled in entitlements. The enforcement point then blocks the action.

### D14: AI Gateway billing only for paid subscriptions

**Decision:** Stripe billing headers (`stripe-customer-id`, `stripe-restricted-access-key`) are only passed to the AI Gateway when a workspace has an active paid subscription with a `stripeCustomerId`. During trial (no Stripe customer), headers are omitted and AI usage is tracked only in Convex for display.

**Rationale:** During the trial, there's no Stripe customer to bill. Creating a Stripe customer at signup would pollute the dashboard with non-converting users. The AI Gateway gracefully handles missing headers — it routes the request normally without emitting meter events.

**Implications:** Trial AI usage is not metered in Stripe (correct — trial is free). After payment, all AI usage is automatically metered. The transition is seamless — the only change is that the Stripe headers start being included once `stripeCustomerId` is populated.

## Risks / Trade-offs

**[Usage counter write contention]** → A single `usageRecords` row per workspace per dimension could become a bottleneck under heavy AI usage. **Mitigation:** Monitor in production. If contention appears, shard counters per-conversation or per-hour and aggregate on read.

**[Overlay file drift]** → If the public repo renames or restructures the billing directory, the overlay breaks silently. **Mitigation:** CI validation script (`validate-overlay.sh`) checks that all overlay target paths exist. Fail the hosted deploy if validation fails.

**[Trial abuse]** → Users could create new accounts repeatedly to get unlimited free trials. **Mitigation:** Track by email — if an email has had a trial before, don't grant another. For V1, this is acceptable risk given the 7-day window and manual signup friction.

**[Webhook replay / out-of-order delivery]** → Stripe webhooks can arrive out of order or be replayed. **Mitigation:** Deduplicate by Stripe event ID. For status transitions, compare `subscription.status` against expected state and use Stripe's `created` timestamp to resolve ordering conflicts.

**[Restricted state UX]** → If a workspace enters restricted state, active conversations with customers are frozen. **Mitigation:** Grace period of 3 days after trial expiry / payment failure before full restriction. Show increasingly urgent banners. Allow message reading but not sending during grace period.

**[Convex pricing changes]** → Our cost model assumes current Convex pricing. If Convex raises prices significantly, our margins shrink. **Mitigation:** Usage metering infrastructure is in place from day one, so we can adjust limits or add PAYG dimensions later without architectural changes.

**[PAYG bill shock]** → A Pro user could accidentally rack up large AI overage charges. **Mitigation:** Warning notifications at 80% and 100% of included limits. Configurable hard caps per dimension (D13) that disable the feature at the limit instead of allowing overages. Default is PAYG with warnings; hard cap is opt-in.

## Migration Plan

This is a greenfield addition — no existing billing data to migrate.

**Deployment sequence:**

1. **Schema deployment:** Add `subscriptions` and `usageRecords` tables to Convex schema. Deploy schema changes first (backward-compatible — new tables, no changes to existing tables).

2. **Public billing module:** Deploy `convex/billing/` directory with gates, types, and stubs. Deploy updated `http.ts` with the stub webhook route. All stubs return no-op / unlimited responses.

3. **Integration hooks:** Deploy usage tracking increments in AI agent actions, email campaign mutations, and seat checks in invitation mutations. These call `getEntitlements()` which returns unlimited in self-hosted mode — no behavioral change for existing deployments.

4. **Private repo setup:** Create `opencom-billing` repo with Stripe integration, overlay files, and deploy scripts.

5. **Stripe configuration:** Set up Stripe products, prices (USD + GBP), and webhook endpoint. Configure Customer Portal.

6. **Hosted deployment with overlay:** Run overlay script + deploy. Stubs replaced with real Stripe code. Billing is live.

7. **Existing hosted workspaces:** A one-time migration script creates `subscriptions` records for all existing workspaces with `status: "trialing"` and a 7-day trial. They are treated identically to new signups — no special grandfathering.

**Rollback:** Remove overlay files and redeploy. Public stubs take over, billing is disabled, all workspaces revert to unlimited access. No data loss (subscription records remain but are ignored).

## Resolved Questions

1. **Existing hosted workspaces:** Treated identically to new signups — migration script creates a `subscriptions` record with `status: "trialing"` and a 7-day trial. No grandfathering.

2. **Pro seat limit:** 10 seats included on Pro, PAYG per additional seat beyond 10. Starter has 3 seats, hard limit (no PAYG).

3. **AI cost tracking granularity:** Handled by Vercel AI Gateway's native Stripe billing integration. The gateway reports per-request token counts with model ID to Stripe's `token-billing-tokens` meter. Stripe prices per token. No manual cost-per-model table needed.

4. **Hard cap option:** Configurable per-dimension hard caps. Workspace owner can enable a hard cap for any metered dimension (AI, email, seats). When hard cap is on, the feature is disabled at the limit instead of allowing PAYG overages. Default: warnings only, PAYG continues. Stored in the `hardCaps` field on the `subscriptions` table.

5. **Email send counting:** All emails count toward the 10k/mo limit — OTP, conversation replies, campaigns, and series. This simplifies enforcement (single counter, single check point) and reflects actual Resend costs.

6. **All seats count equally:** No viewer exemption. All workspace member roles count toward the seat limit. Simplifies enforcement and avoids edge cases with role changes.

## Open Questions

How will we handle or avoid abuse, e.g. if someone used excessive AI on the free tier, perhaps using it for other purposes? Or signing up multiple times to get multiple free trials? consider these cases and ensuring honest users aren't penalised or restricted unfairly.
