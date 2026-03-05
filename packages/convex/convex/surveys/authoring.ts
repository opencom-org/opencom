import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { countMatchingVisitors, type AudienceRule, validateAudienceRule } from "../audienceRules";
import { audienceRulesValidator } from "../validators";
import { canManageSurveys, requireSurveyManagePermission } from "./helpers";

const questionValidator = v.object({
  id: v.string(),
  type: v.union(
    v.literal("nps"),
    v.literal("numeric_scale"),
    v.literal("star_rating"),
    v.literal("emoji_rating"),
    v.literal("dropdown"),
    v.literal("short_text"),
    v.literal("long_text"),
    v.literal("multiple_choice")
  ),
  title: v.string(),
  description: v.optional(v.string()),
  required: v.boolean(),
  storeAsAttribute: v.optional(v.string()),
  options: v.optional(
    v.object({
      scaleStart: v.optional(v.number()),
      scaleEnd: v.optional(v.number()),
      startLabel: v.optional(v.string()),
      endLabel: v.optional(v.string()),
      starLabels: v.optional(
        v.object({
          low: v.optional(v.string()),
          high: v.optional(v.string()),
        })
      ),
      emojiCount: v.optional(v.union(v.literal(3), v.literal(5))),
      emojiLabels: v.optional(
        v.object({
          low: v.optional(v.string()),
          high: v.optional(v.string()),
        })
      ),
      choices: v.optional(v.array(v.string())),
      allowMultiple: v.optional(v.boolean()),
    })
  ),
});

const surveyStepValidator = v.object({
  title: v.string(),
  description: v.optional(v.string()),
  buttonText: v.optional(v.string()),
});

const surveyTriggerValidator = v.object({
  type: v.union(
    v.literal("immediate"),
    v.literal("page_visit"),
    v.literal("time_on_page"),
    v.literal("event")
  ),
  pageUrl: v.optional(v.string()),
  pageUrlMatch: v.optional(v.union(v.literal("exact"), v.literal("contains"), v.literal("regex"))),
  delaySeconds: v.optional(v.number()),
  eventName: v.optional(v.string()),
});

