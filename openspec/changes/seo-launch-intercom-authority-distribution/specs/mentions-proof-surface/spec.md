## ADDED Requirements

### Requirement: Landing app MUST expose a crawlable mentions proof route
The landing app SHALL publish a crawlable mentions page that consolidates verified third-party placements and references.

#### Scenario: Mentions route renders verified entries
- **WHEN** `/mentions/` is rendered
- **THEN** it SHALL list only verified third-party mentions with source link, publication name, and publication date when known

#### Scenario: Mentions route exposes recency context
- **WHEN** the mentions page is viewed
- **THEN** it SHALL display a "last updated" timestamp for the mentions dataset

### Requirement: Mentions proof route MUST reinforce SEO cluster navigation
The mentions page SHALL route users back to core conversion pages in the Intercom cluster.

#### Scenario: Users can continue evaluation from mentions
- **WHEN** a visitor scans a mention entry
- **THEN** the page SHALL provide internal links to `/intercom-alternative/` and `/compare/intercom/`
- **AND** at least one call-to-action to hosted onboarding or docs SHALL be present
