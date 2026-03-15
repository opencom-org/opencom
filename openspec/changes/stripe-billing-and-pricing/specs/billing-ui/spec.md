## ADDED Requirements

### Requirement: Pricing page on landing site

The landing site SHALL have a `/pricing` page that displays the two plan tiers (Starter and Pro) with prices in both USD and GBP, feature comparisons, and clear CTAs. The page SHALL prominently feature a self-hosting option ("Don't want to pay? Self-host for free"). The page SHALL link to the hosted signup flow for plan selection and to self-hosting documentation.

#### Scenario: Pricing page displays both plans

- **WHEN** a visitor navigates to `/pricing` on the landing site
- **THEN** they SHALL see Starter ($15/mo, £15/mo) and Pro ($45/mo, £45/mo) plans
- **AND** a feature comparison showing what each plan includes
- **AND** a self-host callout section

#### Scenario: Pricing page links to signup

- **WHEN** a visitor clicks a plan CTA on the pricing page
- **THEN** they SHALL be directed to the hosted signup flow

#### Scenario: Pricing page is public

- **WHEN** search engines crawl the landing site
- **THEN** the `/pricing` page SHALL be indexable and contain proper metadata

### Requirement: Trial banner in dashboard

When a workspace is on a trial, the dashboard SHALL display a persistent banner showing the number of trial days remaining and a CTA to choose a plan. The banner SHALL become more prominent (warning style) when 2 or fewer days remain.

#### Scenario: Trial banner shows days remaining

- **WHEN** a user logs into a workspace with 5 trial days remaining
- **THEN** a banner SHALL display "5 days left in your trial" with a "Choose a plan" link

#### Scenario: Trial banner becomes urgent

- **WHEN** a user logs into a workspace with 1 day remaining
- **THEN** the banner SHALL display in a warning/urgent style
- **AND** the message SHALL indicate the trial is ending soon

#### Scenario: No banner for active subscription

- **WHEN** a user logs into a workspace with an active paid subscription
- **THEN** no trial banner SHALL be displayed

#### Scenario: No banner for self-hosted

- **WHEN** a user logs into a self-hosted deployment
- **THEN** no trial banner SHALL be displayed

### Requirement: Restricted state banner in dashboard

When a workspace is in restricted state, the dashboard SHALL display a prominent, non-dismissible banner explaining that the workspace is restricted, why (trial expired / payment failed / canceled), and how to reactivate (choose a plan or update payment method).

#### Scenario: Expired trial restriction banner

- **WHEN** a user logs into a workspace with `status: "expired"`
- **THEN** a non-dismissible banner SHALL display explaining the trial has ended
- **AND** it SHALL include a CTA to choose a plan

#### Scenario: Payment failure restriction banner

- **WHEN** a user logs into a workspace with `status: "past_due"`
- **THEN** a non-dismissible banner SHALL display explaining payment has failed
- **AND** it SHALL include a CTA to update payment method

### Requirement: Upgrade prompts at gated features

When a user on the Starter plan attempts to access a Pro-only feature (AI agent settings, campaign creation, series creation), the UI SHALL display an upgrade prompt explaining that the feature requires the Pro plan and providing a direct link to upgrade.

#### Scenario: AI settings shows upgrade prompt on Starter

- **WHEN** a user on Starter plan navigates to AI agent settings
- **THEN** the settings section SHALL display an upgrade prompt instead of the AI configuration
- **AND** the prompt SHALL include the Pro plan price and a link to billing settings

#### Scenario: Campaign creation shows upgrade prompt on Starter

- **WHEN** a user on Starter plan attempts to create an email campaign
- **THEN** the UI SHALL show an upgrade prompt instead of the campaign creation form

#### Scenario: No upgrade prompt on Pro

- **WHEN** a user on Pro plan navigates to AI agent settings
- **THEN** the AI configuration SHALL display normally with no upgrade prompt

### Requirement: Billing settings section in dashboard (private overlay)

The dashboard settings page SHALL include a billing section visible to users with the `settings.billing` permission (owner and admin roles). On self-hosted deployments, this section SHALL not render. On hosted deployments with the private overlay, it SHALL display: current plan name and status, current billing period dates, usage meters for all metered dimensions (AI credits, emails, seats) with visual progress bars, a button to manage subscription (opens Stripe Customer Portal), and a button to change plan.

#### Scenario: Owner or admin sees billing settings

- **WHEN** a workspace owner or admin views the settings page on a hosted deployment
- **THEN** a billing section SHALL appear showing plan, status, and usage

#### Scenario: Agent or viewer does not see billing settings

- **WHEN** an agent or viewer user views the settings page
- **THEN** the billing section SHALL NOT be visible

#### Scenario: Self-hosted does not show billing settings

- **WHEN** any user views the settings page on a self-hosted deployment
- **THEN** no billing section SHALL appear

#### Scenario: Usage meters show progress

- **WHEN** a workspace owner views billing settings
- **AND** the workspace has used 1500 of 10000 emails
- **THEN** the emails usage meter SHALL show "1,500 / 10,000" with a 15% filled progress bar

### Requirement: Billing settings stub in public repo

The public repository SHALL contain a stub billing settings component that renders nothing (or a minimal "billing not configured" message if billing is enabled but the overlay is missing). The private overlay SHALL replace this stub with the full billing management UI.

#### Scenario: Self-hosted billing stub renders nothing

- **WHEN** the billing settings component is rendered on a self-hosted deployment
- **THEN** it SHALL render nothing (empty fragment)

#### Scenario: Hosted deployment renders full billing UI

- **WHEN** the billing settings component is rendered on a hosted deployment with overlay
- **THEN** it SHALL render the full billing management interface

### Requirement: Settings section integration

The billing settings section SHALL be added to the existing settings section registry (`apps/web/src/app/settings/settingsSections.ts`) as a new `SettingsSectionId` and `SettingsCategoryId`, following the existing pattern for section configuration (id, label, description, category, keywords, priority).

#### Scenario: Billing section appears in settings navigation

- **WHEN** a workspace admin views the settings page on a hosted deployment
- **THEN** a "Billing" section SHALL appear in the settings page navigation
- **AND** it SHALL be expandable and collapsible like other settings sections

#### Scenario: Billing section hidden on self-hosted

- **WHEN** any user views the settings page on a self-hosted deployment
- **THEN** no billing section entry SHALL appear in the settings navigation
