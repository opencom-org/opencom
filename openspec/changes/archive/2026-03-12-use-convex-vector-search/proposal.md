## Why

Currently, the AI agent retrieves knowledge by loading all articles in a workspace into memory and performing a basic string-matching relevance score (`calculateRelevanceScore`) on every query. While it doesn't pass the entire knowledge base into the prompt (it limits to the top 5 results), the process of loading and scoring every article in memory on every request is highly inefficient and causes significant latency, especially as the knowledge base grows. We need a proper Vector RAG solution to improve response times and relevance.

## What Changes

- Refactor `aiAgentActions.ts` and `aiAgent.ts` to utilize the existing `contentEmbeddings` table and Convex Vector Search instead of the legacy in-memory matching.
- Remove the legacy string-matching algorithms.

## Capabilities

### Modified Capabilities
- `ai-agent-knowledge-retrieval`: Changing the underlying retrieval mechanism from in-memory string matching to vector search.

## Impact

- **Convex Backend**: `packages/convex/convex/aiAgent.ts` and `packages/convex/convex/aiAgentActions.ts` will be updated to use Convex Vector Search.
- **Performance**: Significant reduction in AI agent response latency.
