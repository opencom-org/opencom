import { v } from "convex/values";
import { makeFunctionReference, type FunctionReference } from "convex/server";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { embedMany } from "ai";
import { authAction } from "./lib/authWrappers";
import { createAIClient } from "./lib/aiGateway";
import {
  isInternalArticle,
  isPublicArticle,
  listUnifiedArticlesWithLegacyFallback,
} from "./lib/unifiedArticles";

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

type InternalQueryRef<Args extends Record<string, unknown>, Return = unknown> = FunctionReference<
  "query",
  "internal",
  Args,
  Return
>;

type InternalMutationRef<Args extends Record<string, unknown>, Return = unknown> =
  FunctionReference<"mutation", "internal", Args, Return>;

type InternalActionRef<Args extends Record<string, unknown>, Return = unknown> =
  FunctionReference<"action", "internal", Args, Return>;

function getShallowRunQuery(ctx: { runQuery: unknown }) {
  return ctx.runQuery as unknown as <Args extends Record<string, unknown>, Return>(
    queryRef: InternalQueryRef<Args, Return>,
    queryArgs: Args
  ) => Promise<Return>;
}

function getShallowRunMutation(ctx: { runMutation: unknown }) {
  return ctx.runMutation as unknown as <Args extends Record<string, unknown>, Return>(
    mutationRef: InternalMutationRef<Args, Return>,
    mutationArgs: Args
  ) => Promise<Return>;
}

function getShallowRunAction(ctx: { runAction: unknown }) {
  return ctx.runAction as unknown as <Args extends Record<string, unknown>, Return>(
    actionRef: InternalActionRef<Args, Return>,
    actionArgs: Args
  ) => Promise<Return>;
}

type BatchItem = {
  workspaceId: Id<"workspaces">;
  contentType: "article" | "internalArticle" | "snippet";
  contentId: string;
  title: string;
  content: string;
};

type GenerateEmbeddingArgs = {
  workspaceId: Id<"workspaces">;
  contentType: BatchItem["contentType"];
  contentId: string;
  title: string;
  content: string;
  model?: string;
};

type GenerateEmbeddingResult = {
  id: Id<"contentEmbeddings">;
  skipped: boolean;
};

type GenerateBatchArgs = {
  items: BatchItem[];
  model?: string;
};

type GenerateBatchResult = {
  processed: number;
  skipped: number;
};

type GetByContentArgs = {
  contentType: BatchItem["contentType"];
  contentId: string;
};

type InsertEmbeddingArgs = {
  workspaceId: Id<"workspaces">;
  contentType: BatchItem["contentType"];
  contentId: string;
  embedding: number[];
  textHash: string;
  title: string;
  snippet: string;
};

type PermissionForActionArgs = {
  userId: Id<"users">;
  workspaceId: Id<"workspaces">;
  permission: string;
};

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type ListedArticle = {
  _id: string;
  title: string;
  content: string;
};

type ListedSnippet = {
  _id: string;
  name: string;
  content: string;
};

const LIST_BY_CONTENT_REF = makeFunctionReference<
  "query",
  GetByContentArgs,
  Doc<"contentEmbeddings">[]
>("embeddings:listByContent") as unknown as InternalQueryRef<
  GetByContentArgs,
  Doc<"contentEmbeddings">[]
>;

const INSERT_EMBEDDING_REF = makeFunctionReference<
  "mutation",
  InsertEmbeddingArgs,
  Id<"contentEmbeddings">
>("embeddings:insert") as unknown as InternalMutationRef<
  InsertEmbeddingArgs,
  Id<"contentEmbeddings">
>;

const GENERATE_INTERNAL_REF = makeFunctionReference<
  "action",
  GenerateEmbeddingArgs,
  GenerateEmbeddingResult
>("embeddings:generateInternal") as unknown as InternalActionRef<
  GenerateEmbeddingArgs,
  GenerateEmbeddingResult
>;

const REQUIRE_PERMISSION_FOR_ACTION_REF = makeFunctionReference<
  "query",
  PermissionForActionArgs,
  unknown
>("permissions:requirePermissionForAction") as unknown as InternalQueryRef<PermissionForActionArgs>;

