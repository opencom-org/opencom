## 1. Schema and Types (Public Repo)

- [x] 1.1 Create `packages/convex/convex/schema/billingTables.ts` with `subscriptions` table (workspaceId, stripeCustomerId, stripeSubscriptionId, plan, status, trialEndsAt, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, seatLimit, aiCreditLimitCents, emailLimit, hardCaps, currency, createdAt, updatedAt) and indexes (by_workspaceId, by_status) — follow the existing modular schema pattern (see `schema/authWorkspaceTables.ts` etc.)
- [x] 1.2 Add `usageRecords` table to `schema/billingTables.ts` with fields (workspaceId, dimension, periodStart, periodEnd, value, lastUpdatedAt) and compound index on [workspaceId, dimension, periodStart]
- [x] 1.3 Import and spread `billingTables` in `packages/convex/convex/schema.ts` alongside existing table imports
- [x] 1.4 Create `packages/convex/convex/billing/types.ts` with plan types (Plan, SubscriptionStatus, UsageDimension, Entitlements interface), plan config constants (limits per plan), and `isBillingEnabled()` utility function
- [x] 1.5 Expand `settings.billing` permission in `packages/convex/convex/permissions.ts` to include `admin` role (workspace creators get `admin`, not `owner`, so admin must have billing access)
- [x] 1.6 Deploy schema changes and verify they apply cleanly (`pnpm --filter @opencom/convex typecheck`)

## 2. Feature Gating Module (Public Repo)

- [x] 2.1 Create `packages/convex/convex/billing/gates.ts` with `getEntitlements` internal query — reads subscription + usage records for a workspace, returns full Entitlements object including hard cap state. When no subscription exists (self-hosted), return unlimited defaults
- [x] 2.2 Create `getBillingStatus` public query for React frontend — returns billingEnabled, plan, status, trialDaysRemaining, features (no sensitive data)
- [x] 2.3 Create `requireActiveSubscription` helper that checks entitlements and throws descriptive error if workspace is in restricted state (expired/canceled/unpaid)
- [x] 2.4 Write unit tests for `getEntitlements` covering: self-hosted (no subscription), trialing, active starter, active pro, expired, past_due, hard cap enabled/disabled scenarios

## 3. Billing Stubs (Public Repo)

- [x] 3.1 Create `packages/convex/convex/billing/stubs.ts` with no-op stub functions matching the signatures the private overlay will replace: `handleStripeWebhook` (returns 200 OK), `createCheckoutSession` (throws "billing not configured"), `createPortalSession` (throws "billing not configured"), `reportUsageToStripe` (no-op)
- [x] 3.2 Create `packages/convex/convex/billing/webhooks.ts` that re-exports `handleStripeWebhook` from stubs (overlay replaces this file)
- [x] 3.3 Create `packages/convex/convex/billing/stripe.ts` that re-exports `createCheckoutSession` and `createPortalSession` from stubs (overlay replaces this file)
- [x] 3.4 Create `packages/convex/convex/billing/usageReporter.ts` that re-exports `reportUsageToStripe` from stubs (overlay replaces this file)

## 4. Webhook Route Registration (Public Repo)

- [x] 4.1 Add `POST /api/stripe/webhook` route to `packages/convex/convex/http.ts` that calls the webhook handler from `billing/webhooks.ts`
- [x] 4.2 Add matching `OPTIONS /api/stripe/webhook` route for CORS preflight (follow existing pattern in http.ts — see the geolocation and email webhook routes at lines 339-692 for the pattern)
- [x] 4.3 Verify self-hosted deployment returns 200 OK on webhook endpoint with stub handler

## 5. Usage Metering (Public Repo)

