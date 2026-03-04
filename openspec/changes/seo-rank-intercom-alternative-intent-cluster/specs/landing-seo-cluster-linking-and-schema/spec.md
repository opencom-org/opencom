## ADDED Requirements

### Requirement: Intercom SEO cluster MUST maintain a deterministic internal-link graph
Cluster pages SHALL link to each other and to supporting evaluation pages so search engines and visitors can traverse the intent set without orphaned routes.

#### Scenario: Core cluster routes are cross-linked
- **WHEN** any Intercom cluster page is rendered
- **THEN** the page SHALL include internal links to at least two other cluster pages
- **AND** `/features` SHALL include a prominent entry point into `/compare/intercom/`

### Requirement: Cluster pages MUST expose unique canonical metadata
Each Intercom cluster route SHALL expose unique title and description metadata aligned to its primary query intent and a canonical URL for that exact route.

#### Scenario: Metadata is query-aligned per route
- **WHEN** metadata is generated for cluster routes
- **THEN** no two cluster routes SHALL share an identical title string
- **AND** each route SHALL publish a canonical path that matches its own URL

### Requirement: FAQ schema MUST only represent visible FAQ content
Any FAQ structured data used by cluster pages SHALL mirror visible on-page FAQ questions and answers.

#### Scenario: FAQ markup parity
- **WHEN** a cluster page includes FAQ JSON-LD
- **THEN** every question and answer in the JSON-LD SHALL be visible in the rendered page content
- **AND** pages without visible FAQ sections SHALL not emit FAQ JSON-LD

### Requirement: Cluster routes MUST be discoverable for crawling
Intercom cluster routes SHALL be included in crawl discovery artifacts.

#### Scenario: Sitemap coverage
- **WHEN** landing sitemap output is generated
- **THEN** all cluster routes SHALL be present in sitemap output

#### Scenario: Robots rules do not block cluster routes
- **WHEN** robots directives are evaluated for production
- **THEN** cluster routes SHALL be indexable and followable by search engines
