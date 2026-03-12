## ADDED Requirements

### Requirement: Vector Similarity Search for Knowledge Retrieval
The system SHALL use `@mastra/convex` to retrieve knowledge base articles and snippets via vector similarity search instead of in-memory string matching.

#### Scenario: User asks a question
- **WHEN** an AI Agent needs context to answer a customer question
- **THEN** it searches the vector database using `@mastra/convex` to find the 5 most semantically similar articles or snippets

### Requirement: Document Embedding Generation
The system SHALL generate vector embeddings for knowledge base articles and snippets when they are created or updated.

#### Scenario: Article is published
- **WHEN** an article changes status to 'published'
- **THEN** an embedding is generated for its content and stored in the vector index

#### Scenario: Snippet is created
- **WHEN** a new snippet is created
- **THEN** an embedding is generated for its content and stored in the vector index

#### Scenario: Content is updated
- **WHEN** a published article or a snippet has its content updated
- **THEN** its corresponding vector embedding is updated

#### Scenario: Article is unpublished or deleted
- **WHEN** an article is unpublished or deleted, or a snippet is deleted
- **THEN** its corresponding vector embedding is removed from the vector index

### Requirement: Historical Data Backfill
The system SHALL provide a method to generate embeddings for all existing published articles and snippets.

#### Scenario: Developer runs backfill script
- **WHEN** the backfill script is executed
- **THEN** embeddings are generated and stored for all existing published articles and snippets without existing embeddings
