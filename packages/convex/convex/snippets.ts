import { v } from "convex/values";
import { internal } from "./_generated/api";
import { authMutation, authQuery } from "./lib/authWrappers";

export const create = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    content: v.string(),
    shortcut: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
  },
  permission: "snippets.manage",
  handler: async (ctx, args) => {
    if (args.createdBy && args.createdBy !== ctx.user._id) {
      throw new Error("Cannot create snippet on behalf of another user");
    }

    const now = Date.now();

    if (args.shortcut) {
      const existing = await ctx.db
        .query("snippets")
        .withIndex("by_shortcut", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("shortcut", args.shortcut)
        )
        .first();
      if (existing) {
        throw new Error("Shortcut already exists");
      }
    }

    const snippetId = await ctx.db.insert("snippets", {
      workspaceId: args.workspaceId,
      name: args.name,
      content: args.content,
      shortcut: args.shortcut,
      createdAt: now,
      updatedAt: now,
      createdBy: args.createdBy,
    });

    await ctx.scheduler.runAfter(0, internal.embeddings.generateInternal, {
      workspaceId: args.workspaceId,
      contentType: "snippet",
      contentId: snippetId,
      title: args.name,
      content: args.content,
    });

    return snippetId;
  },
});

export const update = authMutation({
  args: {
    id: v.id("snippets"),
    name: v.optional(v.string()),
    content: v.optional(v.string()),
    shortcut: v.optional(v.string()),
    folderId: v.optional(v.id("contentFolders")),
  },
  permission: "snippets.manage",
  resolveWorkspaceId: async (ctx, args) => {
    const snippet = await ctx.db.get(args.id);
    return snippet?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const snippet = await ctx.db.get(args.id);
    if (!snippet) {
      throw new Error("Snippet not found");
    }

    if (args.shortcut !== undefined && args.shortcut !== snippet.shortcut) {
      const existing = await ctx.db
        .query("snippets")
        .withIndex("by_shortcut", (q) =>
          q.eq("workspaceId", snippet.workspaceId).eq("shortcut", args.shortcut)
        )
        .first();
      if (existing && existing._id !== args.id) {
        throw new Error("Shortcut already exists");
      }
    }

    const updates: {
      name?: string;
      content?: string;
      shortcut?: string;
      folderId?: typeof args.folderId;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.content !== undefined) {
      updates.content = args.content;
    }
    if (args.shortcut !== undefined) {
      updates.shortcut = args.shortcut;
    }
    if (args.folderId !== undefined) {
      updates.folderId = args.folderId;
    }

    await ctx.db.patch(args.id, updates);

    if (args.name !== undefined || args.content !== undefined) {
      await ctx.scheduler.runAfter(0, internal.embeddings.generateInternal, {
        workspaceId: snippet.workspaceId,
        contentType: "snippet",
        contentId: args.id,
        title: args.name ?? snippet.name,
        content: args.content ?? snippet.content,
      });
    }

    return args.id;
  },
});

export const remove = authMutation({
  args: {
    id: v.id("snippets"),
  },
  permission: "snippets.manage",
  resolveWorkspaceId: async (ctx, args) => {
    const snippet = await ctx.db.get(args.id);
    return snippet?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const snippet = await ctx.db.get(args.id);
    if (!snippet) {
      throw new Error("Snippet not found");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const get = authQuery({
  args: {
    id: v.id("snippets"),
  },
  permission: "snippets.manage",
  resolveWorkspaceId: async (ctx, args) => {
    const snippet = await ctx.db.get(args.id);
    return snippet?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const list = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  permission: "snippets.manage",
  handler: async (ctx, args) => {
    const snippets = await ctx.db
      .query("snippets")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return snippets.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const search = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
  },
  permission: "snippets.manage",
  handler: async (ctx, args) => {
    const searchTerm = args.query.toLowerCase();

    const snippets = await ctx.db
      .query("snippets")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return snippets
      .filter(
        (snippet) =>
          snippet.name.toLowerCase().includes(searchTerm) ||
          (snippet.shortcut && snippet.shortcut.toLowerCase().includes(searchTerm)) ||
          snippet.content.toLowerCase().includes(searchTerm)
      )
      .slice(0, 20);
  },
});

export const getByShortcut = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    shortcut: v.string(),
  },
  permission: "snippets.manage",
  handler: async (ctx, args) => {
    return await ctx.db
      .query("snippets")
      .withIndex("by_shortcut", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("shortcut", args.shortcut)
      )
      .first();
  },
});
