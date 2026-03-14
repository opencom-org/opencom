## ADDED Requirements

### Requirement: Usage records data model

The system SHALL store per-workspace usage in a `usageRecords` table with fields: `workspaceId`, `dimension` (ai_cost_cents|emails_sent|seats), `periodStart`, `periodEnd`, `value` (cumulative usage), `lastUpdatedAt`. The table SHALL have a compound index on `[workspaceId, dimension, periodStart]` for efficient per-period lookups.

#### Scenario: Usage record structure

- **WHEN** a usage record is created or updated
- **THEN** it SHALL contain all required fields
- **AND** `value` SHALL be a non-negative number representing cumulative usage for the period
- **AND** `periodStart` and `periodEnd` SHALL align with the workspace's billing period

### Requirement: Usage record initialization

When a subscription is created (trial start or plan activation), usage records SHALL be initialized for the current billing period with `value: 0` for all tracked dimensions.

#### Scenario: Usage records created on trial start

- **WHEN** a new workspace is created and a trial subscription is inserted
- **THEN** usage records SHALL be created for `ai_cost_cents`, `emails_sent`, and `seats` dimensions
- **AND** all records SHALL have `value: 0`
- **AND** `periodStart` and `periodEnd` SHALL match the trial period

### Requirement: AI cost tracking for display

When the AI agent generates a response, the system SHALL estimate the cost in cents based on tokens used and update the workspace's `ai_cost_cents` usage record for the current period. This tracking is for display purposes in the billing settings UI (showing the user their AI spend). Actual billing to Stripe is handled automatically by the Vercel AI Gateway via the `stripe-customer-id` and `stripe-restricted-access-key` headers — the AI Gateway emits per-request meter events to Stripe's `token-billing-tokens` billing meter.

#### Scenario: AI response increments display cost counter

- **WHEN** the AI agent generates a response using 1000 tokens
- **AND** the estimated cost is 5 cents
- **THEN** the `ai_cost_cents` usage record for the workspace's current period SHALL be incremented by 5

#### Scenario: AI cost tracked even when within included limits

- **WHEN** the AI agent generates a response
- **AND** the workspace has not exceeded its included AI credit limit
- **THEN** the usage record SHALL still be incremented (tracking is unconditional)

#### Scenario: AI Gateway headers passed for paid subscriptions

- **WHEN** the AI agent generates a response
- **AND** billing is enabled
- **AND** the workspace has a `stripeCustomerId` (paid subscription, not trial)
- **THEN** the `stripe-customer-id` and `stripe-restricted-access-key` headers SHALL be passed to the AI Gateway request

#### Scenario: AI Gateway headers omitted during trial

- **WHEN** the AI agent generates a response
- **AND** the workspace is on a trial (no `stripeCustomerId`)
- **THEN** no Stripe billing headers SHALL be passed to the AI Gateway

### Requirement: Email send tracking

When any email is sent by the system, the workspace's `emails_sent` usage record SHALL be atomically incremented for the current period. All email types count equally: OTP authentication codes (sent via Resend in `authConvex.ts`), conversation reply emails (sent via `email.ts:sendEmail()` and `emailChannel.ts`), email campaign sends (`emailCampaigns.ts`), and series email sends (`series/runtimeExecution.ts`).

#### Scenario: Campaign email increments counter

- **WHEN** an email campaign sends an email to a recipient
- **THEN** the `emails_sent` usage record SHALL be incremented by 1

#### Scenario: Series email increments counter

- **WHEN** a series step sends an email to a visitor
- **THEN** the `emails_sent` usage record SHALL be incremented by 1

#### Scenario: OTP email increments counter

- **WHEN** an OTP code email is sent for authentication
- **THEN** the `emails_sent` usage record SHALL be incremented by 1

#### Scenario: Conversation reply email increments counter

- **WHEN** a support agent replies to a conversation via email
- **THEN** the `emails_sent` usage record SHALL be incremented by 1

### Requirement: Seat count tracking

The system SHALL maintain an accurate seat count in the `seats` usage record. The count SHALL reflect the total number of workspace members regardless of role (all roles count equally: owner, admin, agent, viewer). The count SHALL be updated when members are added or removed.

#### Scenario: Seat count incremented on member addition

- **WHEN** a new member with any role is added to a workspace
- **THEN** the `seats` usage record SHALL be incremented by 1

#### Scenario: Seat count decremented on member removal

- **WHEN** a member with any role is removed from a workspace
- **THEN** the `seats` usage record SHALL be decremented by 1

#### Scenario: Role change does not affect seat count

- **WHEN** a member's role is changed (e.g., from `viewer` to `agent`)
- **THEN** the `seats` usage record SHALL NOT change (the member was already counted)

### Requirement: Atomic counter updates

Usage record increments SHALL be atomic — the system SHALL read the current value and write the updated value in a single Convex mutation transaction to prevent race conditions.

#### Scenario: Concurrent usage updates are consistent

- **WHEN** two AI responses complete simultaneously for the same workspace
- **THEN** both cost increments SHALL be reflected in the final `ai_cost_cents` value
- **AND** no increment SHALL be lost due to concurrent writes

### Requirement: Period rollover

When a new billing period starts, usage queries SHALL return data for the current period. Previous period records SHALL be retained for historical reporting. The system SHALL create new usage records for the new period on first write (lazy initialization).

#### Scenario: First usage in new period creates record

- **WHEN** an AI response occurs after the previous billing period has ended
- **AND** no usage record exists for the new period
- **THEN** a new usage record SHALL be created for the new period with the incremented value

#### Scenario: Previous period records are preserved

- **WHEN** a new billing period starts
- **THEN** usage records from the previous period SHALL NOT be deleted
- **AND** they SHALL remain queryable for historical reporting

### Requirement: Usage data in entitlements

The `getEntitlements` query SHALL include current-period usage for each metered dimension alongside the limit, enabling the frontend to display usage progress and the backend to enforce limits.

#### Scenario: Entitlements include usage data

- **WHEN** `getEntitlements` is called for a workspace with 15 cents of AI usage and 500 emails sent
- **THEN** the response SHALL include `limits.aiCredits: { usedCents: 15, limitCents: 2000, payg: true }` and `limits.emails: { sent: 500, limit: 10000, payg: true }`
