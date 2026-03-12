# AI Agent Knowledge Retrieval

## Purpose
Defines how the AI Agent searches for and retrieves relevant knowledge context from the workspace to answer customer questions.

## Requirements

### Requirement: AI Agent retrieves knowledge context
The system SHALL retrieve relevant knowledge context to answer customer questions using vector similarity search.

#### Scenario: AI Agent answers a question
- **WHEN** a customer asks a question
- **THEN** the AI Agent retrieves the top 5 most semantically similar knowledge items (articles/snippets) using vector search and uses them as context to generate an answer
