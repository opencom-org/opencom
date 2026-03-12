## MODIFIED Requirements

### Requirement: AI Agent retrieves knowledge context
The system SHALL retrieve relevant knowledge context to answer customer questions using vector similarity search.

#### Scenario: AI Agent answers a question
- **WHEN** a customer asks a question
- **THEN** the AI Agent retrieves the top 5 most semantically similar knowledge items (articles/snippets) using vector search and uses them as context to generate an answer

## REMOVED Requirements

### Requirement: In-memory string matching for relevance score
**Reason**: Replaced by vector similarity search for improved performance and scalability.
**Migration**: Use the new vector search capability provided by `@mastra/convex`.
