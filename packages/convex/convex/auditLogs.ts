import { v } from "convex/values";
import { mutation, query, internalMutation, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getAuthenticatedUserFromSession } from "./auth";
import { hasPermission, requirePermission } from "./permissions";
import { jsonRecordValidator } from "./validators";

// Audit action types (based on design.md)
export type AuditAction =
  // Auth events
  | "auth.login"
  | "auth.logout"
  | "auth.session.created"
  // User/Team events
  | "user.invited"
  | "user.role.changed"
  | "user.removed"
  | "user.ownership.transferred"
  // Workspace events
  | "workspace.settings.changed"
  | "workspace.security.changed"
  // Conversation events
  | "conversation.accessed"
  | "conversation.exported"
  // Integration events
  | "integration.created"
  | "integration.revoked"
  // Widget identity events
  | "widget.identity.enabled"
  | "widget.identity.disabled"
  | "widget.identity.secret.rotated"
  // Visitor events
  | "visitor.merged"
  // Data events
  | "data.exported"
  | "data.deleted";

export type ActorType = "user" | "system" | "api";

async function recordAuditWriteFailure(
  ctx: MutationCtx,
  payload: {
    workspaceId: Id<"workspaces">;
    action: string;
    resourceType: string;
    resourceId?: string;
    actorId?: Id<"users">;
    actorType: ActorType;
    metadata?: Record<string, string | number | boolean | null>;
    error: string;
  }
): Promise<void> {
  try {
    await ctx.db.insert("auditLogWriteFailures", {
      workspaceId: payload.workspaceId,
      action: payload.action,
      resourceType: payload.resourceType,
      resourceId: payload.resourceId,
      actorId: payload.actorId,
      actorType: payload.actorType,
      metadata: payload.metadata,
      error: payload.error,
      createdAt: Date.now(),
    });
  } catch (telemetryError) {
    console.error("Failed to write audit failure telemetry:", telemetryError);
  }
}

// Internal mutation to log audit events (task 4.1)
// This is fail-open: if logging fails, we log the error but don't block the action
export const logAuditEvent = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    actorId: v.optional(v.id("users")),
    actorType: v.union(v.literal("user"), v.literal("system"), v.literal("api")),
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    metadata: v.optional(jsonRecordValidator),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const logId = await ctx.db.insert("auditLogs", {
        workspaceId: args.workspaceId,
        actorId: args.actorId,
        actorType: args.actorType,
        action: args.action,
        resourceType: args.resourceType,
        resourceId: args.resourceId,
        metadata: args.metadata,
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
        timestamp: Date.now(),
      });
      return { success: true, logId };
    } catch (error) {
      // Fail-open: log error but don't throw
      console.error("Failed to write audit log:", error);
      await recordAuditWriteFailure(ctx, {
        workspaceId: args.workspaceId,
        actorId: args.actorId,
        actorType: args.actorType,
        action: args.action,
        resourceType: args.resourceType,
        resourceId: args.resourceId,
        metadata: args.metadata as Record<string, string | number | boolean | null> | undefined,
        error: String(error),
      });
      return { success: false, error: String(error) };
    }
  },
});