- [x] 5.1 Create `packages/convex/convex/billing/usage.ts` with `incrementUsage` internal mutation — atomically increments a usage record for a given workspace, dimension, and period (creates record if not exists via lazy initialization)
- [x] 5.2 Create `getUsageForPeriod` internal query — returns current period usage for all dimensions for a workspace
- [x] 5.3 Extend `createAIClient()` in `packages/convex/convex/lib/aiGateway.ts` to accept optional Stripe billing headers (passed through the `headers` option of `createOpenAI()`)
- [x] 5.4 Integrate AI cost tracking into `packages/convex/convex/aiAgentActions.ts` — after AI response generation (around line 844 where `tokensUsed` is available), estimate cost in cents from tokens used and call `incrementUsage` for `ai_cost_cents` dimension (display only — actual billing via AI Gateway)
- [x] 5.5 Integrate AI Gateway Stripe billing headers into `packages/convex/convex/aiAgentActions.ts` `generateResponse` action — look up workspace subscription to get `stripeCustomerId`, when billing enabled and workspace has a `stripeCustomerId`, pass `stripe-customer-id` and `stripe-restricted-access-key` headers via the extended `createAIClient()` for automatic per-request token metering
- [x] 5.6 Integrate email send tracking into email campaign send mutations (`packages/convex/convex/emailCampaigns.ts`) — call `incrementUsage` for `emails_sent` on each campaign email
- [x] 5.7 Integrate email send tracking into series email send steps (`packages/convex/convex/series/runtimeExecution.ts`) — call `incrementUsage` for `emails_sent` on each series email
- [x] 5.8 Integrate email send tracking into transactional email senders — call `incrementUsage` for `emails_sent` on OTP sends (`authConvex.ts` Resend OTP provider) and conversation reply emails (`emailChannel.ts` / `email.ts:sendEmail()`)
- [x] 5.9 Integrate seat count tracking into workspace member mutations (`workspaceMembers.ts`) — increment/decrement `seats` usage on member add/remove (all roles count equally)
- [x] 5.10 Write unit tests for `incrementUsage` covering: first write creates record, subsequent writes increment, concurrent writes are consistent, period rollover creates new record

## 6. Subscription Lifecycle on Signup (Public Repo)

- [x] 6.1 Modify `packages/convex/convex/authConvex.ts` `createOrUpdateUser` callback (around line 122 after workspace creation) — when billing is enabled and a new workspace is created, insert a subscription record with `status: "trialing"`, `plan: "pro"`, `trialEndsAt: Date.now() + 7 * 24 * 60 * 60 * 1000`, `seatLimit: 10`, and Pro plan limits
- [x] 6.2 Initialize usage records for the new trial period (ai_cost_cents, emails_sent, seats all at 0)
- [x] 6.3 Set initial seat count to 1 (the owner) in the seats usage record
- [x] 6.4 Verify self-hosted signup path is unchanged (no subscription created when billing disabled)

## 7. Trial Expiry Scheduled Job (Public Repo)

- [x] 7.1 Create `packages/convex/convex/billing/trialExpiry.ts` with an internal mutation that queries subscriptions with `status: "trialing"` and `trialEndsAt < Date.now()`, and transitions them to `status: "expired"`
- [x] 7.2 Create a cron job definition in `packages/convex/convex/crons.ts` (new file — no cron jobs currently exist in the codebase) that runs the trial expiry check hourly
- [x] 7.3 Write unit tests for trial expiry: active trial not affected, expired trial transitions to expired status, already-expired subscription not modified again

## 8. Feature Gating Integration (Public Repo)

- [x] 8.1 Add AI agent entitlement check in `packages/convex/convex/aiAgent.ts` or `aiAgentActions.ts` — before generating AI response, verify `features.aiAgent` is true and check AI hard cap if enabled, throw descriptive error if blocked
- [x] 8.2 Add email campaign entitlement check in `packages/convex/convex/emailCampaigns.ts` — block campaign creation when `features.emailCampaigns` is false
- [x] 8.3 Add series entitlement check in `packages/convex/convex/series.ts` — block series creation when `features.series` is false
- [x] 8.4 Add seat limit check in workspace invitation mutation (`packages/convex/convex/workspaceMembers.ts` `createInvitation`) — before creating invitation (all roles count), verify current seats < seat limit (hard block on Starter, PAYG or hard cap on Pro)
- [x] 8.5 Add restricted state check to key content-modifying mutations (send message, create article, create tour, create outbound message, etc.) using `requireActiveSubscription` helper
- [x] 8.6 Add email hard cap check to all email send paths — when `hardCaps.emails === true` and emails_sent >= emailLimit, block sending with descriptive error
- [x] 8.7 Write integration tests for feature gating: starter cannot use AI, starter cannot create campaign, seat limit blocks invitation (all roles count), hard caps block at limit, restricted state blocks message send, self-hosted has no restrictions

## 9. Pricing Page (Public Repo — Landing Site)

- [x] 9.1 Create `/pricing` page at `apps/landing/src/app/pricing/page.tsx` with metadata, plan comparison grid (Starter vs Pro), feature lists, price display in USD and GBP, and self-host callout section
- [x] 9.2 Create reusable pricing components: `PricingCard`, `FeatureComparison`, `SelfHostCallout` in `apps/landing/src/components/pricing/`
- [x] 9.3 Add link to `/pricing` in the landing site navigation
- [x] 9.4 Verify pricing page renders correctly and metadata is set for SEO

## 10. Dashboard Billing UI — Trial and Restriction Banners (Public Repo)

