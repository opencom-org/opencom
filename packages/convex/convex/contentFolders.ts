import { v } from "convex/values";
import { authMutation, authQuery } from "./lib/authWrappers";

export const create = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    parentId: v.optional(v.id("contentFolders")),
  },
  permission: "articles.create",
  handler: async (ctx, args) => {
    const now = Date.now();

    // Validate parent folder exists if provided
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent || parent.workspaceId !== args.workspaceId) {
        throw new Error("Parent folder not found");
      }
    }

    // Get max order for siblings
    const siblings = await ctx.db
      .query("contentFolders")
      .withIndex("by_parent", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("parentId", args.parentId)
      )
      .collect();
    const maxOrder = siblings.reduce((max, f) => Math.max(max, f.order), 0);

    const folderId = await ctx.db.insert("contentFolders", {
      workspaceId: args.workspaceId,
      name: args.name,
      parentId: args.parentId,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    });

    return folderId;
  },
});

export const update = authMutation({
  args: {
    id: v.id("contentFolders"),
    name: v.optional(v.string()),
    parentId: v.optional(v.id("contentFolders")),
  },
  permission: "articles.create",
  resolveWorkspaceId: async (ctx, args) => {
    const folder = await ctx.db.get(args.id);
    return folder?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.id);
    if (!folder) {
      throw new Error("Folder not found");
    }

    const updates: {
      name?: string;
      parentId?: typeof args.parentId;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updates.name = args.name;
    }

    if (args.parentId !== undefined) {
      // Prevent circular reference
      if (args.parentId === args.id) {
        throw new Error("Folder cannot be its own parent");
      }

      // Check if new parent would create a cycle
      if (args.parentId) {
        let current = await ctx.db.get(args.parentId);
        while (current?.parentId) {
          if (current.parentId === args.id) {
            throw new Error("Cannot move folder into its own descendant");
          }
          current = await ctx.db.get(current.parentId);
        }
      }

      updates.parentId = args.parentId;
    }

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

export const remove = authMutation({
  args: {
    id: v.id("contentFolders"),
    moveContentsTo: v.optional(v.id("contentFolders")),
  },
  permission: "articles.create",
  resolveWorkspaceId: async (ctx, args) => {
    const folder = await ctx.db.get(args.id);
    return folder?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.id);
    if (!folder) {
      throw new Error("Folder not found");
    }

    // Get all child folders
    const childFolders = await ctx.db
      .query("contentFolders")
      .withIndex("by_parent", (q) =>
        q.eq("workspaceId", folder.workspaceId).eq("parentId", args.id)
      )
      .collect();

    // Move or delete child folders
    for (const child of childFolders) {
      if (args.moveContentsTo) {
        await ctx.db.patch(child._id, { parentId: args.moveContentsTo });
      } else {
        // Recursively delete child folders
        await ctx.db.delete(child._id);
      }
    }

    // Move content in this folder to target folder or root
    const articles = await ctx.db
      .query("articles")
      .withIndex("by_folder", (q) => q.eq("folderId", args.id))
      .collect();
    for (const article of articles) {
      await ctx.db.patch(article._id, { folderId: args.moveContentsTo });
    }

    const internalArticles = await ctx.db
      .query("internalArticles")
      .withIndex("by_folder", (q) => q.eq("folderId", args.id))
      .collect();
    for (const article of internalArticles) {
      await ctx.db.patch(article._id, { folderId: args.moveContentsTo });
    }

    const snippets = await ctx.db
      .query("snippets")
      .withIndex("by_folder", (q) => q.eq("folderId", args.id))
      .collect();
    for (const snippet of snippets) {
      await ctx.db.patch(snippet._id, { folderId: args.moveContentsTo });
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const list = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    parentId: v.optional(v.id("contentFolders")),
  },
  permission: "articles.read",
  handler: async (ctx, args) => {
    const folders = await ctx.db
      .query("contentFolders")
      .withIndex("by_parent", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("parentId", args.parentId)
      )
      .collect();

    return folders.sort((a, b) => a.order - b.order);
  },
});

export const listTree = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  permission: "articles.read",
  handler: async (ctx, args) => {
    const allFolders = await ctx.db
      .query("contentFolders")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    // Build tree structure
    type FolderNode = (typeof allFolders)[0] & { children: FolderNode[] };
    const folderMap = new Map<string, FolderNode>();

    // Initialize all folders with empty children array
    for (const folder of allFolders) {
      folderMap.set(folder._id, { ...folder, children: [] });
    }

    // Build tree
    const rootFolders: FolderNode[] = [];
    for (const folder of allFolders) {
      const node = folderMap.get(folder._id)!;
      if (folder.parentId) {
        const parent = folderMap.get(folder.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          rootFolders.push(node);
        }
      } else {
        rootFolders.push(node);
      }
    }

    // Sort children by order
    const sortChildren = (nodes: FolderNode[]) => {
      nodes.sort((a, b) => a.order - b.order);
      for (const node of nodes) {
        sortChildren(node.children);
      }
    };
    sortChildren(rootFolders);

    return rootFolders;
  },
});

export const get = authQuery({
  args: {
    id: v.id("contentFolders"),
  },
  permission: "articles.read",
  allowMissingWorkspace: true,
  resolveWorkspaceId: async (ctx, args) => {
    const folder = await ctx.db.get(args.id);
    return folder?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const reorder = authMutation({
  args: {
    id: v.id("contentFolders"),
    newOrder: v.number(),
  },
  permission: "articles.create",
  resolveWorkspaceId: async (ctx, args) => {
    const folder = await ctx.db.get(args.id);
    return folder?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.id);
    if (!folder) {
      throw new Error("Folder not found");
    }

    const oldOrder = folder.order;
    if (oldOrder === args.newOrder) {
      return args.id;
    }

    // Get siblings
    const siblings = await ctx.db
      .query("contentFolders")
      .withIndex("by_parent", (q) =>
        q.eq("workspaceId", folder.workspaceId).eq("parentId", folder.parentId)
      )
      .collect();

    // Update orders
    for (const sibling of siblings) {
      if (sibling._id === args.id) continue;

      let newSiblingOrder = sibling.order;
      if (oldOrder < args.newOrder) {
        // Moving down: shift items between old and new position up
        if (sibling.order > oldOrder && sibling.order <= args.newOrder) {
          newSiblingOrder = sibling.order - 1;
        }
      } else {
        // Moving up: shift items between new and old position down
        if (sibling.order >= args.newOrder && sibling.order < oldOrder) {
          newSiblingOrder = sibling.order + 1;
        }
      }

      if (newSiblingOrder !== sibling.order) {
        await ctx.db.patch(sibling._id, { order: newSiblingOrder });
      }
    }

    await ctx.db.patch(args.id, { order: args.newOrder, updatedAt: Date.now() });
    return args.id;
  },
});

export const getBreadcrumbs = authQuery({
  args: {
    id: v.id("contentFolders"),
  },
  permission: "articles.read",
  resolveWorkspaceId: async (ctx, args) => {
    const folder = await ctx.db.get(args.id);
    return folder?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const breadcrumbs: { id: string; name: string }[] = [];
    let current = await ctx.db.get(args.id);

    while (current) {
      breadcrumbs.unshift({ id: current._id, name: current.name });
      if (current.parentId) {
        current = await ctx.db.get(current.parentId);
      } else {
        break;
      }
    }

    return breadcrumbs;
  },
});
