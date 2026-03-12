## 1. Setup

- [ ] 1.1 Add `@mastra/convex` to `packages/convex/package.json` dependencies
- [ ] 1.2 Update Convex schema (`packages/convex/convex/schema.ts`) to add vector indices for articles and snippets

## 2. Mastra Integration

- [ ] 2.1 Create a Mastra initialization module (e.g., `packages/convex/convex/mastra.ts`) to configure the Mastra instance with the chosen embedding model
- [ ] 2.2 Implement a backfill script/action to generate embeddings for all existing published articles and snippets

## 3. Data Model Lifecycle Updates

- [ ] 3.1 Update article creation/update/deletion mutations to manage vector embeddings via `@mastra/convex`
- [ ] 3.2 Update snippet creation/update/deletion mutations to manage vector embeddings via `@mastra/convex`

## 4. AI Agent Knowledge Retrieval

- [ ] 4.1 Update `collectRelevantKnowledge` in `packages/convex/convex/aiAgent.ts` to use `@mastra/convex` for vector search instead of the legacy in-memory matching
- [ ] 4.2 Remove the old `calculateRelevanceScore` string-matching algorithm
- [ ] 4.3 Verify that the system prompt and limits remain identical to the previous behavior
