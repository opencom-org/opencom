import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { embed, embedMany } from "ai";
import { authAction } from "./lib/authWrappers";
import { createAIClient } from "./lib/aiGateway";
import {
  isInternalArticle,
  isPublicArticle,
  listUnifiedArticlesWithLegacyFallback,
} from "./lib/unifiedArticles";

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

function getInternalRef(name: string): unknown {
  return makeFunctionReference(name);
}

function getShallowRunQuery(ctx: { runQuery: unknown }) {
  return ctx.runQuery as unknown as (
    queryRef: unknown,
    queryArgs: Record<string, unknown>
  ) => Promise<unknown>;
}

function getShallowRunMutation(ctx: { runMutation: unknown }) {
  return ctx.runMutation as unknown as (
    mutationRef: unknown,
    mutationArgs: Record<string, unknown>
  ) => Promise<unknown>;
}

function getShallowRunAction(ctx: { runAction: unknown }) {
  return ctx.runAction as unknown as (
    actionRef: unknown,
    actionArgs: Record<string, unknown>
  ) => Promise<unknown>;
}

type BatchItem = {
  workspaceId: Id<"workspaces">;
  contentType: "article" | "internalArticle" | "snippet";
  contentId: string;
  title: string;
  content: string;
};

type BatchItemWithHash = BatchItem & {
  textToEmbed: string;
  textHash: string;
  snippet: string;
};

