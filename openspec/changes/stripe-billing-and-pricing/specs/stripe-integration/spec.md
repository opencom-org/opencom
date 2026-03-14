## ADDED Requirements

### Requirement: Stripe Checkout session creation

The system SHALL provide a Convex action (in the private overlay) that creates a Stripe Checkout session for plan selection. The action SHALL accept the workspace ID, desired plan (starter|pro), and currency preference (usd|gbp). It SHALL create a Stripe customer if one does not exist, then create a Checkout session with the appropriate Stripe Price ID. The action SHALL return the Checkout session URL for client-side redirect.

#### Scenario: First-time plan selection after trial

- **WHEN** a workspace owner selects a plan for the first time
- **THEN** the system SHALL create a Stripe customer with the owner's email
- **AND** create a Checkout session with the selected plan's price
- **AND** return the Checkout session URL

#### Scenario: Reactivation after cancellation

- **WHEN** a workspace owner with an existing Stripe customer reactivates
- **THEN** the system SHALL reuse the existing Stripe customer ID
- **AND** create a new Checkout session

#### Scenario: Action requires billing permission

- **WHEN** a user without `settings.billing` permission (agent or viewer) attempts to create a Checkout session
- **THEN** the action SHALL throw a permission denied error

### Requirement: Stripe webhook handler