// Helper function to log audit events from mutations (task 4.1)
export async function logAudit(
  ctx: MutationCtx,
  params: {
    workspaceId: Id<"workspaces">;
    actorId?: Id<"users">;
    actorType: ActorType;
    action: AuditAction;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, string | number | boolean | null>;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  try {
    await ctx.db.insert("auditLogs", {
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      actorType: params.actorType,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      metadata: params.metadata,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      timestamp: Date.now(),
    });
  } catch (error) {
    // Fail-open: log error but don't throw
    console.error("Failed to write audit log:", error);
    await recordAuditWriteFailure(ctx, {
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      actorType: params.actorType,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      metadata: params.metadata,
      error: String(error),
    });
  }
}

// Query audit logs with filtering (task 4.2)
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    action: v.optional(v.string()),
    actorId: v.optional(v.id("users")),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }

    // Check permission to read audit logs
    await requirePermission(ctx, user._id, args.workspaceId, "audit.read");

    const limit = args.limit ?? 100;
    const startTime = args.startTime ?? 0;
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_workspace_timestamp", (q) =>
        q.eq("workspaceId", args.workspaceId).gte("timestamp", startTime)
      )
      .order("desc")
      .take(limit * 4);

    // Apply additional filters
    let filtered = logs;
    if (args.action) {
      filtered = filtered.filter((log) => log.action === args.action);
    }
    if (args.actorId) {
      filtered = filtered.filter((log) => log.actorId === args.actorId);
    }
    if (args.resourceType) {
      filtered = filtered.filter((log) => log.resourceType === args.resourceType);
    }
    if (args.resourceId) {
      filtered = filtered.filter((log) => log.resourceId === args.resourceId);
    }
    if (args.endTime) {
      filtered = filtered.filter((log) => log.timestamp <= args.endTime!);
    }

    // Limit results
    filtered = filtered.slice(0, limit);

    // Enrich with actor details
    const actorIds = Array.from(
      new Set(filtered.map((log) => log.actorId).filter((id): id is Id<"users"> => !!id))
    );
    const actorEntries = await Promise.all(
      actorIds.map(async (actorId) => {
        const actor = await ctx.db.get(actorId);
        return [actorId, actor] as const;
      })
    );
    const actorsById = new Map(actorEntries);

    const enriched = filtered.map((log) => {
      const actor = log.actorId ? actorsById.get(log.actorId) : null;
      return {
        ...log,
        actorName: actor?.name ?? null,
        actorEmail: actor?.email ?? null,
      };
    });

    return enriched;
  },
});

export const getAccess = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return {
        status: "unauthenticated" as const,
        canRead: false,
        canExport: false,
        canManageSecurity: false,
      };
    }

    const [canRead, canExport, canManageSecurity] = await Promise.all([
      hasPermission(ctx, user._id, args.workspaceId, "audit.read"),
      hasPermission(ctx, user._id, args.workspaceId, "data.export"),
      hasPermission(ctx, user._id, args.workspaceId, "settings.security"),
    ]);

    return {
      status: "ok" as const,
      canRead,
      canExport,
      canManageSecurity,
    };
  },
});

// Get unique actions for filtering UI
export const getActions = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }

    await requirePermission(ctx, user._id, args.workspaceId, "audit.read");

    // Get recent logs to extract unique actions
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(1000);

    const actions = [...new Set(logs.map((log) => log.action))];
    return actions.sort();
  },
});

// Get audit log settings (task 4.7)
export const getSettings = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return null;
    }

    await requirePermission(ctx, user._id, args.workspaceId, "settings.security");

    const settings = await ctx.db
      .query("auditLogSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    // Return default settings if none exist
    if (!settings) {
      return {
        workspaceId: args.workspaceId,
        retentionDays: 90, // Default retention
        createdAt: 0,
        updatedAt: 0,
      };
    }

    return settings;
  },
});

// Update audit log retention settings (task 4.7)
export const updateSettings = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    retentionDays: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    await requirePermission(ctx, user._id, args.workspaceId, "settings.security");

    // Validate retention days (30, 90, or 365)
    if (![30, 90, 365].includes(args.retentionDays)) {
      throw new Error("Retention days must be 30, 90, or 365");
    }

    const existing = await ctx.db
      .query("auditLogSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        retentionDays: args.retentionDays,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("auditLogSettings", {
        workspaceId: args.workspaceId,
        retentionDays: args.retentionDays,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Log the settings change
    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorId: user._id,
      actorType: "user",
      action: "workspace.security.changed",
      resourceType: "auditLogSettings",
      metadata: {
        setting: "retentionDays",
        oldValue: existing?.retentionDays ?? 90,
        newValue: args.retentionDays,
      },
    });

    return { success: true };
  },
});