const LIST_ARTICLES_REF = makeFunctionReference<"query", WorkspaceArgs, ListedArticle[]>(
  "embeddings:listArticles"
) as unknown as InternalQueryRef<WorkspaceArgs, ListedArticle[]>;

const LIST_INTERNAL_ARTICLES_REF = makeFunctionReference<"query", WorkspaceArgs, ListedArticle[]>(
  "embeddings:listInternalArticles"
) as unknown as InternalQueryRef<WorkspaceArgs, ListedArticle[]>;

const LIST_SNIPPETS_REF = makeFunctionReference<"query", WorkspaceArgs, ListedSnippet[]>(
  "embeddings:listSnippets"
) as unknown as InternalQueryRef<WorkspaceArgs, ListedSnippet[]>;

const REMOVE_EMBEDDINGS_REF = makeFunctionReference<
  "mutation",
  { contentType: BatchItem["contentType"]; contentId: string },
  unknown
>("embeddings:remove") as unknown as InternalMutationRef<{
  contentType: BatchItem["contentType"];
  contentId: string;
}>;

const GENERATE_BATCH_INTERNAL_REF = makeFunctionReference<
  "action",
  GenerateBatchArgs,
  GenerateBatchResult
>("embeddings:generateBatchInternal") as unknown as InternalActionRef<
  GenerateBatchArgs,
  GenerateBatchResult
>;

async function createTextHash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const EMBEDDING_CHUNK_MAX_CHARS = 3000;
const EMBEDDING_CHUNK_OVERLAP_CHARS = 300;

function splitContentIntoChunks(
  content: string,
  maxChars: number = EMBEDDING_CHUNK_MAX_CHARS,
  overlapChars: number = EMBEDDING_CHUNK_OVERLAP_CHARS
): string[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (normalized.length === 0) {
    return [""];
  }
  if (normalized.length <= maxChars) {
    return [normalized];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + maxChars, normalized.length);

    if (end < normalized.length) {
      const window = normalized.slice(start, end);
      const minBreakIndex = Math.floor(maxChars * 0.6);
      const paragraphBreak = window.lastIndexOf("\n\n");
      const lineBreak = window.lastIndexOf("\n");
      const sentenceBreak = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "));
      const bestBreak = [paragraphBreak, lineBreak, sentenceBreak].find((index) => index >= minBreakIndex);
      if (bestBreak !== undefined) {
        end = start + bestBreak + 1;
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    if (end >= normalized.length) {
      break;
    }
    start = Math.max(end - overlapChars, start + 1);
  }

  return chunks.length > 0 ? chunks : [normalized];
}

function createSnippet(content: string, maxLength: number = 200): string {
  const cleaned = content
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength - 3) + "...";
}

export const generateInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    contentType: v.union(v.literal("article"), v.literal("internalArticle"), v.literal("snippet")),
    contentId: v.string(),
    title: v.string(),
    content: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<GenerateEmbeddingResult> => {
    const fullText = `${args.title}\n\n${args.content}`;
    const textHash = await createTextHash(fullText);
    const chunks = splitContentIntoChunks(args.content);

    const runQuery = getShallowRunQuery(ctx);
    const existing = await runQuery(LIST_BY_CONTENT_REF, {
      contentType: args.contentType,
      contentId: args.contentId,
    });

    if (
      existing.length === chunks.length &&
      existing.length > 0 &&
      existing.every((embeddingDoc) => embeddingDoc.textHash === textHash)
    ) {
      return { id: existing[0]._id, skipped: true };
    }

    const modelName = args.model || DEFAULT_EMBEDDING_MODEL;
    const aiClient = createAIClient();
    const chunkTexts = chunks.map((chunk) => `${args.title}\n\n${chunk}`);
    const { embeddings } = await embedMany({
      model: aiClient.embedding(modelName),
      values: chunkTexts,
    });

    const runMutation = getShallowRunMutation(ctx);
    if (existing.length > 0) {
      await runMutation(REMOVE_EMBEDDINGS_REF, {
        contentType: args.contentType,
        contentId: args.contentId,
      });
    }

    const insertedIds: Id<"contentEmbeddings">[] = [];
    for (let index = 0; index < embeddings.length; index += 1) {
      const embedding = embeddings[index];
      const chunk = chunks[index];
      const id = await runMutation(INSERT_EMBEDDING_REF, {
        workspaceId: args.workspaceId,
        contentType: args.contentType,
        contentId: args.contentId,
        embedding,
        textHash,
        title: args.title,
        snippet: createSnippet(chunk),
      });
      insertedIds.push(id);
    }

    if (insertedIds.length === 0) {
      throw new Error("Failed to generate embeddings: no chunks were inserted");
    }

    return { id: insertedIds[0], skipped: false };
  },
});

