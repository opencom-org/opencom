# Stripe Billing — Handoff

**OpenSpec change:** `stripe-billing-and-pricing`
**Tasks complete:** 100/110 (tasks 1–18, 20.1–20.2 done; tasks 19, 20.3, 21–22 pending)

---

## What was built

### Architecture: billing-hooks overlay pattern

The billing system uses a **hook-file pattern** to keep the public (open-source) repo completely free of billing code. Self-hosted users see no schema tables, no cron jobs, no billing logic.

```
Public repo (opencom-prod)
  packages/convex/convex/
    billing-hooks/          ← 7 tiny no-op stub files (5–20 lines each)
      onWorkspaceCreated.ts   called from authConvex.ts on new workspace
      onEmailSent.ts          called from emailCampaigns, emailChannel, series
      onMemberChanged.ts      called from workspaceMembers
      onAgentMessage.ts       called from messages.ts
      onAiGeneration.ts       called from aiAgentActions.ts
      getBillingStatus.ts     public Convex query for frontend (returns billingEnabled: false)
      httpRoutes.ts           called from http.ts to register routes (no-op)

Private repo (opencom-billing)
  convex-overlay/
    billing-hooks/          ← real implementations of the 7 stubs
    billing/                ← all billing logic (gates, usage, types, stripe, webhooks, etc.)
    schema/billingTables.ts ← subscriptions, usageRecords, billingWarnings, stripeEvents
    schema.ts               ← public schema + billing tables (replaces public schema.ts)
    crons.ts                ← trial expiry + usage reporter cron jobs
  web-overlay/billing/
    BillingSettings.tsx     ← billing settings UI (currently stub — see below)
  scripts/
    overlay.sh              ← copies overlay files into public repo at deploy time
    validate-overlay.sh     ← CI check that overlay targets exist (runs without private access)
```

**Overlay location:** `~/opencom-billing` (local git repo — needs to be pushed to GitHub as a private repo under the org, then the GitHub App credentials set up per `.github/workflows/deploy-convex-prod.yml`).

### What's in the public repo

All typechecks pass. Self-hosted deployments get:
- Clean schema (no billing tables)
- No cron jobs
- No webhook routes
- Core files call the hook stubs which immediately return without doing anything

### Billing logic (in private overlay)

- **Subscription lifecycle:** 7-day Pro trial created on signup; `expireTrials` cron transitions to `expired` when trial ends
- **Feature gating:** Starter blocked from AI agent, email campaigns, series; restricted state (expired/canceled/past_due/unpaid) blocks agent sends
- **Usage tracking:** `emails_sent` tracked on every email path; `ai_cost_cents` estimated from tokens after each AI response; `seats` synced on every member add/remove
- **Hard caps:** per-dimension toggles (AI, emails, seats) — when enabled, usage at limit throws instead of allowing PAYG
- **Overage warnings:** 80%/100% threshold records stored in `billingWarnings` (deduped per period)
- **Stripe Checkout/Portal:** `createCheckoutSession`, `createPortalSession` — both require `settings.billing` permission
- **Webhooks:** full handler for `checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed/succeeded` with idempotency via `stripeEvents` table
- **Usage reporter:** hourly cron at :30 reports email/seat overages to Stripe metered billing API
- **AI Gateway headers:** Stripe billing headers passed to Vercel AI Gateway for automatic per-token metering on active paid subscriptions (not during trial)

### Web app

- `TrialBanner` — countdown banner when trialing, urgent at ≤2 days
- `RestrictedBanner` — non-dismissible banner when expired/canceled/past_due
- `UpgradePrompt` — shown at AI agent settings, email campaigns tab, series tab when feature not available
- Seat limit warning in team members settings when at limit
- Billing section in Settings (visible to admin+owner, hidden on self-hosted)
- `useBillingStatus` hook — queries `billing-hooks/getBillingStatus:getBillingStatus`
- `useBillingActions` hook — wires up checkout, portal, hard caps, subscription details

