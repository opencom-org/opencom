## ADDED Requirements

### Requirement: The repository MUST maintain deterministic browser coverage for collection management entry and empty-collection CRUD
The automated web test suite SHALL cover the articles collection-management route, route entry from the articles admin surface, and create/edit/delete flows for collections that are safe to mutate within an isolated authenticated workspace.

#### Scenario: Agent opens collection management from articles admin
- **WHEN** an authenticated agent uses the articles admin surface to open collection management
- **THEN** automation SHALL reach the collection-management route successfully
- **AND** the route SHALL expose stable, automatable controls for collection creation and row actions

#### Scenario: Agent creates, edits, and deletes an empty collection
- **WHEN** the automated suite exercises empty-collection CRUD on the collection-management page
- **THEN** it SHALL verify successful creation, visible updates after edit, and visible removal after delete
- **AND** those assertions SHALL not depend on legacy knowledge-folder routes or manual data preconditioning

### Requirement: The repository MUST verify collection hierarchy safety behaviors
The automated coverage for collection management SHALL verify that hierarchy and deletion guardrails remain enforced when agents manage nested collections.

#### Scenario: Agent assigns a parent collection
- **WHEN** an automated test creates nested collections through the collection-management UI
- **THEN** the suite SHALL verify that parent assignment is persisted and rendered in the collection table

#### Scenario: Agent edits a collection's parent options
- **WHEN** an automated test opens the edit flow for an existing collection
- **THEN** the available parent choices SHALL exclude the collection itself and its descendants

#### Scenario: Agent attempts to delete a protected collection
- **WHEN** an automated test or focused web test exercises a delete path for a collection with child collections or assigned articles
- **THEN** the suite SHALL verify the blocking notice shown to the agent
- **AND** the protected collection SHALL remain present after the attempted delete