export const generate = authAction({
  args: {
    workspaceId: v.id("workspaces"),
    contentType: v.union(v.literal("article"), v.literal("internalArticle"), v.literal("snippet")),
    contentId: v.string(),
    title: v.string(),
    content: v.string(),
    model: v.optional(v.string()),
  },
  permission: "articles.read",
  handler: async (ctx, args): Promise<GenerateEmbeddingResult> => {
    const runAction = getShallowRunAction(ctx);
    return await runAction(GENERATE_INTERNAL_REF, {
      workspaceId: args.workspaceId,
      contentType: args.contentType,
      contentId: args.contentId,
      title: args.title,
      content: args.content,
      model: args.model,
    });
  },
});

export const generateBatch = authAction({
  args: {
    items: v.array(
      v.object({
        workspaceId: v.id("workspaces"),
        contentType: v.union(
          v.literal("article"),
          v.literal("internalArticle"),
          v.literal("snippet")
        ),
        contentId: v.string(),
        title: v.string(),
        content: v.string(),
      })
    ),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ processed: number; skipped: number }> => {
    if (args.items.length === 0) {
      return { processed: 0, skipped: 0 };
    }

    const runQuery = getShallowRunQuery(ctx);
    const workspaceIds = [...new Set(args.items.map((item) => item.workspaceId))];
    for (const workspaceId of workspaceIds) {
      await runQuery(REQUIRE_PERMISSION_FOR_ACTION_REF, {
        userId: ctx.user._id,
        workspaceId,
        permission: "articles.read",
      });
    }

    const runAction = getShallowRunAction(ctx);
    let processed = 0;
    let skipped = 0;

    for (const item of args.items) {
      const result = await runAction(GENERATE_INTERNAL_REF, {
        workspaceId: item.workspaceId,
        contentType: item.contentType,
        contentId: item.contentId,
        title: item.title,
        content: item.content,
        model: args.model,
      });
      if (result.skipped) {
        skipped += 1;
      } else {
        processed += 1;
      }
    }

    return { processed, skipped };
  },
});

export const backfillExisting = authAction({
  args: {
    workspaceId: v.id("workspaces"),
    contentTypes: v.optional(
      v.array(v.union(v.literal("article"), v.literal("internalArticle"), v.literal("snippet")))
    ),
    batchSize: v.optional(v.number()),
    model: v.optional(v.string()),
  },
  permission: "articles.read",
  handler: async (ctx, args) => {
    const contentTypes = args.contentTypes || ["article", "internalArticle", "snippet"];
    const batchSize = args.batchSize || 50;
    const runQuery = getShallowRunQuery(ctx);
    const runAction = getShallowRunAction(ctx);

    type ContentItem = {
      workspaceId: Id<"workspaces">;
      contentType: "article" | "internalArticle" | "snippet";
      contentId: string;
      title: string;
      content: string;
    };

    const items: ContentItem[] = [];

    if (contentTypes.includes("article")) {
      const articles = await runQuery(LIST_ARTICLES_REF, {
        workspaceId: args.workspaceId,
      });
      for (const article of articles) {
        items.push({
          workspaceId: args.workspaceId,
          contentType: "article",
          contentId: article._id,
          title: article.title,
          content: article.content,
        });
      }
    }

    if (contentTypes.includes("internalArticle")) {
      const internalArticles = await runQuery(LIST_INTERNAL_ARTICLES_REF, {
        workspaceId: args.workspaceId,
      });
      for (const article of internalArticles) {
        items.push({
          workspaceId: args.workspaceId,
          contentType: "internalArticle",
          contentId: article._id,
          title: article.title,
          content: article.content,
        });
      }
    }

    if (contentTypes.includes("snippet")) {
      const snippets = await runQuery(LIST_SNIPPETS_REF, {
        workspaceId: args.workspaceId,
      });
      for (const snippet of snippets) {
        items.push({
          workspaceId: args.workspaceId,
          contentType: "snippet",
          contentId: snippet._id,
          title: snippet.name,
          content: snippet.content,
        });
      }
    }

    let totalProcessed = 0;
    let totalSkipped = 0;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const result = await runAction(GENERATE_BATCH_INTERNAL_REF, {
        items: batch,
        model: args.model,
      });
      totalProcessed += result.processed;
      totalSkipped += result.skipped;
    }

    return {
      total: items.length,
      processed: totalProcessed,
      skipped: totalSkipped,
    };
  },
});

