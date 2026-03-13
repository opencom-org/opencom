import { v } from "convex/values";
import { query } from "../_generated/server";
import { getAuthenticatedUserFromSession } from "../auth";
import { getWorkspaceMembership, hasPermission } from "../permissions";
import { isVisitorOnline } from "./helpers";

export const getBySession = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const visitor = visitors[0] ?? null;
    if (!visitor) {
      return null;
    }

    // Allow if caller is authenticated agent with workspace membership
    const user = await getAuthenticatedUserFromSession(ctx);
    if (user) {
      const membership = await getWorkspaceMembership(ctx, user._id, visitor.workspaceId);
      if (membership) {
        return visitor;
      }
    }

    // For visitor-side callers, the session itself serves as proof of ownership
    // (the caller must know the sessionId to query it)
    return visitor;
  },
});

export const get = query({
  args: {
    id: v.id("visitors"),
  },
  handler: async (ctx, args) => {
    const visitor = await ctx.db.get(args.id);
    if (!visitor) {
      return null;
    }

    // Allow if caller is authenticated agent with workspace membership
    const user = await getAuthenticatedUserFromSession(ctx);
    if (user) {
      const membership = await getWorkspaceMembership(ctx, user._id, visitor.workspaceId);
      if (membership) {
        return visitor;
      }
    }

    // Unauthenticated callers cannot read visitor data by ID alone
    return null;
  },
});

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }
    const canRead = await hasPermission(ctx, user._id, args.workspaceId, "users.read");
    if (!canRead) {
      return [];
    }

    const limit = args.limit ?? 100;
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(limit);
    return visitors;
  },
});

export const search = query({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }
    const canRead = await hasPermission(ctx, user._id, args.workspaceId, "users.read");
    if (!canRead) {
      return [];
    }

    const limit = Math.min(args.limit ?? 20, 50); // Rate limit: max 50 results
    const queryText = args.query.trim();

    if (queryText.length < 2) {
      return []; // Require at least 2 characters to search
    }

    // Try search index for name matches first
    const nameMatches = await ctx.db
      .query("visitors")
      .withSearchIndex("search_visitors", (q) =>
        q.search("name", queryText).eq("workspaceId", args.workspaceId)
      )
      .take(limit);

    // Also check email index for exact email prefix matches
    const emailMatches = await ctx.db
      .query("visitors")
      .withIndex("by_email", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) =>
        q.or(q.eq(q.field("email"), queryText), q.eq(q.field("email"), queryText.toLowerCase()))
      )
      .take(limit);

    // Merge results, deduplicate by ID
    const seen = new Set<string>();
    const results: typeof nameMatches = [];

    for (const visitor of [...nameMatches, ...emailMatches]) {
      if (!seen.has(visitor._id)) {
        seen.add(visitor._id);
        results.push(visitor);
        if (results.length >= limit) {
          break;
        }
      }
    }

    return results;
  },
});

export const isOnline = query({
  args: {
    visitorId: v.id("visitors"),
  },
  handler: async (ctx, args) => {
    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) {
      return false;
    }
    return isVisitorOnline(visitor.lastSeenAt);
  },
});