// Cleanup old audit logs based on retention settings (task 4.8)
export const cleanupOldLogs = internalMutation({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;
    let totalDeleted = 0;
    const results: Array<{ workspaceId: string; deleted: number }> = [];

    // Get workspaces to process
    let workspaces;
    if (args.workspaceId) {
      const workspace = await ctx.db.get(args.workspaceId);
      workspaces = workspace ? [workspace] : [];
    } else {
      workspaces = await ctx.db.query("workspaces").collect();
    }

    for (const workspace of workspaces) {
      // Get retention settings for this workspace
      const settings = await ctx.db
        .query("auditLogSettings")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
        .first();

      const retentionDays = settings?.retentionDays ?? 90;
      const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

      // Find logs older than retention period
      const oldLogs = await ctx.db
        .query("auditLogs")
        .withIndex("by_workspace_timestamp", (q) =>
          q.eq("workspaceId", workspace._id).lt("timestamp", cutoffTime)
        )
        .take(batchSize);

      // Delete old logs
      for (const log of oldLogs) {
        await ctx.db.delete(log._id);
        totalDeleted++;
      }

      if (oldLogs.length > 0) {
        results.push({
          workspaceId: workspace._id,
          deleted: oldLogs.length,
        });
      }
    }

    return {
      totalDeleted,
      workspacesProcessed: results.length,
      results,
    };
  },
});

// Export audit logs (task 4.9)
export const exportLogs = query({
  args: {
    workspaceId: v.id("workspaces"),
    action: v.optional(v.string()),
    actorId: v.optional(v.id("users")),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    format: v.optional(v.union(v.literal("json"), v.literal("csv"))),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    await requirePermission(ctx, user._id, args.workspaceId, "data.export");

    const format = args.format ?? "json";
    const endTime = args.endTime ?? Date.now();
    const startTime = args.startTime ?? endTime - 30 * 24 * 60 * 60 * 1000; // Default: last 30 days

    // Fetch logs within time range
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_workspace_timestamp", (q) =>
        q.eq("workspaceId", args.workspaceId).gte("timestamp", startTime)
      )
      .filter((q) => q.lte(q.field("timestamp"), endTime))
      .collect();

    let filtered = logs;
    if (args.action) {
      filtered = filtered.filter((log) => log.action === args.action);
    }
    if (args.actorId) {
      filtered = filtered.filter((log) => log.actorId === args.actorId);
    }
    if (args.resourceType) {
      filtered = filtered.filter((log) => log.resourceType === args.resourceType);
    }
    if (args.resourceId) {
      filtered = filtered.filter((log) => log.resourceId === args.resourceId);
    }

    // Enrich with actor details
    const actorIds = Array.from(
      new Set(filtered.map((log) => log.actorId).filter((id): id is Id<"users"> => !!id))
    );
    const actorEntries = await Promise.all(
      actorIds.map(async (actorId) => {
        const actor = await ctx.db.get(actorId);
        return [actorId, actor] as const;
      })
    );
    const actorsById = new Map(actorEntries);

    const enriched = filtered.map((log) => {
      const actor = log.actorId ? actorsById.get(log.actorId) : null;
      return {
        timestamp: new Date(log.timestamp).toISOString(),
        action: log.action,
        actorType: log.actorType,
        actorId: log.actorId,
        actorName: actor?.name ?? null,
        actorEmail: actor?.email ?? null,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
      };
    });

    // Log the export action
    // Note: We can't use logAudit here since this is a query, not mutation
    // The export action should be logged by a separate mutation call

    if (format === "csv") {
      // Convert to CSV format
      const headers = [
        "timestamp",
        "action",
        "actorType",
        "actorId",
        "actorName",
        "actorEmail",
        "resourceType",
        "resourceId",
        "ipAddress",
        "userAgent",
      ];
      const rows = enriched.map((log) =>
        headers
          .map((h) => {
            const value = log[h as keyof typeof log];
            if (value === null || value === undefined) return "";
            if (typeof value === "object") return JSON.stringify(value);
            return String(value).replace(/"/g, '""');
          })
          .map((v) => `"${v}"`)
          .join(",")
      );
      const csv = [headers.join(","), ...rows].join("\n");
      return { format: "csv", data: csv, count: enriched.length };
    }

    return { format: "json", data: enriched, count: enriched.length };
  },
});

// Log export action (called after exportLogs)
export const logExport = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    exportType: v.string(),
    recordCount: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorId: user._id,
      actorType: "user",
      action: "data.exported",
      resourceType: args.exportType,
      metadata: {
        recordCount: args.recordCount,
      },
    });

    return { success: true };
  },
});
