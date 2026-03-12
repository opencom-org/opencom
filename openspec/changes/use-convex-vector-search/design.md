## Context

Currently, the `aiAgent.ts` inside the `packages/convex` workspace relies on an in-memory string-matching approach (`calculateRelevanceScore`) to find relevant articles and snippets for a given query. It loads all articles and snippets in a workspace and loops through them, which is a bottleneck for larger workspaces.

However, we already have a `contentEmbeddings` table and `embeddings:generateBatch` in the backend which creates embeddings for articles and snippets using `text-embedding-3-small` and stores them. The widget and suggestions are already using `ctx.vectorSearch` against `contentEmbeddings`. The AI agent should use this same infrastructure.

## Goals / Non-Goals

**Goals:**
- Replace the inefficient in-memory string-matching search with Convex Vector similarity search (`ctx.vectorSearch`).
- Refactor `getRelevantKnowledgeForRuntime` to use the new vector search method.
- Keep the system prompt and the number of returned results (limit: 5) the same to preserve the current AI behavior.
- Reduce latency for AI responses.

**Non-Goals:**
- We are not changing the AI models used (e.g., OpenAI/Anthropic).
- We are not changing how the UI renders responses.
- We are not modifying the fallback human handoff logic.

## Decisions

1. **Use Convex Vector Search**: We will update the AI agent to query the vector search index `by_embedding` on the `contentEmbeddings` table, similar to how `searchForWidget` in `suggestions.ts` works.
2. **Move embedding generation logic to AI Action**: Since vector search requires embedding the query first, we will change `getRelevantKnowledgeForRuntime` from an `internalQuery` to an `internalAction` so it can call the `embed` AI action before running the vector search query.

## Risks / Trade-offs

- **Risk: Embedding Latency.** Generating an embedding for the query adds a small latency (via OpenAI API call), but it will be much faster than loading all articles and string matching in memory.
