# knowledge-organization-taxonomy Specification

## Purpose
TBD - created by archiving change simplify-knowledge-content-management. Update Purpose after archive.
## Requirements
### Requirement: Collections MUST be the only article organization system
Opencom SHALL organize articles with collections and SHALL NOT require folder assignment for article creation, editing, filtering, import, or browse workflows.

#### Scenario: Agent assigns an article without folders
- **WHEN** an agent creates or edits an article
- **THEN** the workflow SHALL allow assignment to a collection or no collection
- **AND** the workflow SHALL NOT require selecting or maintaining a content folder

#### Scenario: Markdown import organizes articles with collections
- **WHEN** an agent previews or applies an article import
- **THEN** the import workflow SHALL create or update collection assignments for imported articles
- **AND** the import workflow SHALL NOT create or depend on content folders for article organization

### Requirement: Collection navigation MUST be visibility-safe
Admin collection views SHALL show all assigned articles, while visitor-facing collection browse and published article counts SHALL include only published public articles.

#### Scenario: Collection contains public and internal articles
- **WHEN** a collection contains a mix of public and internal articles
- **THEN** the admin collection view SHALL show the full article set
- **AND** public help center and widget collection browse SHALL expose only the published public articles from that collection

#### Scenario: Internal-only collection does not leak into public browse
- **WHEN** a collection contains no published public articles
- **THEN** agents SHALL still be able to use that collection for article organization and filtering
- **AND** visitor-facing collection browse SHALL NOT list that collection

### Requirement: Folder retirement MUST preserve article discoverability and snippet usability
When legacy content folders are retired, article organization SHALL be migrated into collections or root-level placement, and snippets SHALL remain searchable and insertable without depending on folder metadata.

#### Scenario: Legacy folder-backed article remains discoverable after migration
- **WHEN** an existing article that previously relied on a content folder is migrated into the simplified model
- **THEN** the article SHALL remain reachable through unified article search and collection filtering
- **AND** the agent SHALL not need the legacy folder hierarchy to manage that article

#### Scenario: Legacy folder-backed snippet remains usable after folder retirement
- **WHEN** an existing snippet previously assigned to a folder is accessed after folder retirement
- **THEN** the snippet SHALL remain searchable and insertable from inbox workflows
- **AND** the snippet SHALL not require a folder reference to remain usable