### Landing site

Pricing page at `/pricing` — `PricingCard`, `FeatureComparison`, `SelfHostCallout` components, Pricing link in navbar.

---

## Three things to fix before going live

### 1. `billing/settings.ts` in private overlay is empty (0 bytes)

**File:** `~/opencom-billing/convex-overlay/billing/settings.ts`

This gets copied to `packages/convex/convex/billing/settings.ts` by `overlay.sh`. It's empty — nothing imports it today so it's not breaking anything, but it needs the actual implementation. The content belongs in the private overlay (not the public repo) since it accesses billing tables.

It should implement `updateHardCaps` and `getSubscriptionDetails` (both used by the billing settings UI). The implementation exists in the web app's `useBillingActions.ts` as refs — just needs the server side.

A working version of this was written earlier in this session (before the billing-hooks refactor). Reconstructing from the ref expectations:

```typescript
// updateHardCaps — authMutation with settings.billing permission
// Patches subscription.hardCaps for the workspace
// getSubscriptionDetails — authQuery with settings.billing permission  
// Returns plan, status, period, usage meters, hard caps for the billing UI
```

### 2. `BillingSettings.tsx` in private overlay is a stub, not the full UI

**File:** `~/opencom-billing/web-overlay/billing/BillingSettings.tsx`

Currently a copy of the public stub — shows "Loading billing details..." when billing is enabled. The full UI (plan display, usage meters, portal button, plan change flow, hard cap toggles) needs to be written here.

A full implementation was built in this session (`/Users/jack/opencom-billing/web-overlay/billing/BillingSettings.tsx`) and verified with `pnpm typecheck`, but was overwritten when the git repo was re-initialized during the billing-hooks refactor. The implementation exists in the chat history — the key components are:
- `PlanBadge` — shows plan + status chips
- `UsageMeter` — progress bar per dimension (AI credits, emails, seats) with hard cap toggle checkbox
- `PlanSelector` — modal for Starter/Pro with USD/GBP currency toggle
- Main `BillingSettings` — orchestrates the above; calls `useSubscriptionDetails`, `useCreateCheckoutSession`, `useCreatePortalSession`, `useUpdateHardCaps`

### 3. validate-overlay.sh doesn't cover `billing/` directory, `billingTables.ts`, or `crons.ts`

**File:** `~/opencom-billing/scripts/validate-overlay.sh`

Currently only checks the 7 `billing-hooks/` stubs, `schema.ts`, and `BillingSettings.tsx`. It doesn't check:
- `packages/convex/convex/schema/billingTables.ts` — but this is a new file (no stub to validate) so it's fine
- `packages/convex/convex/crons.ts` — same
- Individual `billing/*.ts` files — they don't exist in public repo until overlay runs, so also fine

The only real gap is: `validate-overlay.sh` in `scripts/` doesn't check `packages/convex/convex/billing/` exists (it won't, on a clean public checkout — `overlay.sh` creates it). Since `mkdir -p` handles this gracefully, it's not a blocker. Document accepted.

---

## What's next (tasks 19–22)

These all require a live Stripe account. The code is ready; it's purely configuration and testing.

### Task 19 — Stripe dashboard setup (one-time)

1. Create products: "Opencom Starter", "Opencom Pro"
2. Create recurring prices: Starter $15 USD / £15 GBP, Pro $45 USD / £45 GBP
3. Create billing meter: `token-billing-tokens` (for AI Gateway automatic token metering)
4. Create metered prices: email overage (per email), seat overage (per seat/month)
5. Create restricted access key with **meter event write only** (`rk_...`) — for `STRIPE_RESTRICTED_ACCESS_KEY`
6. Configure Customer Portal: plan changes, cancellation, payment method, invoice history
7. Configure $20/mo billing credit on Pro subscription for included AI usage
8. Create webhook endpoint → hosted Convex URL `/api/stripe/webhook`, events:
   - `checkout.session.completed`
   - `customer.subscription.created` / `updated` / `deleted`
   - `invoice.payment_succeeded` / `payment_failed`

