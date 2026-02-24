import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { getAuthenticatedUserFromSession } from "./auth";
import { hasPermission, requirePermission } from "./permissions";

const fieldTypeValidator = v.union(
  v.literal("text"),
  v.literal("textarea"),
  v.literal("select"),
  v.literal("multi-select"),
  v.literal("number"),
  v.literal("date")
);

const fieldValidator = v.object({
  id: v.string(),
  type: fieldTypeValidator,
  label: v.string(),
  placeholder: v.optional(v.string()),
  required: v.boolean(),
  options: v.optional(v.array(v.string())),
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    fields: v.array(fieldValidator),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, args.workspaceId, "settings.workspace");

    const now = Date.now();

    if (args.isDefault) {
      const existingDefault = await ctx.db
        .query("ticketForms")
        .withIndex("by_workspace_default", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("isDefault", true)
        )
        .first();

      if (existingDefault) {
        await ctx.db.patch(existingDefault._id, { isDefault: false, updatedAt: now });
      }
    }

    return await ctx.db.insert("ticketForms", {
      workspaceId: args.workspaceId,
      name: args.name,
      description: args.description,
      fields: args.fields,
      isDefault: args.isDefault || false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("ticketForms"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    fields: v.optional(v.array(fieldValidator)),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const form = (await ctx.db.get(args.id)) as Doc<"ticketForms"> | null;
    if (!form) {
      throw new Error("Ticket form not found");
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, form.workspaceId, "settings.workspace");

    const now = Date.now();
    const updates: Record<string, unknown> = { updatedAt: now };

    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.description !== undefined) {
      updates.description = args.description;
    }
    if (args.fields !== undefined) {
      updates.fields = args.fields;
    }

    if (args.isDefault === true && !form.isDefault) {
      const existingDefault = await ctx.db
        .query("ticketForms")
        .withIndex("by_workspace_default", (q) =>
          q.eq("workspaceId", form.workspaceId).eq("isDefault", true)
        )
        .first();

      if (existingDefault) {
        await ctx.db.patch(existingDefault._id, { isDefault: false, updatedAt: now });
      }
      updates.isDefault = true;
    } else if (args.isDefault !== undefined) {
      updates.isDefault = args.isDefault;
    }

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

export const list = query({
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

    return await ctx.db
      .query("ticketForms")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const get = query({
  args: {
    id: v.id("ticketForms"),
  },
  handler: async (ctx, args) => {
    const form = (await ctx.db.get(args.id)) as Doc<"ticketForms"> | null;
    if (!form) {
      return null;
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return null;
    }
    const canRead = await hasPermission(ctx, user._id, form.workspaceId, "settings.workspace");
    if (!canRead) {
      return null;
    }

    return form;
  },
});

export const getDefault = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return null;
    }
    const canRead = await hasPermission(ctx, user._id, args.workspaceId, "settings.workspace");
    if (!canRead) {
      return null;
    }

    return await ctx.db
      .query("ticketForms")
      .withIndex("by_workspace_default", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("isDefault", true)
      )
      .first();
  },
});

export const getDefaultForVisitor = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const defaultForm = await ctx.db
      .query("ticketForms")
      .withIndex("by_workspace_default", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("isDefault", true)
      )
      .first();

    if (defaultForm) {
      return defaultForm;
    }

    // Fall back to first form if no default
    return await ctx.db
      .query("ticketForms")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
  },
});

export const remove = mutation({
  args: {
    id: v.id("ticketForms"),
  },
  handler: async (ctx, args) => {
    const form = (await ctx.db.get(args.id)) as Doc<"ticketForms"> | null;
    if (!form) {
      throw new Error("Ticket form not found");
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, form.workspaceId, "settings.workspace");

    const ticketsUsingForm = await ctx.db
      .query("tickets")
      .filter((q) => q.eq(q.field("formId"), args.id))
      .first();

    if (ticketsUsingForm) {
      throw new Error("Cannot delete form that is in use by tickets");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