async function createTextHash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
  handler: async (ctx, args): Promise<{ id: Id<"contentEmbeddings">; skipped: boolean }> => {
    const textToEmbed = `${args.title}\n\n${args.content}`;
    const textHash = await createTextHash(textToEmbed);

    const runQuery = ctx.runQuery as unknown as (
      queryRef: unknown,
      queryArgs: Record<string, unknown>
    ) => Promise<unknown>;
    const getByContentRef = getInternalRef("embeddings:getByContent");
    const existing = (await runQuery(
      getByContentRef,
      {
        contentType: args.contentType,
        contentId: args.contentId,
      }
    )) as Doc<"contentEmbeddings"> | null;

    if (existing && existing.textHash === textHash) {
      return { id: existing._id, skipped: true };
    }

    const modelName = args.model || DEFAULT_EMBEDDING_MODEL;
    const aiClient = createAIClient();
    const { embedding } = await embed({
      model: aiClient.embedding(modelName),
      value: textToEmbed,
    });

    const snippetText = createSnippet(args.content);
    const runMutation = getShallowRunMutation(ctx);
    const updateEmbeddingRef = getInternalRef("embeddings:update");
    const insertEmbeddingRef = getInternalRef("embeddings:insert");

    if (existing) {
      await runMutation(updateEmbeddingRef, {
        id: existing._id,
        embedding: embedding,
        textHash,
        title: args.title,
        snippet: snippetText,
      });
      return { id: existing._id, skipped: false };
    }

    const id = (await runMutation(insertEmbeddingRef, {
      workspaceId: args.workspaceId,
      contentType: args.contentType,
      contentId: args.contentId,
      embedding: embedding,
      textHash,
      title: args.title,
      snippet: snippetText,
    })) as Id<"contentEmbeddings">;

    return { id, skipped: false };
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
  handler: async (ctx, args): Promise<{ id: Id<"contentEmbeddings">; skipped: boolean }> => {
    const runAction = getShallowRunAction(ctx);
    const generateInternalRef = getInternalRef("embeddings:generateInternal");
    return (await runAction(generateInternalRef, {
      workspaceId: args.workspaceId,
      contentType: args.contentType,
      contentId: args.contentId,
      title: args.title,
      content: args.content,
      model: args.model,
    })) as { id: Id<"contentEmbeddings">; skipped: boolean };
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
      await runQuery(getInternalRef("permissions:requirePermissionForAction"), {
        userId: ctx.user._id,
        workspaceId,
        permission: "articles.read",
      });
    }

    const itemsWithHash: BatchItemWithHash[] = await Promise.all(
      args.items.map(async (item: BatchItem) => ({
        ...item,
        textToEmbed: `${item.title}\n\n${item.content}`,
        textHash: await createTextHash(`${item.title}\n\n${item.content}`),
        snippet: createSnippet(item.content),
      }))
    );

    const existingEmbeddings: (Doc<"contentEmbeddings"> | null)[] = await Promise.all(
      itemsWithHash.map((item: BatchItemWithHash) =>
        runQuery(getInternalRef("embeddings:getByContent"), {
          contentType: item.contentType,
          contentId: item.contentId,
        }) as Promise<Doc<"contentEmbeddings"> | null>
      )
    );

    const itemsToProcess: BatchItemWithHash[] = itemsWithHash.filter(
      (item: BatchItemWithHash, index: number) => {
        const existing: Doc<"contentEmbeddings"> | null = existingEmbeddings[index];
        return !existing || existing.textHash !== item.textHash;
      }
    );

    if (itemsToProcess.length === 0) {
      return { processed: 0, skipped: args.items.length };
    }

    const modelName = args.model || DEFAULT_EMBEDDING_MODEL;
    const aiClient = createAIClient();
    const { embeddings } = await embedMany({
      model: aiClient.embedding(modelName),
      values: itemsToProcess.map((item: BatchItemWithHash) => item.textToEmbed),
    });

    const runMutation = getShallowRunMutation(ctx);
    const updateEmbeddingRef = getInternalRef("embeddings:update");
    const insertEmbeddingRef = getInternalRef("embeddings:insert");

    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      const embedding = embeddings[i];
      const existingIndex = itemsWithHash.findIndex(
        (ih) => ih.contentType === item.contentType && ih.contentId === item.contentId
      );
      const existing = existingEmbeddings[existingIndex];

      if (existing) {
        await runMutation(updateEmbeddingRef, {
          id: existing._id,
          embedding,
          textHash: item.textHash,
          title: item.title,
          snippet: item.snippet,
        });
      } else {
        await runMutation(insertEmbeddingRef, {
          workspaceId: item.workspaceId,
          contentType: item.contentType,
          contentId: item.contentId,
          embedding,
          textHash: item.textHash,
          title: item.title,
          snippet: item.snippet,
        });
      }
    }

    return {
      processed: itemsToProcess.length,
      skipped: args.items.length - itemsToProcess.length,
    };
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
      const articles = (await runQuery(getInternalRef("embeddings:listArticles"), {
        workspaceId: args.workspaceId,
      })) as Array<{ _id: string; title: string; content: string }>;
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
      const internalArticles = (await runQuery(getInternalRef("embeddings:listInternalArticles"), {
        workspaceId: args.workspaceId,
      })) as Array<{ _id: string; title: string; content: string }>;
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
      const snippets = (await runQuery(getInternalRef("embeddings:listSnippets"), {
        workspaceId: args.workspaceId,
      })) as Array<{ _id: string; name: string; content: string }>;
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
      const result = (await runAction(getInternalRef("embeddings:generateBatchInternal"), {
        items: batch,
        model: args.model,
      })) as { processed: number; skipped: number };
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

    const runQuery = getShallowRunQuery(ctx);
    const itemsWithHash: BatchItemWithHash[] = await Promise.all(
      args.items.map(async (item: BatchItem) => ({
        ...item,
        textToEmbed: `${item.title}\n\n${item.content}`,
        textHash: await createTextHash(`${item.title}\n\n${item.content}`),
        snippet: createSnippet(item.content),
      }))
    );

    const existingEmbeddings: (Doc<"contentEmbeddings"> | null)[] = await Promise.all(
      itemsWithHash.map((item: BatchItemWithHash) =>
        runQuery(getInternalRef("embeddings:getByContent"), {
          contentType: item.contentType,
          contentId: item.contentId,
        }) as Promise<Doc<"contentEmbeddings"> | null>
      )
    );

    const itemsToProcess: BatchItemWithHash[] = itemsWithHash.filter(
      (item: BatchItemWithHash, index: number) => {
        const existing: Doc<"contentEmbeddings"> | null = existingEmbeddings[index];
        return !existing || existing.textHash !== item.textHash;
      }
    );

    if (itemsToProcess.length === 0) {
      return { processed: 0, skipped: args.items.length };
    }

    const modelName = args.model || DEFAULT_EMBEDDING_MODEL;
    const aiClient = createAIClient();
    const { embeddings } = await embedMany({
      model: aiClient.embedding(modelName),
      values: itemsToProcess.map((item: BatchItemWithHash) => item.textToEmbed),
    });

    const runMutation = getShallowRunMutation(ctx);
    const updateEmbeddingRef = getInternalRef("embeddings:update");
    const insertEmbeddingRef = getInternalRef("embeddings:insert");

    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      const embedding = embeddings[i];
      const existingIndex = itemsWithHash.findIndex(
        (ih) => ih.contentType === item.contentType && ih.contentId === item.contentId
      );
      const existing = existingEmbeddings[existingIndex];

      if (existing) {
        await runMutation(updateEmbeddingRef, {
          id: existing._id,
          embedding,
          textHash: item.textHash,
          title: item.title,
          snippet: item.snippet,
        });
      } else {
        await runMutation(insertEmbeddingRef, {
          workspaceId: item.workspaceId,
          contentType: item.contentType,
          contentId: item.contentId,
          embedding,
          textHash: item.textHash,
          title: item.title,
          snippet: item.snippet,
        });
      }
    }

    return {
      processed: itemsToProcess.length,
      skipped: args.items.length - itemsToProcess.length,
    };
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
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getByContent = internalQuery({
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
      .first();
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