The system SHALL expose an HTTP endpoint at `POST /api/stripe/webhook` that processes Stripe webhook events. The handler SHALL verify the webhook signature using the `STRIPE_WEBHOOK_SECRET`. The handler SHALL process the following event types: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`. The handler SHALL be idempotent — processing the same event ID multiple times SHALL produce the same result.

#### Scenario: checkout.session.completed activates subscription

- **WHEN** a `checkout.session.completed` event is received
- **THEN** the system SHALL update the workspace's subscription with `stripeCustomerId`, `stripeSubscriptionId`, `status: "active"`, and the plan/currency from the Checkout metadata

#### Scenario: customer.subscription.updated reflects changes

- **WHEN** a `customer.subscription.updated` event is received (e.g., plan change, renewal)
- **THEN** the system SHALL update the subscription record to match the Stripe subscription state (plan, status, period dates, cancelAtPeriodEnd)

#### Scenario: customer.subscription.deleted cancels subscription

- **WHEN** a `customer.subscription.deleted` event is received
- **THEN** the system SHALL update the subscription status to `"canceled"`

#### Scenario: invoice.payment_failed marks past due

- **WHEN** an `invoice.payment_failed` event is received
- **THEN** the system SHALL update the subscription status to `"past_due"`

#### Scenario: Duplicate event is handled idempotently

- **WHEN** a Stripe event with an ID that has already been processed is received
- **THEN** the handler SHALL return 200 OK without making any changes

#### Scenario: Invalid webhook signature is rejected

- **WHEN** a request to `/api/stripe/webhook` has an invalid signature
- **THEN** the handler SHALL return 400 Bad Request
- **AND** SHALL NOT process the event body

### Requirement: Stripe Customer Portal session

The system SHALL provide a Convex action that creates a Stripe Customer Portal session for self-serve subscription management. The portal SHALL allow customers to update payment methods, view invoices, and cancel their subscription. The action SHALL return the portal URL for client-side redirect.

#### Scenario: Admin or owner accesses customer portal

- **WHEN** a workspace owner or admin requests access to the customer portal
- **AND** the workspace has a `stripeCustomerId`
- **THEN** the system SHALL create a portal session and return the URL

#### Scenario: No Stripe customer exists

- **WHEN** a workspace owner or admin requests portal access
- **AND** the workspace has no `stripeCustomerId` (still on trial)
- **THEN** the action SHALL return an error indicating no billing account exists yet

### Requirement: Webhook endpoint stub in public repo

The public repository SHALL register the `/api/stripe/webhook` route in `http.ts` with a handler that imports from `billing/webhooks.ts`. The public stub version of the webhook handler SHALL return `200 OK` with no processing. The private overlay SHALL replace this stub with the full Stripe event handler.

#### Scenario: Self-hosted webhook endpoint returns 200

- **WHEN** a POST request is made to `/api/stripe/webhook` on a self-hosted deployment
- **THEN** the endpoint SHALL return 200 OK with an empty response body

#### Scenario: Hosted webhook processes events

- **WHEN** a POST request is made to `/api/stripe/webhook` on the hosted deployment (with overlay)
- **THEN** the endpoint SHALL verify the signature and process the Stripe event

### Requirement: Stripe Price ID configuration via environment variables

The system SHALL read Stripe configuration from environment variables: `STRIPE_STARTER_PRICE_USD`, `STRIPE_STARTER_PRICE_GBP`, `STRIPE_PRO_PRICE_USD`, `STRIPE_PRO_PRICE_GBP`, `STRIPE_EMAIL_METERED_PRICE`, `STRIPE_SEAT_METERED_PRICE`, `STRIPE_RESTRICTED_ACCESS_KEY`. AI token metering is handled by the Vercel AI Gateway via the `token-billing-tokens` billing meter and does not require a Price ID env var. The Checkout session creation action SHALL select the correct Price ID based on the requested plan and currency.

#### Scenario: Correct price ID used for Pro GBP

- **WHEN** a workspace owner selects Pro plan with GBP currency
- **THEN** the Checkout session SHALL use the price ID from `STRIPE_PRO_PRICE_GBP`

#### Scenario: Missing price ID throws error

- **WHEN** a Checkout session is requested
- **AND** the required price ID environment variable is not set
- **THEN** the action SHALL throw a configuration error

### Requirement: AI Gateway Stripe billing integration

When generating AI responses for workspaces with active paid subscriptions (with a `stripeCustomerId`), the AI agent actions SHALL pass `stripe-customer-id` and `stripe-restricted-access-key` headers to the Vercel AI Gateway. The current AI client is created via `createAIClient()` in `packages/convex/convex/lib/aiGateway.ts` using `createOpenAI()` from `@ai-sdk/openai`. This function SHALL be extended to accept optional Stripe billing headers, which are passed through the `headers` option of `createOpenAI()`. The `generateResponse` action in `aiAgentActions.ts` SHALL look up the workspace's subscription to obtain the `stripeCustomerId` before creating the AI client. The gateway SHALL automatically emit meter events to Stripe's `token-billing-tokens` billing meter for input and output tokens. This metering is non-blocking — if meter events fail, the AI response SHALL still be returned. The `STRIPE_RESTRICTED_ACCESS_KEY` environment variable SHALL contain a Stripe restricted key (`rk_...`) with only meter event write permissions.

#### Scenario: Paid workspace AI request includes Stripe headers

- **WHEN** an AI response is generated for a workspace with an active paid subscription
- **THEN** the request to the AI Gateway SHALL include `stripe-customer-id` with the workspace's Stripe customer ID
- **AND** `stripe-restricted-access-key` with the restricted access key from environment

#### Scenario: Trial workspace AI request omits Stripe headers

- **WHEN** an AI response is generated for a workspace on trial (no Stripe customer)
- **THEN** the request to the AI Gateway SHALL NOT include Stripe billing headers

#### Scenario: Self-hosted AI request omits Stripe headers

- **WHEN** an AI response is generated on a self-hosted deployment
- **THEN** the request to the AI Gateway SHALL NOT include Stripe billing headers

### Requirement: Subscription mutations in private overlay

The private overlay SHALL provide Convex mutations for subscription lifecycle management: creating a subscription from Stripe webhook data, updating subscription state on plan changes, handling cancellation, and processing payment failures. These mutations SHALL be called by the webhook handler and SHALL update the `subscriptions` table.

#### Scenario: Webhook creates subscription on checkout completion

- **WHEN** the webhook handler processes a `checkout.session.completed` event
- **THEN** it SHALL call a mutation to update the subscription record with Stripe IDs, active status, and period dates

#### Scenario: Webhook updates subscription on renewal

- **WHEN** the webhook handler processes a `customer.subscription.updated` event with a new period
- **THEN** it SHALL call a mutation to update `currentPeriodStart`, `currentPeriodEnd`, and reset applicable usage records for the new period
