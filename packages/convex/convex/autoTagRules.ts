import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { authMutation, authQuery } from "./lib/authWrappers";

const conditionValidator = v.object({
  field: v.union(
    v.literal("visitor.email"),
    v.literal("visitor.name"),
    v.literal("visitor.country"),
    v.literal("visitor.customAttributes"),
    v.literal("conversation.channel"),
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

export const list = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  permission: "settings.workspace",
  handler: async (ctx, args) => {
    const rules = await ctx.db
      .query("autoTagRules")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    // Enrich with tag details
    const enrichedRules = await Promise.all(
      rules.map(async (rule) => {
        const tag = (await ctx.db.get(rule.tagId)) as Doc<"tags"> | null;
        return {
          ...rule,
          tag,
        };
      })
    );

    return enrichedRules;
  },
});

export const get = authQuery({
  args: {
    id: v.id("autoTagRules"),
  },
  permission: "settings.workspace",
  allowMissingWorkspace: true,
  resolveWorkspaceId: async (ctx, args) => {
    const rule = (await ctx.db.get(args.id)) as Doc<"autoTagRules"> | null;
    return rule?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const rule = (await ctx.db.get(args.id)) as Doc<"autoTagRules"> | null;
    if (!rule) return null;

    const tag = (await ctx.db.get(rule.tagId)) as Doc<"tags"> | null;
    return { ...rule, tag };
  },
});

export const create = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    enabled: v.boolean(),
    conditions: v.array(conditionValidator),
    tagId: v.id("tags"),
  },
  permission: "settings.workspace",
  handler: async (ctx, args) => {
    const tagToCreate = (await ctx.db.get(args.tagId)) as Doc<"tags"> | null;
    if (!tagToCreate) {
      throw new Error("Tag not found");
    }

    if (tagToCreate.workspaceId !== args.workspaceId) {
      throw new Error("Tag does not belong to this workspace");
    }

    const now = Date.now();
    return await ctx.db.insert("autoTagRules", {
      workspaceId: args.workspaceId,
      name: args.name,
      enabled: args.enabled,
      conditions: args.conditions,
      tagId: args.tagId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = authMutation({
  args: {
    id: v.id("autoTagRules"),
    name: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
    conditions: v.optional(v.array(conditionValidator)),
    tagId: v.optional(v.id("tags")),
  },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const rule = (await ctx.db.get(args.id)) as Doc<"autoTagRules"> | null;
    return rule?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const rule = (await ctx.db.get(args.id)) as Doc<"autoTagRules"> | null;
    if (!rule) {
      throw new Error("Auto-tag rule not found");
    }

    if (args.tagId) {
      const tagToCheck = (await ctx.db.get(args.tagId)) as Doc<"tags"> | null;
      if (!tagToCheck) {
        throw new Error("Tag not found");
      }
      if (tagToCheck.workspaceId !== rule.workspaceId) {
        throw new Error("Tag does not belong to this workspace");
      }
    }

    await ctx.db.patch(args.id, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.enabled !== undefined && { enabled: args.enabled }),
      ...(args.conditions !== undefined && { conditions: args.conditions }),
      ...(args.tagId !== undefined && { tagId: args.tagId }),
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

export const remove = authMutation({
  args: {
    id: v.id("autoTagRules"),
  },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const rule = (await ctx.db.get(args.id)) as Doc<"autoTagRules"> | null;
    return rule?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
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

export const applyAutoTags = internalMutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const conversation = (await ctx.db.get(args.conversationId)) as Doc<"conversations"> | null;
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const rules = await ctx.db
      .query("autoTagRules")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", conversation.workspaceId))
      .collect();

    const enabledRules = rules.filter((r) => r.enabled);

    if (enabledRules.length === 0) {
      return [];
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

    // Evaluate all rules and apply matching tags
    const appliedTags: { ruleId: string; tagId: string }[] = [];

    for (const rule of enabledRules) {
      const allConditionsMet = rule.conditions.every((condition) =>
        evaluateCondition(condition, context)
      );

      if (allConditionsMet) {
        // Check if tag is already applied
        const existing = await ctx.db
          .query("conversationTags")
          .withIndex("by_conversation_tag", (q) =>
            q.eq("conversationId", args.conversationId).eq("tagId", rule.tagId)
          )
          .first();

        if (!existing) {
          await ctx.db.insert("conversationTags", {
            conversationId: args.conversationId,
            tagId: rule.tagId,
            appliedBy: "auto",
            createdAt: Date.now(),
          });

          appliedTags.push({
            ruleId: rule._id,
            tagId: rule.tagId,
          });
        }
      }
    }

    return appliedTags;
  },
});
