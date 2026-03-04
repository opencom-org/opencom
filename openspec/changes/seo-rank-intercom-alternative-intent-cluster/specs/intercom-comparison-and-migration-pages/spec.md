## ADDED Requirements

### Requirement: Landing app MUST provide a deep Intercom comparison route
The landing app SHALL publish `/compare/intercom/` with a structured, source-backed comparison of Opencom and Intercom across core buyer decision dimensions.

#### Scenario: Comparison dimensions are comprehensive
- **WHEN** `/compare/intercom/` is rendered
- **THEN** it SHALL include comparison rows for feature coverage, deployment models, data ownership/governance, extensibility, and pricing model structure

#### Scenario: Claims are evidence-backed and status-labeled
- **WHEN** a comparison claim is shown on `/compare/intercom/`
- **THEN** the claim SHALL be backed by a referenced source set used by Opencom's internal competitive analysis
- **AND** capability status SHALL be labeled as "available now" or "roadmap" where parity is incomplete

### Requirement: Landing app MUST provide a crawlable migration route
The landing app SHALL publish `/migrate-from-intercom/` with practical migration guidance for evaluation-stage and implementation-stage visitors.

#### Scenario: Migration guide includes execution detail
- **WHEN** `/migrate-from-intercom/` is rendered
- **THEN** it SHALL include phased migration steps covering prerequisite audit, pilot rollout, and full cutover
- **AND** each phase SHALL state expected deliverables and ownership

#### Scenario: Migration guide includes time and risk framing
- **WHEN** a visitor reads the migration guide
- **THEN** the page SHALL include indicative timeline ranges for common deployment tracks
- **AND** the page SHALL include a risks/gotchas section with mitigation guidance

### Requirement: Trust pages MUST connect to product and onboarding CTAs
Comparison and migration routes SHALL provide clear next-step paths without forcing navigation back to the homepage.

#### Scenario: Visitors can continue evaluation immediately
- **WHEN** a visitor reaches the end of `/compare/intercom/` or `/migrate-from-intercom/`
- **THEN** the page SHALL present links to hosted onboarding and implementation documentation
- **AND** the page SHALL include at least one internal link to another Intercom intent-cluster route