const surveySchedulingValidator = v.object({
  startDate: v.optional(v.number()),
  endDate: v.optional(v.number()),
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    format: v.union(v.literal("small"), v.literal("large")),
    questions: v.optional(v.array(questionValidator)),
    introStep: v.optional(surveyStepValidator),
    thankYouStep: v.optional(surveyStepValidator),
    showProgressBar: v.optional(v.boolean()),
    showDismissButton: v.optional(v.boolean()),
    audienceRules: v.optional(audienceRulesValidator),
    triggers: v.optional(surveyTriggerValidator),
    frequency: v.optional(v.union(v.literal("once"), v.literal("until_completed"))),
    scheduling: v.optional(surveySchedulingValidator),
  },
  handler: async (ctx, args) => {
    await requireSurveyManagePermission(ctx, args.workspaceId);

    if (args.audienceRules !== undefined && !validateAudienceRule(args.audienceRules)) {
      throw new Error("Invalid audience rules");
    }

    const now = Date.now();

    return await ctx.db.insert("surveys", {
      workspaceId: args.workspaceId,
      name: args.name,
      description: args.description,
      format: args.format,
      status: "draft",
      questions: args.questions ?? [],
      introStep: args.introStep,
      thankYouStep: args.thankYouStep,
      showProgressBar: args.showProgressBar ?? true,
      showDismissButton: args.showDismissButton ?? true,
      audienceRules: args.audienceRules,
      triggers: args.triggers,
      frequency: args.frequency ?? "once",
      scheduling: args.scheduling,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("surveys"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    format: v.optional(v.union(v.literal("small"), v.literal("large"))),
    questions: v.optional(v.array(questionValidator)),
    introStep: v.optional(surveyStepValidator),
    thankYouStep: v.optional(surveyStepValidator),
    showProgressBar: v.optional(v.boolean()),
    showDismissButton: v.optional(v.boolean()),
    audienceRules: v.optional(audienceRulesValidator),
    triggers: v.optional(surveyTriggerValidator),
    frequency: v.optional(v.union(v.literal("once"), v.literal("until_completed"))),
    scheduling: v.optional(surveySchedulingValidator),
  },
  handler: async (ctx, args) => {
    const survey = (await ctx.db.get(args.id)) as Doc<"surveys"> | null;
    if (!survey) {
      throw new Error("Survey not found");
    }
    await requireSurveyManagePermission(ctx, survey.workspaceId);

    if (args.audienceRules !== undefined && !validateAudienceRule(args.audienceRules)) {
      throw new Error("Invalid audience rules");
    }

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.format !== undefined) updates.format = args.format;
    if (args.questions !== undefined) updates.questions = args.questions;
    if (args.introStep !== undefined) updates.introStep = args.introStep;
    if (args.thankYouStep !== undefined) updates.thankYouStep = args.thankYouStep;
    if (args.showProgressBar !== undefined) updates.showProgressBar = args.showProgressBar;
    if (args.showDismissButton !== undefined) updates.showDismissButton = args.showDismissButton;
    if (args.audienceRules !== undefined) updates.audienceRules = args.audienceRules;
    if (args.triggers !== undefined) updates.triggers = args.triggers;
    if (args.frequency !== undefined) updates.frequency = args.frequency;
    if (args.scheduling !== undefined) updates.scheduling = args.scheduling;

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

export const remove = mutation({
  args: {
    id: v.id("surveys"),
  },
  handler: async (ctx, args) => {
    const survey = (await ctx.db.get(args.id)) as Doc<"surveys"> | null;
    if (!survey) {
      throw new Error("Survey not found");
    }
    await requireSurveyManagePermission(ctx, survey.workspaceId);

    const responses = await ctx.db
      .query("surveyResponses")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.id))
      .collect();

    for (const response of responses) {
      await ctx.db.delete(response._id);
    }

    const impressions = await ctx.db
      .query("surveyImpressions")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.id))
      .collect();

    for (const impression of impressions) {
      await ctx.db.delete(impression._id);
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const get = query({
  args: {
    id: v.id("surveys"),
  },
  handler: async (ctx, args) => {
    const survey = (await ctx.db.get(args.id)) as Doc<"surveys"> | null;
    if (!survey) {
      return null;
    }

    const canManage = await canManageSurveys(ctx, survey.workspaceId);
    if (!canManage) {
      return null;
    }

    return survey;
  },
});

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(
      v.union(v.literal("draft"), v.literal("active"), v.literal("paused"), v.literal("archived"))
    ),
  },
  handler: async (ctx, args) => {
    const canManage = await canManageSurveys(ctx, args.workspaceId);
    if (!canManage) {
      return [];
    }

    if (args.status) {
      return await ctx.db
        .query("surveys")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", args.status!)
        )
        .collect();
    }

    return await ctx.db
      .query("surveys")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const activate = mutation({
  args: {
    id: v.id("surveys"),
  },
  handler: async (ctx, args) => {
    const survey = (await ctx.db.get(args.id)) as Doc<"surveys"> | null;
    if (!survey) {
      throw new Error("Survey not found");
    }
    await requireSurveyManagePermission(ctx, survey.workspaceId);

    if (survey.questions.length === 0) {
      throw new Error("Survey must have at least one question");
    }

    await ctx.db.patch(args.id, {
      status: "active",
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const pause = mutation({
  args: {
    id: v.id("surveys"),
  },
  handler: async (ctx, args) => {
    const survey = (await ctx.db.get(args.id)) as Doc<"surveys"> | null;
    if (!survey) {
      throw new Error("Survey not found");
    }
    await requireSurveyManagePermission(ctx, survey.workspaceId);

    await ctx.db.patch(args.id, {
      status: "paused",
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const archive = mutation({
  args: {
    id: v.id("surveys"),
  },
  handler: async (ctx, args) => {
    const survey = (await ctx.db.get(args.id)) as Doc<"surveys"> | null;
    if (!survey) {
      throw new Error("Survey not found");
    }
    await requireSurveyManagePermission(ctx, survey.workspaceId);

    await ctx.db.patch(args.id, {
      status: "archived",
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const duplicate = mutation({
  args: {
    id: v.id("surveys"),
  },
  handler: async (ctx, args) => {
    const survey = (await ctx.db.get(args.id)) as Doc<"surveys"> | null;
    if (!survey) {
      throw new Error("Survey not found");
    }
    await requireSurveyManagePermission(ctx, survey.workspaceId);

    const now = Date.now();

    const newSurveyId = await ctx.db.insert("surveys", {
      workspaceId: survey.workspaceId,
      name: `${survey.name} (Copy)`,
      description: survey.description,
      format: survey.format,
      status: "draft",
      questions: survey.questions,
      introStep: survey.introStep,
      thankYouStep: survey.thankYouStep,
      showProgressBar: survey.showProgressBar,
      showDismissButton: survey.showDismissButton,
      audienceRules: survey.audienceRules,
      triggers: survey.triggers,
      frequency: survey.frequency,
      scheduling: undefined,
      createdAt: now,
      updatedAt: now,
    });

    return newSurveyId;
  },
});

export const previewAudienceRules = query({
  args: {
    workspaceId: v.id("workspaces"),
    audienceRules: v.optional(audienceRulesValidator),
  },
  handler: async (ctx, args) => {
    const canManage = await canManageSurveys(ctx, args.workspaceId);
    if (!canManage) {
      return { total: 0, matching: 0 };
    }

    return await countMatchingVisitors(
      ctx,
      args.workspaceId,
      args.audienceRules as AudienceRule | undefined
    );
  },
});
