import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { embed } from "ai";
import { createAIClient } from "./lib/aiGateway";
import { makeFunctionReference } from "convex/server";

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

export const knowledgeSourceValidator = v.union(
  v.literal("articles"),
  v.literal("internalArticles"),
  v.literal("snippets")
);

type SuggestionContentType = "article" | "internalArticle" | "snippet";
type SuggestionContentRecord = { content: string; title: string } | null;

const GET_CONTENT_BY_ID_REF = makeFunctionReference<
  "query",
  { contentType: SuggestionContentType; contentId: string },
  SuggestionContentRecord
>("suggestions:getContentById") as unknown as any; // Using any for local ref casting

export const getRelevantKnowledgeForRuntimeAction = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    knowledgeSources: v.optional(v.array(knowledgeSourceValidator)),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const aiClient = createAIClient();
    
    // 1. Embed the query
    const { embedding } = await embed({
      model: aiClient.embedding(DEFAULT_EMBEDDING_MODEL),
      value: args.query,
    });

    const limit = args.limit ?? 5;

    // 2. Vector search
    const results = await ctx.vectorSearch("contentEmbeddings", "by_embedding", {
      vector: embedding,
      limit: limit * 2,
      filter: (q) => q.eq("workspaceId", args.workspaceId),
    });

    // 3. Filter by knowledge sources
    let filteredResults = results;
    if (args.knowledgeSources && args.knowledgeSources.length > 0) {
      const sourceSet = new Set(args.knowledgeSources.map(s => s === "articles" ? "article" : s === "internalArticles" ? "internalArticle" : s));
      filteredResults = results.filter((r: any) => {
        return sourceSet.has(r.contentType);
      });
    }

    const topResults = filteredResults.slice(0, limit);

    // 4. Fetch the actual content since vectorSearch only returns _id and _score
    const enrichedResults = await Promise.all(
      topResults.map(async (result: any) => {
        const content = await ctx.runQuery(GET_CONTENT_BY_ID_REF, {
          contentType: result.contentType,
          contentId: result.contentId,
        });

        if (!content) return null;

        return {
          id: result.contentId,
          type: result.contentType === "article" ? "article" : result.contentType === "internalArticle" ? "internalArticle" : "snippet",
          title: content.title,
          content: content.content,
          relevanceScore: result._score * 100, // Roughly map vector search score to legacy 0-100 scale
        };
      })
    );

    return enrichedResults.filter((r) => r !== null);
  },
});
