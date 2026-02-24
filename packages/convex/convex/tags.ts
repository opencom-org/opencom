import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthenticatedUserFromSession } from "./auth";
import { hasPermission, requirePermission } from "./permissions";

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }
    const canRead = await hasPermission(ctx, user._id, args.workspaceId, "conversations.read");
    if (!canRead) {
      return [];
    }

    return await ctx.db
      .query("tags")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const get = query({
  args: {
    id: v.id("tags"),
  },
  handler: async (ctx, args) => {
    const tag = await ctx.db.get(args.id);
    if (!tag) {
      return null;
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return null;
    }
    const canRead = await hasPermission(ctx, user._id, tag.workspaceId, "conversations.read");
    if (!canRead) {
      return null;
    }

    return tag;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, args.workspaceId, "checklists.manage");

    const existing = await ctx.db
      .query("tags")
      .withIndex("by_workspace_name", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("name", args.name)
      )
      .first();

    if (existing) {
      throw new Error(`Tag "${args.name}" already exists`);
    }

    const now = Date.now();
    return await ctx.db.insert("tags", {
      workspaceId: args.workspaceId,
      name: args.name,
      color: args.color,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("tags"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tag = await ctx.db.get(args.id);
    if (!tag) {
      throw new Error("Tag not found");
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, tag.workspaceId, "checklists.manage");

    if (args.name !== undefined && args.name !== tag.name) {
      const newName = args.name;
      const existing = await ctx.db
        .query("tags")
        .withIndex("by_workspace_name", (q) =>
          q.eq("workspaceId", tag.workspaceId).eq("name", newName)
        )
        .first();

      if (existing) {
        throw new Error(`Tag "${args.name}" already exists`);
      }
    }

    await ctx.db.patch(args.id, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.color !== undefined && { color: args.color }),
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

export const remove = mutation({
  args: {
    id: v.id("tags"),
  },
  handler: async (ctx, args) => {
    const tag = await ctx.db.get(args.id);
    if (!tag) {
      throw new Error("Tag not found");
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, tag.workspaceId, "checklists.manage");

    // Remove all conversation tags first
    const conversationTags = await ctx.db
      .query("conversationTags")
      .withIndex("by_tag", (q) => q.eq("tagId", args.id))
      .collect();

    for (const ct of conversationTags) {
      await ctx.db.delete(ct._id);
    }

    // Remove auto-tag rules that use this tag
    const autoTagRules = await ctx.db
      .query("autoTagRules")
      .filter((q) => q.eq(q.field("tagId"), args.id))
      .collect();

    for (const rule of autoTagRules) {
      await ctx.db.delete(rule._id);
    }

    await ctx.db.delete(args.id);
  },
});

export const addToConversation = mutation({
  args: {
    conversationId: v.id("conversations"),
    tagId: v.id("tags"),
    appliedBy: v.optional(v.union(v.literal("manual"), v.literal("auto"))),
    appliedByUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const tag = await ctx.db.get(args.tagId);
    if (!tag) {
      throw new Error("Tag not found");
    }
    if (tag.workspaceId !== conversation.workspaceId) {
      throw new Error("Tag and conversation belong to different workspaces");
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, conversation.workspaceId, "conversations.assign");

    if (args.appliedByUserId && args.appliedByUserId !== user._id) {
      throw new Error("Cannot apply tag on behalf of another user");
    }

    const existing = await ctx.db
      .query("conversationTags")
      .withIndex("by_conversation_tag", (q) =>
        q.eq("conversationId", args.conversationId).eq("tagId", args.tagId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("conversationTags", {
      conversationId: args.conversationId,
      tagId: args.tagId,
      appliedBy: args.appliedBy ?? "manual",
      appliedByUserId: args.appliedByUserId ?? user._id,
      createdAt: Date.now(),
    });
  },
});

export const removeFromConversation = mutation({
  args: {
    conversationId: v.id("conversations"),
    tagId: v.id("tags"),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    const tag = await ctx.db.get(args.tagId);
    if (!tag) {
      throw new Error("Tag not found");
    }
    if (tag.workspaceId !== conversation.workspaceId) {
      throw new Error("Tag and conversation belong to different workspaces");
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, conversation.workspaceId, "conversations.assign");

    const existing = await ctx.db
      .query("conversationTags")
      .withIndex("by_conversation_tag", (q) =>
        q.eq("conversationId", args.conversationId).eq("tagId", args.tagId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getConversationTags = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return [];
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }
    const canRead = await hasPermission(
      ctx,
      user._id,
      conversation.workspaceId,
      "conversations.read"
    );
    if (!canRead) {
      return [];
    }

    const conversationTags = await ctx.db
      .query("conversationTags")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    const tags = await Promise.all(
      conversationTags.map(async (ct) => {
        const tag = await ctx.db.get(ct.tagId);
        return tag
          ? {
              ...tag,
              appliedBy: ct.appliedBy,
              appliedByUserId: ct.appliedByUserId,
              appliedAt: ct.createdAt,
            }
          : null;
      })
    );

    return tags.filter((t) => t !== null);
  },
});
