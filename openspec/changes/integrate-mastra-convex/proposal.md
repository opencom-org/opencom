## Why

Currently, the AI agent retrieves knowledge by loading all articles in a workspace into memory and performing a basic string-matching relevance score (`calculateRelevanceScore`) on every query. While it doesn't pass the entire knowledge base into the prompt (it limits to the top 5 results), the process of loading and scoring every article in memory on every request is highly inefficient and causes significant latency, especially as the knowledge base grows. We need a proper Vector RAG solution to improve response times and relevance.

## What Changes

- Integrate `@mastra/convex` to provide true vector-based Retrieval-Augmented Generation (RAG).
- Replace the in-memory `calculateRelevanceScore` string-matching algorithm with Mastra's vector search capabilities.
- Update `collectRelevantKnowledge` in `packages/convex/convex/aiAgent.ts` to utilize Mastra for querying relevant articles and snippets.
- Add vector embeddings generation for articles and snippets when they are created or updated.

## Capabilities

### New Capabilities
- `mastra-rag-integration`: Integrating `@mastra/convex` for vector embeddings and semantic search.

### Modified Capabilities
- `ai-agent-knowledge-retrieval`: Changing the underlying retrieval mechanism from in-memory string matching to vector search.

## Impact

- **Convex Backend**: `packages/convex/convex/aiAgent.ts` and `packages/convex/convex/aiAgentActions.ts` will be updated to use Mastra.
- **Data Model**: Articles and Snippets will likely need vector index fields or companion tables for embeddings as managed by `@mastra/convex`.
- **Dependencies**: Adding `@mastra/convex` and potentially `@mastra/core` to `packages/convex/package.json`.
- **Performance**: Significant reduction in AI agent response latency.
