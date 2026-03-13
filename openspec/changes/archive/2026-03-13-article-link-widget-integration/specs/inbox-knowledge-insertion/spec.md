## MODIFIED Requirements

### Requirement: Knowledge picker MUST provide explicit insertion behavior by content type

The consolidated picker SHALL provide insertion actions that match the selected knowledge type: snippets SHALL insert reusable reply content directly, and articles SHALL support explicit article-link insertion or content insertion without forcing agents through a separate surface.

#### Scenario: Agent inserts a snippet from the picker

- **WHEN** an agent selects a snippet result
- **THEN** the snippet content SHALL be inserted into the composer
- **AND** the picker SHALL close with the inserted content ready for editing or sending

#### Scenario: Agent inserts an article link from the picker

- **WHEN** an agent selects an article result and chooses to insert a link
- **THEN** the link SHALL be inserted in the format `[title](article:<articleId>)`
- **AND** the article ID SHALL be included for widget navigation
- **AND** the picker SHALL close with the link ready for sending

#### Scenario: Agent inserts article content from the picker

- **WHEN** an agent selects an article result and chooses to insert content
- **THEN** the article content SHALL be inserted into the composer
- **AND** the picker SHALL close with the inserted content ready for editing or sending
