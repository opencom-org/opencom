import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { evaluateRuleWithSegmentSupport, validateAudienceRule } from "./audienceRules";
import { getAuthenticatedUserFromSession } from "./auth";
import { hasPermission, requirePermission } from "./permissions";
import { resolveVisitorFromSession } from "./widgetSessions";
import { audienceRulesValidator, completionAttributeValidator } from "./validators";

const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 500;
const DEFAULT_PROGRESS_LIMIT = 200;
const MAX_PROGRESS_LIMIT = 1000;
const DEFAULT_ELIGIBLE_LIMIT = 100;
const MAX_ELIGIBLE_LIMIT = 500;

function clampLimit(limit: number | undefined, defaultValue: number, maxValue: number): number {
  const normalized = limit ?? defaultValue;
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return defaultValue;
  }
  return Math.min(Math.floor(normalized), maxValue);
}

async function resolveChecklistVisitor(
  ctx: QueryCtx | MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    visitorId?: Id<"visitors">;
    sessionToken?: string;
  }
): Promise<Id<"visitors">> {
  const authUser = await getAuthenticatedUserFromSession(ctx);
  if (authUser) {
    await requirePermission(ctx, authUser._id, args.workspaceId, "checklists.manage");
    if (!args.visitorId) {
      throw new Error("visitorId is required for authenticated checklist access");
    }
    const visitor = (await ctx.db.get(args.visitorId)) as Doc<"visitors"> | null;
    if (!visitor || visitor.workspaceId !== args.workspaceId) {
      throw new Error("Visitor not found in workspace");
    }
    return args.visitorId;
  }

  const resolved = await resolveVisitorFromSession(ctx, {
    sessionToken: args.sessionToken,
    workspaceId: args.workspaceId,
  });
  if (args.visitorId && args.visitorId !== resolved.visitorId) {
    throw new Error("Not authorized for requested visitor");
  }
  return resolved.visitorId;
}

const taskValidator = v.object({
  id: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  action: v.optional(
    v.object({
      type: v.union(v.literal("tour"), v.literal("url"), v.literal("event")),
      tourId: v.optional(v.id("tours")),
      url: v.optional(v.string()),
      eventName: v.optional(v.string()),
    })
  ),
  completionType: v.union(
    v.literal("manual"),
    v.literal("auto_event"),
    v.literal("auto_attribute")
  ),
  completionEvent: v.optional(v.string()),
  completionAttribute: v.optional(completionAttributeValidator),
});

