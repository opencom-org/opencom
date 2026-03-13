import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { embed } from "ai";
import { createAIClient } from "./lib/aiGateway";
import { makeFunctionReference, type FunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

export const knowledgeSourceValidator = v.union(
  v.literal("articles"),
  v.literal("internalArticles"),
  v.literal("snippets")
);

type SuggestionContentType = "article" | "internalArticle" | "snippet";
type SuggestionContentRecord = { content: string; title: string } | null;
type EmbeddingRecord = {
  contentType: SuggestionContentType;
  contentId: string;
} | null;
type RuntimeKnowledgeResult = {
  id: string;
  type: SuggestionContentType;
  title: string;
  content: string;
  relevanceScore: number;
};
type InternalQueryRef<Args extends Record<string, unknown>, Return = unknown> = FunctionReference<
  "query",
  "internal",
  Args,
  Return
>;

function getShallowRunQuery(ctx: { runQuery: unknown }) {
  return ctx.runQuery as unknown as <Args extends Record<string, unknown>, Return>(
    queryRef: InternalQueryRef<Args, Return>,
    queryArgs: Args
  ) => Promise<Return>;
}

const GET_CONTENT_BY_ID_REF = makeFunctionReference<
  "query",
  { contentType: SuggestionContentType; contentId: string },
  SuggestionContentRecord
>("suggestions:getContentById") as unknown as InternalQueryRef<
  { contentType: SuggestionContentType; contentId: string },
  SuggestionContentRecord
>;

const GET_EMBEDDING_BY_ID_REF = makeFunctionReference<
  "query",
  { id: Id<"contentEmbeddings"> },
  EmbeddingRecord
>("suggestions:getEmbeddingById") as unknown as InternalQueryRef<
  { id: Id<"contentEmbeddings"> },
  EmbeddingRecord
>;

export const getRelevantKnowledgeForRuntimeAction = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    knowledgeSources: v.optional(v.array(knowledgeSourceValidator)),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<RuntimeKnowledgeResult[]> => {
    const aiClient = createAIClient();
    const runQuery = getShallowRunQuery(ctx);

    // 1. Embed the query
    const { embedding } = await embed({
      model: aiClient.embedding(DEFAULT_EMBEDDING_MODEL),
      value: args.query,
    });

    const limit = args.limit ?? 5;

    // 2. Vector search
    const results = await ctx.vectorSearch("contentEmbeddings", "by_embedding", {
      vector: embedding,
      limit: limit * 8,
      filter: (q) => q.eq("workspaceId", args.workspaceId),
    });

    // 3. Fetch full embedding docs to get contentType and filter them
    const docs = await Promise.all(
      results.map(async (r) => {
        const doc = await runQuery(GET_EMBEDDING_BY_ID_REF, { id: r._id });
        if (!doc) return null;
        return { ...doc, _score: r._score };
      })
    );

    let filteredDocs = docs.filter(
      (d): d is NonNullable<(typeof docs)[number]> => d !== null
    );

    if (args.knowledgeSources && args.knowledgeSources.length > 0) {
      const sourceSet = new Set(
        args.knowledgeSources.map((s) =>
          s === "articles"
            ? "article"
            : s === "internalArticles"
              ? "internalArticle"
              : "snippet"
        )
      );
      filteredDocs = filteredDocs.filter((d) => sourceSet.has(d.contentType));
    }

    const dedupedDocs: typeof filteredDocs = [];
    const seen = new Set<string>();
    for (const doc of filteredDocs) {
      const key = `${doc.contentType}:${doc.contentId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      dedupedDocs.push(doc);
      if (dedupedDocs.length >= limit) {
        break;
      }
    }

    // 4. Fetch the actual content
    const enrichedResults = await Promise.all(
      dedupedDocs.map(async (doc) => {
        const content = await runQuery(GET_CONTENT_BY_ID_REF, {
          contentType: doc.contentType,
          contentId: doc.contentId,
        });

        if (!content) return null;

        return {
          id: doc.contentId,
          type:
            doc.contentType === "article"
              ? "article"
              : doc.contentType === "internalArticle"
                ? "internalArticle"
                : "snippet",
          title: content.title,
          content: content.content,
          relevanceScore: doc._score * 100, // Roughly map vector search score to legacy 0-100 scale
        };
      })
    );

    return enrichedResults.filter((r): r is RuntimeKnowledgeResult => r !== null);
  },
});