- [x] 10.1 Create `apps/web/src/components/billing/TrialBanner.tsx` — uses `getBillingStatus` query, shows days remaining, urgent style when <= 2 days, CTA to choose plan. Renders nothing when billing disabled or subscription active.
- [x] 10.2 Create `apps/web/src/components/billing/RestrictedBanner.tsx` — non-dismissible banner for expired/past_due/canceled workspaces with reactivation CTA. Renders nothing when not in restricted state.
- [x] 10.3 Integrate both banners into the dashboard app layout (e.g., `apps/web/src/components/AppLayout.tsx` or equivalent)
- [x] 10.4 Create upgrade prompt component `apps/web/src/components/billing/UpgradePrompt.tsx` for use at gated feature entry points

## 11. Dashboard Billing UI — Feature Gating Prompts (Public Repo)

- [x] 11.1 Add upgrade prompt to AI agent settings section (`apps/web/src/app/settings/` AI section) — show UpgradePrompt when `features.aiAgent` is false
- [x] 11.2 Add upgrade prompt to email campaign creation flow — show UpgradePrompt when `features.emailCampaigns` is false
- [x] 11.3 Add upgrade prompt to series creation flow — show UpgradePrompt when `features.series` is false
- [x] 11.4 Add seat limit reached message to team invitation UI in settings — show message when at seat limit (all roles count) with suggestion to upgrade or remove a member

## 12. Dashboard Billing Settings Stub (Public Repo)

- [x] 12.1 Create `apps/web/src/components/billing/BillingSettings.tsx` stub component — renders nothing when billing disabled, renders placeholder "billing settings loading" when billing enabled (to be replaced by overlay)
- [x] 12.2 Add `"billing"` to `SettingsSectionId` and `SettingsCategoryId` in `apps/web/src/app/settings/settingsSections.ts`, then integrate billing settings section into `apps/web/src/app/settings/page.tsx` — render conditionally based on `settings.billing` permission (owner + admin) and `billingEnabled` status

## 13. Private Repo Setup (opencom-billing)

- [x] 13.1 Create `opencom-billing` GitHub repository (private) — created as local git repo at ~/opencom-billing
- [x] 13.2 Initialize repo structure: `convex-overlay/billing/`, `web-overlay/billing/`, `scripts/`
- [x] 13.3 Create `scripts/overlay.sh` — copies overlay files to correct locations in the public repo (convex-overlay/billing/_ → packages/convex/convex/billing/, web-overlay/billing/_ → apps/web/src/components/billing/)
- [x] 13.4 Create `scripts/validate-overlay.sh` — verifies all overlay target paths exist in the public repo, fails if any are missing
- [x] 13.5 Add README with setup instructions, env var requirements, and deployment guide

## 14. Stripe Integration — Checkout and Portal (Private Repo)

- [x] 14.1 Add `stripe` npm dependency to the private repo (used in Convex overlay actions)
- [x] 14.2 Implement `convex-overlay/billing/stripe.ts` with `createCheckoutSession` action — accepts workspaceId, plan, currency; creates Stripe customer if needed; creates Checkout session with correct Price ID from env vars; includes workspaceId in session metadata; returns URL
- [x] 14.3 Implement `createPortalSession` action — accepts workspaceId; looks up stripeCustomerId; creates Customer Portal session; returns URL
- [x] 14.4 Both actions SHALL enforce `settings.billing` permission (owner + admin)

## 15. Stripe Integration — Webhook Handler (Private Repo)

- [x] 15.1 Implement `convex-overlay/billing/webhooks.ts` with `handleStripeWebhook` — verifies signature using `STRIPE_WEBHOOK_SECRET`, parses event, routes to handler by event type
- [x] 15.2 Implement `checkout.session.completed` handler — extracts workspaceId from metadata, updates subscription with stripeCustomerId, stripeSubscriptionId, status: "active", plan and currency from metadata
- [x] 15.3 Implement `customer.subscription.updated` handler — updates plan, status, period dates, cancelAtPeriodEnd from Stripe subscription object
- [x] 15.4 Implement `customer.subscription.deleted` handler — updates status to "canceled"
- [x] 15.5 Implement `invoice.payment_failed` handler — updates status to "past_due"
- [x] 15.6 Implement `invoice.payment_succeeded` handler — updates status to "active" if currently past_due
- [x] 15.7 Add idempotency check — store processed event IDs in `stripeEvents` table and skip duplicates
- [x] 15.8 Write tests for webhook handler covering each event type

## 16. Stripe Integration — Usage Reporter (Private Repo)

