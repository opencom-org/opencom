import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { getAuthenticatedUserFromSession } from "./auth";
import { hasPermission, requirePermission } from "./permissions";

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const buttons = await ctx.db
      .query("commonIssueButtons")
      .withIndex("by_workspace_order", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    // Enrich with article details if applicable
    const enrichedButtons = await Promise.all(
      buttons.map(async (button) => {
        if (button.action === "article" && button.articleId) {
          const article = (await ctx.db.get(button.articleId)) as Doc<"articles"> | null;
          return {
            ...button,
            article: article
              ? { _id: article._id, title: article.title, slug: article.slug }
              : null,
          };
        }
        return { ...button, article: null };
      })
    );

    return enrichedButtons.filter((b) => b.enabled);
  },
});

export const listAll = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }
    const canRead = await hasPermission(ctx, user._id, args.workspaceId, "settings.workspace");
    if (!canRead) {
      return [];
    }

    const buttons = await ctx.db
      .query("commonIssueButtons")
      .withIndex("by_workspace_order", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const enrichedButtons = await Promise.all(
      buttons.map(async (button) => {
        if (button.action === "article" && button.articleId) {
          const article = (await ctx.db.get(button.articleId)) as Doc<"articles"> | null;
          return {
            ...button,
            article: article
              ? { _id: article._id, title: article.title, slug: article.slug }
              : null,
          };
        }
        return { ...button, article: null };
      })
    );

    return enrichedButtons;
  },
});

export const get = query({
  args: {
    id: v.id("commonIssueButtons"),
  },
  handler: async (ctx, args) => {
    const button = (await ctx.db.get(args.id)) as Doc<"commonIssueButtons"> | null;
    if (!button) {
      return null;
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return null;
    }
    const canRead = await hasPermission(ctx, user._id, button.workspaceId, "settings.workspace");
    if (!canRead) {
      return null;
    }

    return button;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    label: v.string(),
    action: v.union(v.literal("article"), v.literal("start_conversation")),
    articleId: v.optional(v.id("articles")),
    conversationStarter: v.optional(v.string()),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, args.workspaceId, "settings.workspace");

    if (args.action === "article" && !args.articleId) {
      throw new Error("Article ID is required for article action");
    }

    if (args.action === "start_conversation" && !args.conversationStarter) {
      throw new Error("Conversation starter is required for start_conversation action");
    }

    // Get the next order number
    const existingButtons = await ctx.db
      .query("commonIssueButtons")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const maxOrder = existingButtons.reduce((max, b) => Math.max(max, b.order), -1);

    const now = Date.now();
    return await ctx.db.insert("commonIssueButtons", {
      workspaceId: args.workspaceId,
      label: args.label,
      action: args.action,
      articleId: args.articleId,
      conversationStarter: args.conversationStarter,
      order: maxOrder + 1,
      enabled: args.enabled,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("commonIssueButtons"),
    label: v.optional(v.string()),
    action: v.optional(v.union(v.literal("article"), v.literal("start_conversation"))),
    articleId: v.optional(v.id("articles")),
    conversationStarter: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const button = (await ctx.db.get(args.id)) as Doc<"commonIssueButtons"> | null;
    if (!button) {
      throw new Error("Button not found");
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, button.workspaceId, "settings.workspace");

    await ctx.db.patch(args.id, {
      ...(args.label !== undefined && { label: args.label }),
      ...(args.action !== undefined && { action: args.action }),
      ...(args.articleId !== undefined && { articleId: args.articleId }),
      ...(args.conversationStarter !== undefined && {
        conversationStarter: args.conversationStarter,
      }),
      ...(args.enabled !== undefined && { enabled: args.enabled }),
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

export const remove = mutation({
  args: {
    id: v.id("commonIssueButtons"),
  },
  handler: async (ctx, args) => {
    const button = (await ctx.db.get(args.id)) as Doc<"commonIssueButtons"> | null;
    if (!button) {
      throw new Error("Button not found");
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, button.workspaceId, "settings.workspace");

    await ctx.db.delete(args.id);
  },
});

export const reorder = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    buttonIds: v.array(v.id("commonIssueButtons")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, args.workspaceId, "settings.workspace");

    for (const buttonId of args.buttonIds) {
      const button = (await ctx.db.get(buttonId)) as Doc<"commonIssueButtons"> | null;
      if (!button || button.workspaceId !== args.workspaceId) {
        throw new Error("Button does not belong to workspace");
      }
    }

    const now = Date.now();
    for (let i = 0; i < args.buttonIds.length; i++) {
      await ctx.db.patch(args.buttonIds[i], {
        order: i,
        updatedAt: now,
      });
    }
  },
});
