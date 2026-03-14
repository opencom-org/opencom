## ADDED Requirements

### Requirement: Entitlements query

The system SHALL expose a `getEntitlements` query that accepts a `workspaceId` and returns the workspace's plan, subscription status, feature flags, and usage limits with current consumption. This query SHALL be the single source of truth for all feature gating and limit enforcement in the application.

#### Scenario: Active Pro subscription

- **WHEN** `getEntitlements` is called for a workspace with an active Pro subscription
- **THEN** it SHALL return `plan: "pro"`, `status: "active"`, `features.aiAgent: true`, `features.emailCampaigns: true`, `features.series: true`, and limits reflecting Pro plan values with current usage

#### Scenario: Active Starter subscription

- **WHEN** `getEntitlements` is called for a workspace with an active Starter subscription
- **THEN** it SHALL return `plan: "starter"`, `status: "active"`, `features.aiAgent: false`, `features.emailCampaigns: false`, `features.series: false`, and limits reflecting Starter plan values

#### Scenario: Trialing subscription

- **WHEN** `getEntitlements` is called for a workspace with a trialing subscription
- **THEN** it SHALL return `plan: "pro"`, `status: "trialing"`, with Pro features and limits enabled

#### Scenario: Expired subscription

- **WHEN** `getEntitlements` is called for a workspace with an expired subscription
- **THEN** it SHALL return `status: "expired"` with all features disabled

### Requirement: Self-hosted unlimited default

When billing is not enabled (`STRIPE_SECRET_KEY` environment variable is not set), the `getEntitlements` query SHALL return `plan: "unlimited"` with all features enabled and no usage limits. No subscription record lookup SHALL be performed. No Stripe-related code SHALL be imported or executed.

#### Scenario: Self-hosted deployment entitlements

- **WHEN** `getEntitlements` is called on a self-hosted deployment
- **AND** `STRIPE_SECRET_KEY` is not set
- **THEN** it SHALL return `plan: "unlimited"`, `status: "active"`, all features `true`, and all limits set to `Infinity`

#### Scenario: Self-hosted has no billing code path

- **WHEN** any billing-related function is called on a self-hosted deployment
- **THEN** it SHALL return a no-op or unlimited response
- **AND** no Stripe SDK code SHALL be imported or executed

### Requirement: isBillingEnabled utility

The system SHALL provide an `isBillingEnabled()` function that returns `true` if and only if the `STRIPE_SECRET_KEY` environment variable is defined. This function SHALL be used as the master guard for all billing-related code paths in both Convex functions and React components.

#### Scenario: Billing enabled on hosted deployment

- **WHEN** `STRIPE_SECRET_KEY` is set in the environment
- **THEN** `isBillingEnabled()` SHALL return `true`

#### Scenario: Billing disabled on self-hosted

- **WHEN** `STRIPE_SECRET_KEY` is not set in the environment
- **THEN** `isBillingEnabled()` SHALL return `false`

### Requirement: AI agent gating

The AI agent feature SHALL be gated behind the Pro plan. When a workspace does not have AI agent entitlement, the AI agent toggle in settings SHALL be disabled, and any attempt to trigger an AI response SHALL be blocked with a descriptive error.

#### Scenario: Starter plan cannot use AI agent

- **WHEN** a workspace on the Starter plan attempts to enable the AI agent
- **THEN** the mutation SHALL throw an error indicating AI agent requires Pro plan

#### Scenario: Pro plan can use AI agent

- **WHEN** a workspace on the Pro plan enables the AI agent
- **THEN** the AI agent SHALL function normally

### Requirement: Email campaign and series gating

Email campaigns and series SHALL be gated behind the Pro plan. When a workspace does not have email campaign entitlement, campaign and series creation SHALL be blocked with a descriptive error. Existing campaigns/series on a downgraded workspace SHALL be paused, not deleted.

#### Scenario: Starter plan cannot create email campaigns

- **WHEN** a workspace on the Starter plan attempts to create an email campaign
- **THEN** the mutation SHALL throw an error indicating email campaigns require Pro plan

#### Scenario: Downgraded workspace campaigns are paused

- **WHEN** a workspace downgrades from Pro to Starter
- **AND** the downgrade takes effect at period end
- **THEN** active campaigns and series SHALL be paused, not deleted

### Requirement: Seat limit enforcement

The system SHALL enforce seat limits when inviting or adding workspace members. All workspace member roles (owner, admin, agent, viewer) SHALL count equally toward the seat limit. The seat count SHALL be checked against `entitlements.limits.seats.limit`. On Starter (limit 3), exceeding the limit SHALL block the invitation. On Pro (limit 10), exceeding the limit SHALL allow the invitation but track overage for PAYG billing, unless a hard cap is enabled.

