import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { getAuthenticatedUserFromSession } from "./auth";
import { hasPermission, requirePermission } from "./permissions";

const conditionValidator = v.object({
  field: v.union(
    v.literal("visitor.email"),
    v.literal("visitor.name"),
    v.literal("visitor.country"),
    v.literal("visitor.customAttributes"),
    v.literal("conversation.channel"),
    v.literal("conversation.source"),
    v.literal("message.content")
  ),
  operator: v.union(
    v.literal("equals"),
    v.literal("not_equals"),
    v.literal("contains"),
    v.literal("not_contains"),
    v.literal("starts_with"),
    v.literal("ends_with"),
    v.literal("is_set"),
    v.literal("is_not_set")
  ),
  value: v.optional(v.string()),
  attributeKey: v.optional(v.string()),
});

const actionValidator = v.object({
  type: v.union(v.literal("assign_user"), v.literal("assign_team")),
  userId: v.optional(v.id("users")),
  teamId: v.optional(v.string()),
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
    const canRead = await hasPermission(ctx, user._id, args.workspaceId, "conversations.assign");
    if (!canRead) {
      return [];
    }

    const workspaceId = args.workspaceId;
    const rules = await ctx.db
      .query("assignmentRules")
      .withIndex("by_workspace_priority", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    return rules;
  },
});

export const get = query({
  args: {
    id: v.id("assignmentRules"),
  },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.id);
    if (!rule) {
      return null;
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return null;
    }
    const canRead = await hasPermission(ctx, user._id, rule.workspaceId, "conversations.assign");
    if (!canRead) {
      return null;
    }

    return rule;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    priority: v.number(),
    enabled: v.boolean(),
    conditions: v.array(conditionValidator),
    action: actionValidator,
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, args.workspaceId, "conversations.assign");

    const now = Date.now();
    return await ctx.db.insert("assignmentRules", {
      workspaceId: args.workspaceId,
      name: args.name,
      priority: args.priority,
      enabled: args.enabled,
      conditions: args.conditions,
      action: args.action,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("assignmentRules"),
    name: v.optional(v.string()),
    priority: v.optional(v.number()),
    enabled: v.optional(v.boolean()),
    conditions: v.optional(v.array(conditionValidator)),
    action: v.optional(actionValidator),
  },
  handler: async (ctx, args) => {
    const rule = (await ctx.db.get(args.id)) as Doc<"assignmentRules"> | null;
    if (!rule) {
      throw new Error("Assignment rule not found");
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, rule.workspaceId, "conversations.assign");

    await ctx.db.patch(args.id, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.priority !== undefined && { priority: args.priority }),
      ...(args.enabled !== undefined && { enabled: args.enabled }),
      ...(args.conditions !== undefined && { conditions: args.conditions }),
      ...(args.action !== undefined && { action: args.action }),
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

export const remove = mutation({
  args: {
    id: v.id("assignmentRules"),
  },
  handler: async (ctx, args) => {
    const rule = (await ctx.db.get(args.id)) as Doc<"assignmentRules"> | null;
    if (!rule) {
      throw new Error("Assignment rule not found");
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, rule.workspaceId, "conversations.assign");

    await ctx.db.delete(args.id);
  },
});

export const reorder = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    ruleIds: v.array(v.id("assignmentRules")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, args.workspaceId, "conversations.assign");

    for (const ruleId of args.ruleIds) {
      const rule = (await ctx.db.get(ruleId)) as Doc<"assignmentRules"> | null;
      if (!rule || rule.workspaceId !== args.workspaceId) {
        throw new Error("Rule does not belong to workspace");
      }
    }

    const now = Date.now();
    for (let i = 0; i < args.ruleIds.length; i++) {
      await ctx.db.patch(args.ruleIds[i], {
        priority: i,
        updatedAt: now,
      });
    }
  },
});

type Condition = {
  field: string;
  operator: string;
  value?: string;
  attributeKey?: string;
};

type EvaluationContext = {
  visitor?: {
    email?: string;
    name?: string;
    location?: { country?: string };
    customAttributes?: Record<string, unknown>;
  };
  conversation?: {
    channel?: string;
    source?: string;
  };
  message?: {
    content?: string;
  };
};

