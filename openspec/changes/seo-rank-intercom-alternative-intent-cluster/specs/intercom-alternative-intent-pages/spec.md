## ADDED Requirements

### Requirement: Landing app MUST provide dedicated Intercom-alternative intent routes
The landing app SHALL expose dedicated routes for high-intent Intercom-alternative queries instead of relying on the homepage only.

#### Scenario: Intent routes are available
- **WHEN** a user requests `/intercom-alternative/`, `/free-intercom-alternatives/`, or `/open-source-intercom-alternative/`
- **THEN** the app SHALL render a first-class page for each route with an HTTP 200 response

#### Scenario: Each route has a single primary intent
- **WHEN** a page in this cluster is rendered
- **THEN** the page SHALL contain one clear H1 aligned to its target query family
- **AND** the introductory copy SHALL focus on that query intent instead of duplicating another page's positioning

### Requirement: Free alternatives route MUST deliver listicle-grade utility
The `/free-intercom-alternatives/` route SHALL provide practical, neutral utility that can compete with third-party listicles.

#### Scenario: Alternatives list includes market coverage
- **WHEN** `/free-intercom-alternatives/` is published
- **THEN** it SHALL include at least eight named alternatives
- **AND** Opencom SHALL be evaluated with the same comparison dimensions as other options

#### Scenario: Comparison methodology is visible
- **WHEN** a visitor reviews the alternatives table
- **THEN** the page SHALL display explicit comparison criteria
- **AND** each "best for" recommendation SHALL include at least one trade-off statement

### Requirement: Open-source Intercom route MUST disambiguate product intent
The `/open-source-intercom-alternative/` route SHALL explicitly target customer messaging intent and disambiguate from unrelated intercom hardware/broadcast contexts.

#### Scenario: Customer messaging intent is explicit
- **WHEN** `/open-source-intercom-alternative/` is rendered
- **THEN** the H1 SHALL include "customer messaging"
- **AND** the intro section SHALL state that the page covers customer support and product messaging software use cases