#### Scenario: Invitation within seat limit

- **WHEN** a workspace has 2 of 3 seats used on Starter
- **AND** an admin invites a new member with any role
- **THEN** the invitation SHALL be created successfully

#### Scenario: Starter invitation exceeds seat limit

- **WHEN** a Starter workspace has 3 of 3 seats used
- **AND** an admin invites a new member with any role
- **THEN** the mutation SHALL throw an error indicating the seat limit has been reached
- **AND** the error message SHALL suggest upgrading to Pro or removing a member

#### Scenario: Pro invitation beyond included seats (PAYG)

- **WHEN** a Pro workspace has 10 of 10 included seats used
- **AND** no hard cap is enabled for seats
- **AND** an admin invites a new member
- **THEN** the invitation SHALL be created successfully
- **AND** the seat SHALL be tracked as overage for PAYG billing

#### Scenario: Pro invitation blocked by hard cap

- **WHEN** a Pro workspace has 10 of 10 included seats used
- **AND** a hard cap IS enabled for seats
- **AND** an admin invites a new member
- **THEN** the mutation SHALL throw an error indicating the seat hard cap has been reached

### Requirement: Hard cap enforcement

When a workspace owner enables a hard cap for a metered dimension (AI credits, emails, seats), the system SHALL block usage of that feature when the limit is reached instead of allowing PAYG overages. Hard caps are stored on the `subscriptions` table and are configurable per-dimension. Default: no hard caps (PAYG continues with warnings).

#### Scenario: AI hard cap blocks response generation

- **WHEN** a Pro workspace has `hardCaps.ai === true`
- **AND** `ai_cost_cents` has reached `aiCreditLimitCents`
- **THEN** the AI agent SHALL be disabled with a message indicating the hard cap has been reached

#### Scenario: Email hard cap blocks sending

- **WHEN** a workspace has `hardCaps.emails === true`
- **AND** `emails_sent` has reached `emailLimit`
- **THEN** email sending SHALL be blocked with a message indicating the hard cap has been reached

#### Scenario: No hard cap allows PAYG

- **WHEN** a Pro workspace has no hard cap set for a dimension
- **AND** usage exceeds the included limit
- **THEN** the feature SHALL continue to function
- **AND** overage SHALL be tracked for PAYG billing

### Requirement: Billing permission expansion

The `settings.billing` permission in `permissions.ts` SHALL be expanded to include the `admin` role in addition to the existing `owner` role. This is necessary because workspace creators receive the `admin` role (not `owner`) in the current `authConvex.ts` signup flow. Without this change, workspace creators cannot access billing settings.

#### Scenario: Admin can access billing settings

- **WHEN** an admin user views the settings page on a hosted deployment
- **THEN** the billing section SHALL be visible (if billing is enabled)

#### Scenario: Agent and viewer cannot access billing settings

- **WHEN** an agent or viewer user views the settings page
- **THEN** the billing section SHALL NOT be visible

### Requirement: Restricted state mutation blocking

When a workspace is in restricted state (subscription `status` is `"expired"`, `"canceled"` past period end, or `"unpaid"`), all content-modifying mutations SHALL be blocked. Read queries, data exports, and billing/subscription management mutations SHALL remain functional.

#### Scenario: Restricted workspace blocks message send

- **WHEN** a user in a restricted workspace calls the send message mutation
- **THEN** the mutation SHALL throw an error with message indicating the workspace subscription needs to be reactivated

#### Scenario: Restricted workspace allows reading

- **WHEN** a user in a restricted workspace queries conversations
- **THEN** the query SHALL return results normally

#### Scenario: Restricted workspace allows billing management

- **WHEN** a workspace owner in a restricted workspace accesses billing settings
- **THEN** the billing settings page SHALL load
- **AND** the owner SHALL be able to reactivate their subscription

### Requirement: Billing status query for frontend

The system SHALL expose a query that returns whether billing is enabled and the current workspace's subscription summary (plan, status, trial days remaining) for use by React components. This query SHALL NOT expose sensitive information (no Stripe keys, no internal IDs).

#### Scenario: Frontend receives billing status

- **WHEN** a React component calls the billing status query
- **THEN** it SHALL receive `billingEnabled: boolean`, `plan`, `status`, `trialDaysRemaining` (if trialing), and feature flags

#### Scenario: Self-hosted frontend receives billing disabled

- **WHEN** a React component calls the billing status query on a self-hosted deployment
- **THEN** it SHALL receive `billingEnabled: false`
- **AND** no other billing fields SHALL be present