// Task 3.1: Create checklist
export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    tasks: v.array(taskValidator),
    targeting: v.optional(audienceRulesValidator),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, args.workspaceId, "checklists.manage");

    // Validate targeting rules if provided
    if (args.targeting !== undefined && !validateAudienceRule(args.targeting)) {
      throw new Error("Invalid targeting rules");
    }

    const now = Date.now();
    return await ctx.db.insert("checklists", {
      workspaceId: args.workspaceId,
      name: args.name,
      description: args.description,
      tasks: args.tasks,
      targeting: args.targeting,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Task 3.2: Update checklist
export const update = mutation({
  args: {
    id: v.id("checklists"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    tasks: v.optional(v.array(taskValidator)),
    targeting: v.optional(audienceRulesValidator),
    status: v.optional(v.union(v.literal("draft"), v.literal("active"), v.literal("archived"))),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = (await ctx.db.get(id)) as Doc<"checklists"> | null;
    if (!existing) throw new Error("Checklist not found");

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, existing.workspaceId, "checklists.manage");

    // Validate targeting rules if provided
    if (args.targeting !== undefined && !validateAudienceRule(args.targeting)) {
      throw new Error("Invalid targeting rules");
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return id;
  },
});

// Task 3.3: Delete checklist
export const remove = mutation({
  args: { id: v.id("checklists") },
  handler: async (ctx, args) => {
    const existing = (await ctx.db.get(args.id)) as Doc<"checklists"> | null;
    if (!existing) throw new Error("Checklist not found");

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, existing.workspaceId, "checklists.manage");

    // Also delete all progress records
    const progressRecords = await ctx.db
      .query("checklistProgress")
      .withIndex("by_checklist", (q) => q.eq("checklistId", args.id))
      .collect();

    for (const record of progressRecords) {
      await ctx.db.delete(record._id);
    }

    await ctx.db.delete(args.id);
  },
});

// Task 3.4: List checklists
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(v.union(v.literal("draft"), v.literal("active"), v.literal("archived"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }
    const canRead = await hasPermission(ctx, user._id, args.workspaceId, "checklists.manage");
    if (!canRead) {
      return [];
    }

    const limit = clampLimit(args.limit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    let checklists;

    if (args.status) {
      checklists = await ctx.db
        .query("checklists")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", args.status!)
        )
        .order("desc")
        .take(limit);
    } else {
      checklists = await ctx.db
        .query("checklists")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .order("desc")
        .take(limit);
    }

    return checklists.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get a single checklist
export const get = query({
  args: { id: v.id("checklists") },
  handler: async (ctx, args) => {
    const checklist = await ctx.db.get(args.id);
    if (!checklist) {
      return null;
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return null;
    }
    const canRead = await hasPermission(ctx, user._id, checklist.workspaceId, "checklists.manage");
    if (!canRead) {
      return null;
    }

    return checklist;
  },
});

// Task 3.5: Get user's checklist progress
export const getProgress = query({
  args: {
    visitorId: v.optional(v.id("visitors")),
    checklistId: v.id("checklists"),
    sessionToken: v.optional(v.string()),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const checklist = (await ctx.db.get(args.checklistId)) as Doc<"checklists"> | null;
    if (!checklist) {
      return null;
    }

    if (checklist.workspaceId !== args.workspaceId) {
      throw new Error("Checklist does not belong to workspace");
    }

    const visitorId = await resolveChecklistVisitor(ctx, {
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
    });

    const progress = await ctx.db
      .query("checklistProgress")
      .withIndex("by_visitor_checklist", (q) =>
        q.eq("visitorId", visitorId).eq("checklistId", args.checklistId)
      )
      .first();

    return progress;
  },
});

// Get all progress for a visitor
export const getAllProgress = query({
  args: {
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const visitorId = await resolveChecklistVisitor(ctx, {
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
    });

    const limit = clampLimit(args.limit, DEFAULT_PROGRESS_LIMIT, MAX_PROGRESS_LIMIT);
    return await ctx.db
      .query("checklistProgress")
      .withIndex("by_visitor", (q) => q.eq("visitorId", visitorId))
      .order("desc")
      .take(limit);
  },
});

// Task 3.6: Complete a task
export const completeTask = mutation({
  args: {
    visitorId: v.optional(v.id("visitors")),
    checklistId: v.id("checklists"),
    taskId: v.string(),
    sessionToken: v.optional(v.string()),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const checklist = (await ctx.db.get(args.checklistId)) as Doc<"checklists"> | null;
    if (!checklist) throw new Error("Checklist not found");
    if (checklist.workspaceId !== args.workspaceId) {
      throw new Error("Checklist does not belong to workspace");
    }
    const visitorId = await resolveChecklistVisitor(ctx, {
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
    });

    // Verify task exists
    const task = checklist.tasks.find((t) => t.id === args.taskId);
    if (!task) throw new Error("Task not found");

    // Get or create progress
    let progress = await ctx.db
      .query("checklistProgress")
      .withIndex("by_visitor_checklist", (q) =>
        q.eq("visitorId", visitorId).eq("checklistId", args.checklistId)
      )
      .first();

    const now = Date.now();

    if (!progress) {
      // Create new progress record
      const progressId = await ctx.db.insert("checklistProgress", {
        visitorId,
        checklistId: args.checklistId,
        completedTaskIds: [args.taskId],
        startedAt: now,
      });
      progress = (await ctx.db.get(progressId)) as Doc<"checklistProgress"> | null;
    } else {
      // Update existing progress
      if (!progress.completedTaskIds.includes(args.taskId)) {
        const newCompletedTasks = [...progress.completedTaskIds, args.taskId];
        const allCompleted = checklist.tasks.every((t) => newCompletedTasks.includes(t.id));

        await ctx.db.patch(progress._id, {
          completedTaskIds: newCompletedTasks,
          completedAt: allCompleted ? now : undefined,
        });
      }
    }

    return progress;
  },
});

// Uncomplete a task (for manual tasks)
export const uncompleteTask = mutation({
  args: {
    visitorId: v.optional(v.id("visitors")),
    checklistId: v.id("checklists"),
    taskId: v.string(),
    sessionToken: v.optional(v.string()),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const checklist = (await ctx.db.get(args.checklistId)) as Doc<"checklists"> | null;
    if (!checklist) {
      throw new Error("Checklist not found");
    }
    if (checklist.workspaceId !== args.workspaceId) {
      throw new Error("Checklist does not belong to workspace");
    }
    const visitorId = await resolveChecklistVisitor(ctx, {
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
    });

    const progress = await ctx.db
      .query("checklistProgress")
      .withIndex("by_visitor_checklist", (q) =>
        q.eq("visitorId", visitorId).eq("checklistId", args.checklistId)
      )
      .first();

    if (!progress) return null;

    const newCompletedTasks = progress.completedTaskIds.filter((id) => id !== args.taskId);

    await ctx.db.patch(progress._id, {
      completedTaskIds: newCompletedTasks,
      completedAt: undefined, // Reset completion if unchecking
    });

    return progress;
  },
});

// Task 3.7: Auto-completion based on events/attributes
export const checkAutoCompletion = internalMutation({
  args: {
    visitorId: v.id("visitors"),
    workspaceId: v.id("workspaces"),
    eventName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const visitor = (await ctx.db.get(args.visitorId)) as Doc<"visitors"> | null;
    if (!visitor) return;

    // Get all active checklists for this workspace
    const checklists = await ctx.db
      .query("checklists")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "active")
      )
      .collect();

    for (const checklist of checklists) {
      // Check targeting (audienceRules with targeting fallback)
      const audienceRules = checklist.audienceRules ?? checklist.targeting;
      if (audienceRules) {
        const matches = await evaluateRuleWithSegmentSupport(ctx, audienceRules, visitor);
        if (!matches) continue;
      }

      // Get or create progress
      let progress = await ctx.db
        .query("checklistProgress")
        .withIndex("by_visitor_checklist", (q) =>
          q.eq("visitorId", args.visitorId).eq("checklistId", checklist._id)
        )
        .first();

      const completedTaskIds = progress?.completedTaskIds || [];
      const newlyCompleted: string[] = [];

      for (const task of checklist.tasks) {
        if (completedTaskIds.includes(task.id)) continue;

        let shouldComplete = false;

        // Check event-based completion
        if (task.completionType === "auto_event" && task.completionEvent && args.eventName) {
          if (task.completionEvent === args.eventName) {
            shouldComplete = true;
          }
        }

        // Check attribute-based completion
        if (task.completionType === "auto_attribute" && task.completionAttribute) {
          const { key, operator, value } = task.completionAttribute;
          const attrs = visitor.customAttributes as Record<string, unknown> | undefined;
          const actualValue = attrs?.[key];

          switch (operator) {
            case "equals":
              shouldComplete = actualValue === value;
              break;
            case "is_set":
              shouldComplete = actualValue !== undefined && actualValue !== null;
              break;
            case "greater_than":
              shouldComplete =
                typeof actualValue === "number" && typeof value === "number" && actualValue > value;
              break;
            case "less_than":
              shouldComplete =
                typeof actualValue === "number" && typeof value === "number" && actualValue < value;
              break;
          }
        }

        if (shouldComplete) {
          newlyCompleted.push(task.id);
        }
      }

      if (newlyCompleted.length > 0) {
        const now = Date.now();
        const allCompletedIds = [...completedTaskIds, ...newlyCompleted];
        const allTasksCompleted = checklist.tasks.every((t) => allCompletedIds.includes(t.id));

        if (!progress) {
          await ctx.db.insert("checklistProgress", {
            visitorId: args.visitorId,
            checklistId: checklist._id,
            completedTaskIds: allCompletedIds,
            startedAt: now,
            completedAt: allTasksCompleted ? now : undefined,
          });
        } else {
          await ctx.db.patch(progress._id, {
            completedTaskIds: allCompletedIds,
            completedAt: allTasksCompleted ? now : undefined,
          });
        }
      }
    }
  },
});

// Get eligible checklists for a visitor (for widget display)
export const getEligible = query({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const visitorId = await resolveChecklistVisitor(ctx, {
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
    });

    const visitor = (await ctx.db.get(visitorId)) as Doc<"visitors"> | null;
    if (!visitor || visitor.workspaceId !== args.workspaceId) {
      throw new Error("Visitor not found in workspace");
    }

    const limit = clampLimit(args.limit, DEFAULT_ELIGIBLE_LIMIT, MAX_ELIGIBLE_LIMIT);
    // Get all active checklists
    const checklists = await ctx.db
      .query("checklists")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "active")
      )
      .order("desc")
      .take(limit);

    const eligible: Array<{
      checklist: (typeof checklists)[0];
      progress: { completedTaskIds: string[]; startedAt?: number; completedAt?: number } | null;
    }> = [];

    for (const checklist of checklists) {
      // Check targeting (audienceRules with targeting fallback)
      const audienceRules = checklist.audienceRules ?? checklist.targeting;
      if (audienceRules) {
        const matches = await evaluateRuleWithSegmentSupport(ctx, audienceRules, visitor);
        if (!matches) continue;
      }

      // Get progress
      const progress = await ctx.db
        .query("checklistProgress")
        .withIndex("by_visitor_checklist", (q) =>
          q.eq("visitorId", visitorId).eq("checklistId", checklist._id)
        )
        .first();

      eligible.push({
        checklist,
        progress: progress
          ? {
              completedTaskIds: progress.completedTaskIds,
              startedAt: progress.startedAt,
              completedAt: progress.completedAt,
            }
          : null,
      });
    }

    return eligible;
  },
});
