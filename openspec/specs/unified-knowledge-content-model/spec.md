# unified-knowledge-content-model Specification

## Purpose
TBD - created by archiving change simplify-knowledge-content-management. Update Purpose after archive.
## Requirements
### Requirement: Articles admin MUST manage public and internal articles in one workflow
Opencom SHALL provide a single article management workflow where agents can create, edit, search, filter, publish, archive, and delete both public help articles and internal-only articles without switching to a separate knowledge route.

#### Scenario: Agent creates an internal article from articles admin
- **WHEN** an agent creates a new article from the articles management surface
- **THEN** the workflow SHALL allow the agent to mark the article as `internal`
- **AND** the article SHALL be saved and editable from the same articles admin used for public help articles

#### Scenario: Agent filters a unified article list
- **WHEN** an agent filters the articles list by visibility or status
- **THEN** the list SHALL include both public and internal articles in one result set
- **AND** the filter controls SHALL let the agent narrow results without leaving the articles surface

### Requirement: Article visibility MUST control publication surfaces
Each article SHALL declare explicit visibility of `public` or `internal`. Published public articles SHALL be eligible for help center and widget browse/search surfaces, while published internal articles SHALL remain excluded from visitor-facing surfaces and available only in authenticated agent-facing knowledge workflows.

#### Scenario: Published internal article is hidden from visitor-facing surfaces
- **WHEN** an agent publishes an article with `internal` visibility
- **THEN** the article SHALL be searchable and usable in agent-facing knowledge workflows
- **AND** the article SHALL NOT appear in public help center browse, visitor article search, or widget article listings

#### Scenario: Published public article is visible externally
- **WHEN** an agent publishes an article with `public` visibility
- **THEN** the article SHALL be eligible for public help center and widget article browse/search
- **AND** authenticated agents SHALL still be able to manage that article from the unified articles workflow

### Requirement: AI and agent knowledge retrieval MUST use unified articles with visibility-aware source controls
Agent-facing knowledge search and AI source configuration SHALL query a unified article model and SHALL allow teams to include public articles and internal articles independently without relying on a separate internal-article content source.

#### Scenario: Workspace AI includes only internal articles
- **WHEN** a workspace enables internal articles and disables public articles in AI knowledge settings
- **THEN** AI knowledge retrieval SHALL include published internal articles from the unified article model
- **AND** public articles SHALL be excluded from AI knowledge results for that workspace configuration

#### Scenario: Agent searches knowledge across unified articles
- **WHEN** an authenticated agent runs article-aware knowledge search
- **THEN** the results SHALL include both public and internal articles from the unified article model when both visibilities are enabled
- **AND** each result SHALL preserve enough metadata for the UI to distinguish article visibility

