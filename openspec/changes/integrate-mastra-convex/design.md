## Context

Currently, the `aiAgent.ts` inside the `packages/convex` workspace relies on an in-memory string-matching approach (`calculateRelevanceScore`) to find relevant articles and snippets for a given query. It loads all articles and snippets in a workspace and loops through them, which is a bottleneck for larger workspaces.

The user has noticed performance degradation and inquired if the whole knowledge base is passed in the prompt. While the prompt only receives the top 5 results, the *retrieval* process requires loading and scanning the entire knowledge base.

To solve this, we will integrate `@mastra/convex` to provide true vector-based Retrieval-Augmented Generation (RAG).

## Goals / Non-Goals

**Goals:**
- Replace the inefficient in-memory string-matching search with vector similarity search.
- Integrate `@mastra/convex` for managing embeddings of `articles` and `snippets`.
- Keep the system prompt and the number of returned results (limit: 5) the same to preserve the current AI behavior.
- Reduce latency for AI responses.

**Non-Goals:**
- We are not changing the AI models used (e.g., OpenAI/Anthropic).
- We are not changing how the UI renders responses.
- We are not modifying the fallback human handoff logic.

## Decisions

1. **Use `@mastra/convex` for Vector Search**: Mastra provides a native integration with Convex for RAG. We will use this to generate and store embeddings for `articles` and `snippets`.
2. **Embedding Generation Lifecycle**: We need to hook into the creation and update mutations for `articles` and `snippets` to generate or update their embeddings. If an article is deleted, its embedding should be removed.
3. **Data Model Updates**: We will add a vector index to the Convex schema to support `@mastra/convex`'s vector search requirements.

## Risks / Trade-offs

- **Risk: Migration of existing data.** Existing articles and snippets will not have embeddings until they are processed.
  - **Mitigation**: We will need a backfill script or a background job to generate embeddings for all existing published articles and snippets in the database.
- **Risk: Cost of Embeddings.** Generating embeddings costs money (e.g., via OpenAI's embedding models).
  - **Mitigation**: Embeddings are relatively cheap, but we should only generate them for `published` articles to save costs.
- **Risk: Increased mutation latency.** Generating an embedding during an article save might slow down the save operation.
  - **Mitigation**: We can generate embeddings asynchronously using a Convex internal action if it becomes an issue, but standard synchronous generation is preferred for consistency unless it blocks the UI.
