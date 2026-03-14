## ADDED Requirements

### Requirement: PAYG for AI credits on Pro plan

When a Pro plan workspace exceeds its included AI credit limit ($20/mo, 2000 cents), the AI agent SHALL continue to function unless a hard cap is enabled. AI token billing to Stripe is handled automatically by the Vercel AI Gateway — every request with `stripe-customer-id` headers emits meter events. The $20/mo included credits are implemented as a Stripe billing credit on the Pro subscription. All AI usage beyond the credit is charged at provider token rates with no markup. When a hard cap is enabled (`hardCaps.ai === true`), the AI agent SHALL be disabled once the estimated cost reaches the included limit.

#### Scenario: AI usage within included limit

- **WHEN** a Pro workspace has estimated AI spend of 1500 of 2000 included credit cents
- **AND** the AI agent generates a response
- **THEN** the response SHALL be generated normally
- **AND** the `ai_cost_cents` display counter SHALL be incremented

#### Scenario: AI usage exceeds included limit (PAYG, no hard cap)

- **WHEN** a Pro workspace has estimated AI spend at or above 2000 cents
- **AND** no hard cap is enabled for AI
- **THEN** the AI agent SHALL continue to function
- **AND** the Vercel AI Gateway SHALL automatically bill the overage to Stripe via meter events

#### Scenario: AI usage blocked by hard cap

- **WHEN** a Pro workspace has estimated AI spend at or above 2000 cents
- **AND** `hardCaps.ai === true`
- **THEN** the AI agent SHALL be disabled with a descriptive error indicating the hard cap has been reached

#### Scenario: Starter plan has no AI and no PAYG

- **WHEN** a Starter workspace attempts to use the AI agent
- **THEN** the request SHALL be blocked (AI is not available on Starter)
- **AND** no PAYG applies

### Requirement: PAYG for emails on Pro plan

When a Pro plan workspace exceeds its included email limit (10,000/mo), emails SHALL continue to send unless a hard cap is enabled. Additional emails beyond the included limit SHALL be tracked as overage and billed per email at a cost-plus rate. Overage usage SHALL be reported to Stripe as metered billing. All email types count: OTP (sent via Resend in `authConvex.ts`), conversation replies (sent via `email.ts:sendEmail()`), campaigns (sent via `emailCampaigns.ts`), and series (sent via `series/runtimeExecution.ts`).

#### Scenario: Email usage within included limit

- **WHEN** a Pro workspace has sent 9,500 of 10,000 included emails
- **AND** an email is sent (any type)
- **THEN** the email SHALL be sent normally
- **AND** `emails_sent` usage SHALL be incremented to 9,501

#### Scenario: Email usage exceeds included limit (PAYG, no hard cap)

- **WHEN** a Pro workspace has sent 10,000 of 10,000 included emails
- **AND** no hard cap is enabled for emails
- **AND** a campaign sends 500 emails
- **THEN** the emails SHALL be sent normally (not blocked)
- **AND** `emails_sent` usage SHALL be incremented to 10,500
- **AND** the 500 overage emails SHALL be reported to Stripe as metered usage

#### Scenario: Email blocked by hard cap

- **WHEN** a workspace has sent 10,000 of 10,000 emails
- **AND** `hardCaps.emails === true`
- **THEN** email sending SHALL be blocked with a descriptive error indicating the hard cap has been reached

### Requirement: PAYG for seats on Pro plan

When a Pro plan workspace exceeds its included seat limit (10 seats), additional members SHALL be allowed unless a hard cap is enabled. Seat overages SHALL be reported to Stripe as metered billing (per seat per month). Starter workspaces have a hard limit of 3 seats with no PAYG.

#### Scenario: Pro workspace adds 11th seat (PAYG, no hard cap)

- **WHEN** a Pro workspace has 10 of 10 included seats
- **AND** no hard cap is enabled for seats
- **AND** an admin invites a new member
- **THEN** the invitation SHALL be created successfully
- **AND** the overage seat SHALL be reported to Stripe as metered usage

#### Scenario: Pro workspace seat blocked by hard cap

- **WHEN** a Pro workspace has 10 of 10 included seats
- **AND** `hardCaps.seats === true`
- **AND** an admin invites a new member
- **THEN** the invitation SHALL be blocked with a descriptive error

