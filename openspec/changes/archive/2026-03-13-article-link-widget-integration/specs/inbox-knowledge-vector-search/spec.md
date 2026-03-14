## ADDED Requirements

### Requirement: Inbox knowledge search MUST use vector search for semantic relevance

The inbox knowledge picker SHALL use vector search with embeddings to find semantically relevant articles, internal articles, and snippets instead of simple text matching.

#### Scenario: Agent searches for knowledge with semantic query

- **WHEN** an agent enters a query in the inbox knowledge picker
- **THEN** the search SHALL use vector embeddings to find semantically relevant content
- **AND** results SHALL be ranked by semantic similarity score

#### Scenario: Vector search returns mixed content types

- **WHEN** vector search finds matching content
- **THEN** results SHALL include articles, internal articles, and snippets
- **AND** each result SHALL include the content type, title, snippet preview, and article ID

### Requirement: Inbox knowledge search MUST filter by workspace

Vector search results SHALL be scoped to the current workspace to prevent cross-workspace data leakage.

#### Scenario: Agent searches within workspace context

- **WHEN** an agent performs a knowledge search
- **THEN** results SHALL only include content from the agent's current workspace
- **AND** the workspace filter SHALL be applied at the vector search level