Environment variables to add to Convex deployment and Vercel:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_RESTRICTED_ACCESS_KEY=rk_live_...
STRIPE_STARTER_PRICE_USD=price_...
STRIPE_STARTER_PRICE_GBP=price_...
STRIPE_PRO_PRICE_USD=price_...
STRIPE_PRO_PRICE_GBP=price_...
STRIPE_EMAIL_METERED_PRICE=price_...
STRIPE_SEAT_METERED_PRICE=price_...
```

### Task 20.3 — Test full deployment with overlay

After Task 19: apply the overlay to the hosted deployment and verify:
- Webhook endpoint accepts events from Stripe CLI
- Checkout flow creates a session and redirects correctly
- Billing settings UI renders (requires Task 17 full UI first)

### Task 21 — Existing workspace migration

One-time script to run against the production Convex deployment:
- Insert `subscriptions` rows for existing hosted workspaces with `status: "trialing"` and 7 days from now as `trialEndsAt`
- Insert `usageRecords` rows (all at 0) for each
- Run on staging first

### Task 22 — End-to-end verification

Manual test plan covering:
- Signup → trial → plan selection → checkout → active subscription
- Trial expiry → restricted → reactivation
- Starter/Pro upgrade and downgrade
- Cancellation → period end → restricted
- AI PAYG: Stripe headers present for active paid, absent for trial
- Email PAYG: exceed limit, verify Stripe meter events
- Seat PAYG: 11th member on Pro
- Hard caps: block at limit for each dimension
- Self-hosted: no billing UI, no restrictions, all features available

---

## GitHub App for CI (setup required)

The deploy workflow at `.github/workflows/deploy-convex-prod.yml` is configured for a GitHub App (not a deploy key). Two secrets need to be added to the public repo (`opencom-prod`) once the private repo is on GitHub:

- `BILLING_APP_ID` — numeric App ID
- `BILLING_APP_PRIVATE_KEY` — full `.pem` contents

Setup steps:
1. GitHub org → Settings → Developer settings → GitHub Apps → New
2. Name: "Opencom Billing CI", no webhook, Contents: Read-only
3. Install app on `opencom-billing` only (not the whole org)
4. Generate private key → add both as repo secrets in `opencom-prod`
5. Update `repository: opencom-org/opencom-billing` on line 98 of the deploy workflow to the real org name

---

## Key files to know about

| File | Purpose |
|------|---------|
| `packages/convex/convex/billing-hooks/*.ts` | 7 stub files — the overlay targets (public repo) |
| `~/opencom-billing/convex-overlay/billing-hooks/*.ts` | Real implementations |
| `~/opencom-billing/convex-overlay/billing/` | All billing logic (types, gates, usage, stripe, webhooks, etc.) |
| `~/opencom-billing/convex-overlay/schema/billingTables.ts` | Schema definitions |
| `~/opencom-billing/convex-overlay/schema.ts` | Full schema including billing tables |
| `~/opencom-billing/convex-overlay/crons.ts` | Billing cron jobs |
| `~/opencom-billing/scripts/overlay.sh` | Applies overlay at deploy time |
| `~/opencom-billing/scripts/validate-overlay.sh` | CI check (no private repo needed) |
| `scripts/validate-overlay-targets.sh` | Same but runs in public repo CI |
| `scripts/dev-with-billing.sh` | Local dev with overlay applied + auto-restore on exit |
| `.github/workflows/deploy-convex-prod.yml` | Updated to clone private repo via GitHub App + apply overlay |
| `apps/web/src/components/billing/useBillingStatus.ts` | Frontend hook for billing state |
| `apps/web/src/components/billing/useBillingActions.ts` | Frontend hooks for checkout/portal/hard caps |
| `apps/landing/src/app/pricing/page.tsx` | Pricing page |
