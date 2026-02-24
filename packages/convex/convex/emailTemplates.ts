import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { authMutation, authQuery } from "./lib/authWrappers";

// Task 2.5: Email template CRUD operations

export const create = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    subject: v.optional(v.string()),
    html: v.string(),
    variables: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
  },
  permission: "settings.workspace",
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("emailTemplates", {
      workspaceId: args.workspaceId,
      name: args.name,
      subject: args.subject,
      html: args.html,
      variables: args.variables,
      category: args.category,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = authMutation({
  args: {
    id: v.id("emailTemplates"),
    name: v.optional(v.string()),
    subject: v.optional(v.string()),
    html: v.optional(v.string()),
    variables: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
  },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const existing = (await ctx.db.get(args.id)) as Doc<"emailTemplates"> | null;
    return existing?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = (await ctx.db.get(id)) as Doc<"emailTemplates"> | null;
    if (!existing) throw new Error("Template not found");

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return id;
  },
});

export const remove = authMutation({
  args: { id: v.id("emailTemplates") },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const existing = (await ctx.db.get(args.id)) as Doc<"emailTemplates"> | null;
    return existing?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const existing = (await ctx.db.get(args.id)) as Doc<"emailTemplates"> | null;
    if (!existing) throw new Error("Template not found");
    await ctx.db.delete(args.id);
  },
});

export const list = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    category: v.optional(v.string()),
  },
  permission: "settings.workspace",
  handler: async (ctx, args) => {
    let templates = await ctx.db
      .query("emailTemplates")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    if (args.category) {
      templates = templates.filter((t) => t.category === args.category);
    }

    return templates.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const get = authQuery({
  args: { id: v.id("emailTemplates") },
  permission: "settings.workspace",
  allowMissingWorkspace: true,
  resolveWorkspaceId: async (ctx, args) => {
    const template = (await ctx.db.get(args.id)) as Doc<"emailTemplates"> | null;
    return template?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Extract variables from HTML content
export const extractVariables = authQuery({
  args: { html: v.string() },
  handler: async (_ctx, args) => {
    const variablePattern = /\{\{([^}]+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variablePattern.exec(args.html)) !== null) {
      const variable = match[1].trim();
      if (!variables.includes(variable)) {
        variables.push(variable);
      }
    }

    return variables;
  },
});

// Duplicate template
export const duplicate = authMutation({
  args: { id: v.id("emailTemplates") },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const template = (await ctx.db.get(args.id)) as Doc<"emailTemplates"> | null;
    return template?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const template = (await ctx.db.get(args.id)) as Doc<"emailTemplates"> | null;
    if (!template) throw new Error("Template not found");

    const now = Date.now();
    return await ctx.db.insert("emailTemplates", {
      workspaceId: template.workspaceId,
      name: `${template.name} (Copy)`,
      subject: template.subject,
      html: template.html,
      variables: template.variables,
      category: template.category,
      createdAt: now,
      updatedAt: now,
    });
  },
});