function evaluateCondition(condition: Condition, context: EvaluationContext): boolean {
  let fieldValue: string | undefined;

  switch (condition.field) {
    case "visitor.email":
      fieldValue = context.visitor?.email;
      break;
    case "visitor.name":
      fieldValue = context.visitor?.name;
      break;
    case "visitor.country":
      fieldValue = context.visitor?.location?.country;
      break;
    case "visitor.customAttributes":
      if (condition.attributeKey && context.visitor?.customAttributes) {
        const attrValue = context.visitor.customAttributes[condition.attributeKey];
        fieldValue = attrValue !== undefined ? String(attrValue) : undefined;
      }
      break;
    case "conversation.channel":
      fieldValue = context.conversation?.channel;
      break;
    case "conversation.source":
      fieldValue = context.conversation?.source;
      break;
    case "message.content":
      fieldValue = context.message?.content;
      break;
  }

  const compareValue = condition.value?.toLowerCase() ?? "";
  const fieldLower = fieldValue?.toLowerCase() ?? "";

  switch (condition.operator) {
    case "equals":
      return fieldLower === compareValue;
    case "not_equals":
      return fieldLower !== compareValue;
    case "contains":
      return fieldLower.includes(compareValue);
    case "not_contains":
      return !fieldLower.includes(compareValue);
    case "starts_with":
      return fieldLower.startsWith(compareValue);
    case "ends_with":
      return fieldLower.endsWith(compareValue);
    case "is_set":
      return fieldValue !== undefined && fieldValue !== "";
    case "is_not_set":
      return fieldValue === undefined || fieldValue === "";
    default:
      return false;
  }
}

export const evaluateRules = query({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    conversationId: v.optional(v.id("conversations")),
    messageContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return null;
    }
    const canRead = await hasPermission(ctx, user._id, args.workspaceId, "conversations.assign");
    if (!canRead) {
      return null;
    }

    const workspaceId = args.workspaceId;
    const rules = await ctx.db
      .query("assignmentRules")
      .withIndex("by_workspace_priority", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    const enabledRules = rules.filter((r) => r.enabled).sort((a, b) => a.priority - b.priority);

    if (enabledRules.length === 0) {
      return null;
    }

    // Build evaluation context
    const context: EvaluationContext = {};

    if (args.visitorId) {
      const visitor = (await ctx.db.get(args.visitorId)) as Doc<"visitors"> | null;
      if (visitor && visitor.workspaceId === workspaceId) {
        context.visitor = {
          email: visitor.email,
          name: visitor.name,
          location: visitor.location,
          customAttributes: visitor.customAttributes as Record<string, unknown> | undefined,
        };
      }
    }

    if (args.conversationId) {
      const conversation = (await ctx.db.get(args.conversationId)) as Doc<"conversations"> | null;
      if (conversation && conversation.workspaceId === workspaceId) {
        context.conversation = {
          channel: conversation.channel,
        };
      }
    }

    if (args.messageContent) {
      context.message = {
        content: args.messageContent,
      };
    }

    // Evaluate rules in priority order, first match wins
    for (const rule of enabledRules) {
      const allConditionsMet = rule.conditions.every((condition) =>
        evaluateCondition(condition, context)
      );

      if (allConditionsMet) {
        return {
          ruleId: rule._id,
          ruleName: rule.name,
          action: rule.action,
        };
      }
    }

    return null;
  },
});

export const applyAssignment = internalMutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const conversation = (await ctx.db.get(args.conversationId)) as Doc<"conversations"> | null;
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const rules = await ctx.db
      .query("assignmentRules")
      .withIndex("by_workspace_priority", (q) => q.eq("workspaceId", conversation.workspaceId))
      .collect();

    const enabledRules = rules.filter((r) => r.enabled).sort((a, b) => a.priority - b.priority);

    if (enabledRules.length === 0) {
      return null;
    }

    // Build evaluation context
    const context: EvaluationContext = {
      conversation: {
        channel: conversation.channel,
      },
    };

    if (conversation.visitorId) {
      const visitor = (await ctx.db.get(conversation.visitorId)) as Doc<"visitors"> | null;
      if (visitor) {
        context.visitor = {
          email: visitor.email,
          name: visitor.name,
          location: visitor.location,
          customAttributes: visitor.customAttributes as Record<string, unknown> | undefined,
        };
      }
    }

    // Get the first message for content matching
    const firstMessage = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .first();

    if (firstMessage) {
      context.message = {
        content: firstMessage.content,
      };
    }

    // Evaluate rules
    for (const rule of enabledRules) {
      const allConditionsMet = rule.conditions.every((condition) =>
        evaluateCondition(condition, context)
      );

      if (allConditionsMet) {
        if (rule.action.type === "assign_user" && rule.action.userId) {
          await ctx.db.patch(args.conversationId, {
            assignedAgentId: rule.action.userId,
            updatedAt: Date.now(),
          });
          return {
            ruleId: rule._id,
            assignedUserId: rule.action.userId,
          };
        }
        // Team-based assignment is resolved by downstream routing; this match keeps
        // the selected team context without choosing an individual agent here.
        return {
          ruleId: rule._id,
          teamId: rule.action.teamId,
        };
      }
    }

    return null;
  },
});
