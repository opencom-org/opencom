## ADDED Requirements

### Requirement: Subscription data model

The system SHALL store subscription state in a `subscriptions` table with fields: `workspaceId`, `stripeCustomerId` (optional), `stripeSubscriptionId` (optional), `plan` (starter|pro), `status` (trialing|active|past_due|canceled|unpaid|expired), `trialEndsAt` (optional), `currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `seatLimit`, `aiCreditLimitCents`, `emailLimit`, `currency` (usd|gbp), `hardCaps` (optional object with per-dimension boolean flags), `createdAt`, `updatedAt`. The table SHALL have an index on `workspaceId` and an index on `status` for batch queries (e.g., trial expiry).

#### Scenario: Subscription record created on workspace signup

- **WHEN** a new user signs up and a workspace is created (via `createOrUpdateUser` in `authConvex.ts`, where the first user gets `role: "admin"`)
- **THEN** a subscription record SHALL be inserted with `status: "trialing"`, `plan: "pro"`, `trialEndsAt` set to 7 days from now, `seatLimit: 10`, `aiCreditLimitCents: 2000`, `emailLimit: 10000`, and `stripeCustomerId`/`stripeSubscriptionId` both null

#### Scenario: Self-hosted deployment has no subscription records

- **WHEN** a workspace is created on a self-hosted deployment (billing not enabled)
- **THEN** no subscription record SHALL be created
- **AND** the workspace SHALL have unrestricted access to all features

### Requirement: Plan definitions

The system SHALL support two plans: **Starter** ($15/mo, £15/mo) and **Pro** ($45/mo, £45/mo). Starter SHALL include up to 3 seats (all roles count equally), 10,000 emails/mo (all email types count), full product access excluding AI agent and bulk email (campaigns/series), and no PAYG overages. Pro SHALL include up to 10 seats, AI agent with $20/mo included credits at provider rates via Vercel AI Gateway, email campaigns and series, 10,000 emails/mo, and PAYG overages for AI credits, emails, and seats beyond included limits.

#### Scenario: Starter plan entitlements

- **WHEN** a workspace has an active Starter subscription
- **THEN** the workspace SHALL have `aiAgent: false`, `emailCampaigns: false`, `series: false`
- **AND** `seatLimit: 3`, `aiCreditLimitCents: 0`, `emailLimit: 10000`

#### Scenario: Pro plan entitlements

- **WHEN** a workspace has an active Pro subscription
- **THEN** the workspace SHALL have `aiAgent: true`, `emailCampaigns: true`, `series: true`
- **AND** `seatLimit: 10`, `aiCreditLimitCents: 2000`, `emailLimit: 10000`

### Requirement: Seven-day free trial

The system SHALL provide a 7-day free trial on the Pro plan for every new workspace on the hosted deployment. The trial SHALL NOT require a credit card. During the trial, all Pro features and limits SHALL be available.

#### Scenario: Trial period is active

- **WHEN** a workspace is within its 7-day trial period
- **THEN** the subscription status SHALL be `"trialing"`
- **AND** all Pro features SHALL be enabled
- **AND** Pro usage limits SHALL apply

#### Scenario: Trial expires without plan selection

- **WHEN** a workspace's `trialEndsAt` timestamp has passed
- **AND** no Stripe subscription has been created (no `stripeSubscriptionId`)
- **THEN** the subscription status SHALL transition to `"expired"`
- **AND** the workspace SHALL enter the restricted state

### Requirement: Trial expiry scheduled check

The system SHALL run a periodic check (at least hourly) that finds all subscriptions with `status: "trialing"` where `trialEndsAt < now` and transitions them to `status: "expired"`.

#### Scenario: Expired trials are detected

- **WHEN** the trial expiry check runs
- **THEN** all subscriptions where `status === "trialing"` AND `trialEndsAt < Date.now()` SHALL be updated to `status: "expired"`

#### Scenario: Active trials are not affected

- **WHEN** the trial expiry check runs
- **AND** a subscription has `status: "trialing"` AND `trialEndsAt > Date.now()`
- **THEN** that subscription SHALL NOT be modified

### Requirement: Restricted state for expired and unpaid workspaces

When a workspace subscription has `status` of `"expired"`, `"canceled"` (past period end), or `"unpaid"`, the workspace SHALL enter a restricted state. In restricted state, all data SHALL remain readable and exportable. All mutations that create, modify, or delete content SHALL be blocked with a descriptive error message. The dashboard SHALL display a prominent banner explaining the restriction and providing reactivation options.

#### Scenario: Expired workspace cannot send messages

- **WHEN** a user in a workspace with `status: "expired"` attempts to send a message
- **THEN** the mutation SHALL throw an error indicating the subscription has expired
- **AND** the error message SHALL include instructions to reactivate

#### Scenario: Expired workspace can read data

- **WHEN** a user in a workspace with `status: "expired"` queries conversations, articles, or other data
- **THEN** the query SHALL return data normally

#### Scenario: Expired workspace can export data

- **WHEN** a user in a workspace with `status: "expired"` requests a data export
- **THEN** the export SHALL proceed normally

### Requirement: Plan transitions

The system SHALL support upgrading from Starter to Pro (immediate, prorated) and downgrading from Pro to Starter (takes effect at end of current billing period). On downgrade, AI agent, campaigns, and series SHALL remain available until the current period ends, then be disabled.

#### Scenario: Upgrade from Starter to Pro

- **WHEN** a workspace owner upgrades from Starter to Pro
- **THEN** Pro features SHALL be enabled immediately
- **AND** usage limits SHALL be updated to Pro levels
- **AND** the billing SHALL be prorated for the remainder of the current period

#### Scenario: Downgrade from Pro to Starter

- **WHEN** a workspace owner downgrades from Pro to Starter
- **THEN** Pro features SHALL remain available until `currentPeriodEnd`
- **AND** the subscription `plan` field SHALL update to `"starter"` at the next billing period
- **AND** `cancelAtPeriodEnd` SHALL be set appropriately on the Stripe subscription

### Requirement: Subscription cancellation

The system SHALL support cancellation via the billing settings UI or Stripe Customer Portal. Cancellation SHALL set `cancelAtPeriodEnd: true`. The workspace SHALL retain full access until the current period ends, then enter restricted state.

#### Scenario: Owner cancels subscription

- **WHEN** a workspace owner cancels their subscription
- **THEN** `cancelAtPeriodEnd` SHALL be set to `true`
- **AND** the workspace SHALL retain full plan access until `currentPeriodEnd`

#### Scenario: Canceled subscription period ends

- **WHEN** a canceled subscription's `currentPeriodEnd` has passed
- **THEN** the subscription status SHALL transition to `"canceled"`
- **AND** the workspace SHALL enter restricted state

### Requirement: Subscription reactivation

The system SHALL allow workspaces in restricted state to reactivate by choosing a plan and completing payment via Stripe Checkout. On successful payment, the workspace SHALL immediately exit restricted state with the selected plan's entitlements.

#### Scenario: Reactivation from expired state

- **WHEN** a workspace owner in restricted state completes Stripe Checkout
- **THEN** the subscription status SHALL transition to `"active"`
- **AND** `stripeCustomerId` and `stripeSubscriptionId` SHALL be populated
- **AND** all plan features SHALL be enabled immediately

### Requirement: Currency support

The system SHALL support USD and GBP pricing at nominal parity ($15 = £15, $45 = £45). The currency SHALL be determined by the Stripe Checkout price the user selects and stored on the subscription record for display purposes.

#### Scenario: User selects GBP pricing

- **WHEN** a user completes Stripe Checkout with the GBP price
- **THEN** the subscription `currency` field SHALL be set to `"gbp"`
- **AND** all billing amounts displayed in the dashboard SHALL be in GBP

#### Scenario: User selects USD pricing

- **WHEN** a user completes Stripe Checkout with the USD price
- **THEN** the subscription `currency` field SHALL be set to `"usd"`
- **AND** all billing amounts displayed in the dashboard SHALL be in USD
