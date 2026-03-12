## 1. Setup Vector Search for AI Agent

- [x] 1.1 Update `getRelevantKnowledgeForRuntime` to be an internal action (or handle embedding in `aiAgentActions.ts`) since it needs to call OpenAI `embed`.
- [x] 1.2 Implement Convex vector search logic in `aiAgentActions.ts` or `aiAgent.ts` querying the `contentEmbeddings` table `by_embedding` index.
- [x] 1.3 Ensure the results are returned in the exact format expected by the `buildSystemPrompt` function.

## 2. Cleanup Legacy Matching

- [x] 2.1 Remove the `calculateRelevanceScore` function and associated `escapeRegex` from `packages/convex/convex/aiAgent.ts`.
- [x] 2.2 Remove the legacy `collectRelevantKnowledge` string matching loop logic.