- [x] 16.1 Implement `convex-overlay/billing/usageReporter.ts` with `reportUsageToStripe` scheduled action — queries all Pro workspaces with active subscriptions, calculates overage for email and seat dimensions, reports incremental overage to Stripe metered billing API
- [x] 16.2 Add tracking for last-reported overage values — stored in subscription `lastReportedEmailOverage`/`lastReportedSeatOverage` fields
- [x] 16.3 Schedule the reporter to run hourly via `runUsageReporter` action registered in public `crons.ts`
- [x] 16.4 Write tests for usage reporter: no overage = no report, overage calculated correctly, incremental reporting works

## 17. Billing Settings UI (Private Repo — Web Overlay)

- [x] 17.1 Implement `web-overlay/billing/BillingSettings.tsx` — full billing management component showing plan badge, subscription status, billing period dates, usage meters with progress bars, hard cap toggles, portal/checkout buttons
- [x] 17.2 Add plan change flow — Starter/Pro selection UI with currency toggle, triggers `createCheckoutSession`
- [x] 17.3 Add usage warning display — orange/red progress bars when usage approaches 80%/100% of limits
- [x] 17.4 Add hard cap management UI — checkboxes per dimension (AI, emails, seats) that update `hardCaps` on the subscription
- [x] 17.5 Verify the overlay component correctly replaces the public stub when overlay.sh runs

## 18. Overage Warning Notifications

- [x] 18.1 Create `packages/convex/convex/billing/warnings.ts` with internal mutation that checks usage against thresholds (80%, 100%) and creates notification events for workspace owners
- [x] 18.2 Integrate warning checks into `incrementUsage` — after incrementing, check if any threshold has been newly crossed
- [x] 18.3 Add deduplication to prevent sending the same warning twice per period (track last-warned threshold per dimension per period)
- [x] 18.4 Write tests for warning logic: warning at 80%, warning at 100%, no duplicate warnings, warning resets on new period

## 19. Stripe Configuration

- [ ] 19.1 Create Stripe products: "Opencom Starter" and "Opencom Pro" in Stripe dashboard
- [ ] 19.2 Create recurring prices: Starter USD ($15/mo), Starter GBP (£15/mo), Pro USD ($45/mo), Pro GBP (£45/mo)
- [ ] 19.3 Create billing meter `token-billing-tokens` in Stripe dashboard for AI Gateway token metering (input/output tokens)
- [ ] 19.4 Create metered prices: email overage (per email), seat overage (per seat per month)
- [ ] 19.5 Create Stripe restricted access key (`rk_...`) with only meter event write permissions for AI Gateway
- [ ] 19.6 Configure Stripe Customer Portal: allow plan changes, cancellation, payment method updates, invoice history
- [ ] 19.7 Configure $20/mo billing credit on Pro subscription for included AI usage
- [ ] 19.8 Set up Stripe webhook endpoint pointing to hosted Convex deployment `/api/stripe/webhook` with events: checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed
- [ ] 19.9 Add all Stripe environment variables (including STRIPE_RESTRICTED_ACCESS_KEY) to hosted Convex deployment and Vercel environment

## 20. CI/CD and Deployment

- [x] 20.1 Update hosted deployment pipeline to clone opencom-billing, run overlay.sh, then deploy Convex and Vercel
- [x] 20.2 Add validate-overlay.sh to CI on the public repo (runs on every PR to catch overlay target path breakage)
- [ ] 20.3 Test full deployment with overlay: verify webhook endpoint processes events, checkout flow works, billing settings UI renders

## 21. Existing Workspace Migration

- [ ] 21.1 Create a one-time migration script for existing hosted workspaces — insert subscription records with `status: "trialing"` and 7-day trial (treated identically to new signups, no grandfathering)
- [ ] 21.2 Initialize usage records for existing workspaces
- [ ] 21.3 Test migration script on a staging environment before production

## 22. End-to-End Verification

- [ ] 22.1 Test full signup → trial → plan selection → Checkout → active subscription flow
- [ ] 22.2 Test trial expiry → restricted state → reactivation flow
- [ ] 22.3 Test Starter → Pro upgrade and Pro → Starter downgrade
- [ ] 22.4 Test cancellation → period end → restricted state
- [ ] 22.5 Test AI PAYG: verify AI Gateway Stripe headers are passed for paid subscriptions, omitted during trial
- [ ] 22.6 Test email PAYG: exceed included emails (all types count), verify overage reported to Stripe
- [ ] 22.7 Test seat PAYG: add 11th member to Pro workspace, verify overage reported to Stripe
- [ ] 22.8 Test hard caps: enable hard cap for AI/email/seats, verify features blocked at limit
- [ ] 22.9 Test self-hosted deployment: verify no billing UI, no restrictions, all features available
- [ ] 22.10 Run full typecheck (`pnpm typecheck`) and existing test suite to verify no regressions