export const generateBatchInternal = internalAction({
  args: {
    items: v.array(
      v.object({
        workspaceId: v.id("workspaces"),
        contentType: v.union(
          v.literal("article"),
          v.literal("internalArticle"),
          v.literal("snippet")
        ),
        contentId: v.string(),
        title: v.string(),
        content: v.string(),
      })
    ),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ processed: number; skipped: number }> => {
    if (args.items.length === 0) {
      return { processed: 0, skipped: 0 };
    }

    const runAction = getShallowRunAction(ctx);
    let processed = 0;
    let skipped = 0;

    for (const item of args.items) {
      const result = await runAction(GENERATE_INTERNAL_REF, {
        workspaceId: item.workspaceId,
        contentType: item.contentType,
        contentId: item.contentId,
        title: item.title,
        content: item.content,
        model: args.model,
      });
      if (result.skipped) {
        skipped += 1;
      } else {
        processed += 1;
      }
    }

    return { processed, skipped };
  },
});

export const remove = internalMutation({
  args: {
    contentType: v.union(v.literal("article"), v.literal("internalArticle"), v.literal("snippet")),
    contentId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("contentEmbeddings")
      .withIndex("by_content", (q) =>
        q.eq("contentType", args.contentType).eq("contentId", args.contentId)
      )
      .collect();

    for (const embeddingDoc of existing) {
      await ctx.db.delete(embeddingDoc._id);
    }
  },
});

export const getByContent = internalQuery({
  args: {
    contentType: v.union(v.literal("article"), v.literal("internalArticle"), v.literal("snippet")),
    contentId: v.string(),
  },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("contentEmbeddings")
      .withIndex("by_content", (q) =>
        q.eq("contentType", args.contentType).eq("contentId", args.contentId)
      )
      .collect();
    return docs[0] ?? null;
  },
});

export const listByContent = internalQuery({
  args: {
    contentType: v.union(v.literal("article"), v.literal("internalArticle"), v.literal("snippet")),
    contentId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("contentEmbeddings")
      .withIndex("by_content", (q) =>
        q.eq("contentType", args.contentType).eq("contentId", args.contentId)
      )
      .collect();
  },
});

export const insert = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    contentType: v.union(v.literal("article"), v.literal("internalArticle"), v.literal("snippet")),
    contentId: v.string(),
    embedding: v.array(v.float64()),
    textHash: v.string(),
    title: v.string(),
    snippet: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("contentEmbeddings", {
      workspaceId: args.workspaceId,
      contentType: args.contentType,
      contentId: args.contentId,
      embedding: args.embedding,
      textHash: args.textHash,
      title: args.title,
      snippet: args.snippet,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = internalMutation({
  args: {
    id: v.id("contentEmbeddings"),
    embedding: v.array(v.float64()),
    textHash: v.string(),
    title: v.string(),
    snippet: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      embedding: args.embedding,
      textHash: args.textHash,
      title: args.title,
      snippet: args.snippet,
      updatedAt: Date.now(),
    });
  },
});

export const listArticles = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const articles = await listUnifiedArticlesWithLegacyFallback(ctx.db, args.workspaceId);
    return articles.filter((article) => isPublicArticle(article) && article.status === "published");
  },
});

export const listInternalArticles = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const articles = await listUnifiedArticlesWithLegacyFallback(ctx.db, args.workspaceId);
    return articles.filter(
      (article) => isInternalArticle(article) && article.status === "published"
    );
  },
});

export const listSnippets = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    return (await ctx.db
      .query("snippets")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect()) as Doc<"snippets">[];
  },
});
