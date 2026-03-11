## ADDED Requirements

### Requirement: Inbox MUST provide one consolidated knowledge picker
The inbox composer SHALL expose a single searchable knowledge picker for snippets, public articles, and internal articles instead of separate snippet, article-link, and knowledge search controls.

#### Scenario: Agent searches one picker for mixed knowledge
- **WHEN** an agent opens the inbox knowledge picker and enters a query
- **THEN** the picker SHALL return matching snippets, public articles, and internal articles in one result list
- **AND** each result SHALL display a type label so the agent can distinguish what will be inserted

#### Scenario: Keyboard shortcut opens the consolidated picker
- **WHEN** an agent uses the inbox keyboard shortcut for knowledge lookup
- **THEN** the consolidated knowledge picker SHALL open
- **AND** the inbox composer SHALL not open a separate snippet-only or article-only picker for that action

### Requirement: Knowledge picker MUST provide explicit insertion behavior by content type
The consolidated picker SHALL provide insertion actions that match the selected knowledge type: snippets SHALL insert reusable reply content directly, and articles SHALL support explicit article-link insertion or content insertion without forcing agents through a separate surface.

#### Scenario: Agent inserts a snippet from the picker
- **WHEN** an agent selects a snippet result
- **THEN** the snippet content SHALL be inserted into the composer
- **AND** the picker SHALL close with the inserted content ready for editing or sending

#### Scenario: Agent inserts an article from the picker
- **WHEN** an agent selects an article result
- **THEN** the picker SHALL offer the article insertion action configured for that result type
- **AND** the agent SHALL be able to complete article insertion without opening a separate article search control

### Requirement: Agents MUST complete common snippet workflows without leaving inbox
Agents SHALL be able to create a new snippet from the current draft and update an existing snippet from inbox so routine snippet workflows do not depend on a dedicated snippet screen during active support work.

#### Scenario: Agent saves a draft reply as a new snippet
- **WHEN** an agent chooses to save the current inbox draft as a snippet
- **THEN** the inbox workflow SHALL collect the required snippet metadata
- **AND** the new snippet SHALL become available in subsequent knowledge picker searches without leaving inbox

#### Scenario: Agent updates an existing snippet from inbox
- **WHEN** an agent edits a snippet from inbox after selecting it from the knowledge picker
- **THEN** the workflow SHALL allow the agent to update that snippet's saved content
- **AND** future snippet insertions SHALL use the updated content
