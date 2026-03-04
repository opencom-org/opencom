## ADDED Requirements

### Requirement: Authority operations MUST be tracked in a shared status artifact
The repository SHALL include a machine-readable tracker for outreach and directory placement work.

#### Scenario: Tracker captures lifecycle status
- **WHEN** a directory or listicle target is added
- **THEN** the tracker SHALL record target URL, status, owner, and next action date
- **AND** the tracker SHALL support states for not-started, submitted, in-review, live, and rejected

### Requirement: Comparison and alternatives assets MUST follow a refresh cadence
The SEO cluster SHALL include documented refresh rules so ranking pages do not become stale.

#### Scenario: Refresh dates are explicit
- **WHEN** a comparison or alternatives page is published
- **THEN** the associated tracker entry SHALL include a next review date
- **AND** the page content model SHALL expose a visible "last reviewed" timestamp

#### Scenario: Refresh updates are scoped and auditable
- **WHEN** content is refreshed
- **THEN** the update SHALL document what changed in comparison criteria, competitor set, or capability status labels

### Requirement: Authority program MUST define measurable checkpoints
The distribution workflow SHALL define measurable ranking and conversion checkpoints for the Intercom cluster.

#### Scenario: KPI set is complete
- **WHEN** reporting is produced for this program
- **THEN** it SHALL include impressions, clicks, and CTR for target queries
- **AND** it SHALL include at least one conversion-aligned metric from cluster routes