### Requirement: Usage reporting to Stripe for emails and seats

A scheduled Convex action (in the private overlay) SHALL periodically aggregate email and seat overage usage from the `usageRecords` table and report it to Stripe using the metered billing API. AI token billing is handled automatically by the Vercel AI Gateway and does not require manual reporting. The reporter SHALL only report usage exceeding the included limits. The reporter SHALL track the last reported value to avoid double-reporting.

#### Scenario: Email overage reported to Stripe

- **WHEN** the usage reporter runs
- **AND** a Pro workspace has 11000 in `emails_sent` (1000 over the 10000 limit)
- **AND** the last reported email overage was 500
- **THEN** the reporter SHALL report 500 additional email units (1000 - 500) to Stripe

#### Scenario: Seat overage reported to Stripe

- **WHEN** the usage reporter runs
- **AND** a Pro workspace has 12 seats (2 over the 10 seat limit)
- **THEN** the reporter SHALL report 2 overage seats to Stripe

#### Scenario: No overage to report

- **WHEN** the usage reporter runs
- **AND** a workspace's email and seat usage is within included limits
- **THEN** no usage SHALL be reported to Stripe for that workspace

#### Scenario: Starter plan usage not reported

- **WHEN** the usage reporter runs
- **AND** a workspace is on the Starter plan
- **THEN** no usage SHALL be reported to Stripe (Starter has no PAYG)

### Requirement: Overage warning notifications

The system SHALL notify workspace owners when usage approaches or exceeds included limits. Warnings SHALL be triggered at 80% of the included limit and at 100% of the included limit for each metered dimension.

#### Scenario: 80% AI credit warning

- **WHEN** a Pro workspace's `ai_cost_cents` reaches 1600 (80% of 2000)
- **THEN** the workspace owner SHALL be notified that AI credit usage is at 80%
- **AND** the notification SHALL indicate the overage billing rate

#### Scenario: 100% AI credit warning

- **WHEN** a Pro workspace's `ai_cost_cents` reaches 2000 (100% of 2000)
- **THEN** the workspace owner SHALL be notified that included AI credits are exhausted
- **AND** the notification SHALL indicate that further usage will be billed as overage

#### Scenario: 80% email warning

- **WHEN** a Pro workspace's `emails_sent` reaches 8000 (80% of 10000)
- **THEN** the workspace owner SHALL be notified that email usage is at 80%

#### Scenario: Warning sent only once per threshold per period

- **WHEN** a workspace crosses the 80% threshold for AI credits
- **AND** the 80% warning has already been sent for this billing period
- **THEN** no duplicate warning SHALL be sent

### Requirement: Usage reset on period rollover

When a new billing period starts (detected via the `customer.subscription.updated` webhook with new period dates), the usage reporting state SHALL be reset. The new period's usage records start at zero (via lazy initialization on first write). Previous period overage records are retained for historical reference.

#### Scenario: New billing period resets tracking

- **WHEN** a `customer.subscription.updated` webhook indicates a new billing period
- **THEN** the subscription's `currentPeriodStart` and `currentPeriodEnd` SHALL be updated
- **AND** the last-reported overage tracking SHALL be reset for the new period
- **AND** new usage records SHALL start from zero on first write

### Requirement: PAYG only applies to Pro plan

Pay-as-you-go overage billing SHALL only apply to workspaces on the Pro plan. Starter plan workspaces SHALL have hard limits (AI disabled entirely, no campaign emails) with no PAYG. Self-hosted deployments SHALL have no limits and no PAYG.

#### Scenario: Self-hosted has no PAYG

- **WHEN** usage tracking occurs on a self-hosted deployment
- **THEN** no overage SHALL be calculated or reported
- **AND** no limits SHALL be enforced

#### Scenario: Pro plan has PAYG enabled

- **WHEN** `getEntitlements` is called for a Pro workspace
- **THEN** `limits.aiCredits.payg` SHALL be `true`
- **AND** `limits.emails.payg` SHALL be `true`
- **AND** `limits.seats.payg` SHALL be `true`

#### Scenario: Starter plan has no PAYG

- **WHEN** `getEntitlements` is called for a Starter workspace
- **THEN** `limits.aiCredits.payg` SHALL be `false`
- **AND** `limits.emails.payg` SHALL be `false`
- **AND** `limits.seats.payg` SHALL be `false`
