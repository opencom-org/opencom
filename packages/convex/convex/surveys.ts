import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { countMatchingVisitors, AudienceRule, validateAudienceRule } from "./audienceRules";
import { getAuthenticatedUserFromSession } from "./auth";
import { hasPermission, requirePermission } from "./permissions";
import { resolveVisitorFromSession } from "./widgetSessions";
import { audienceRulesValidator } from "./validators";
import { logAudit } from "./auditLogs";

async function requireSurveyManagePermission(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
) {
  const user = await getAuthenticatedUserFromSession(ctx);
  if (!user) {
    throw new Error("Not authenticated");
  }
  await requirePermission(ctx, user._id, workspaceId, "settings.workspace");
  return user;
}

async function canManageSurveys(ctx: QueryCtx | MutationCtx, workspaceId: Id<"workspaces">) {
  const user = await getAuthenticatedUserFromSession(ctx);
  if (!user) {
    return false;
  }
  return await hasPermission(ctx, user._id, workspaceId, "settings.workspace");
}

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

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    format: v.union(v.literal("small"), v.literal("large")),
    questions: v.optional(v.array(questionValidator)),
    introStep: v.optional(
      v.object({
        title: v.string(),
        description: v.optional(v.string()),
        buttonText: v.optional(v.string()),
      })
    ),
    thankYouStep: v.optional(
      v.object({
        title: v.string(),
        description: v.optional(v.string()),
        buttonText: v.optional(v.string()),
      })
    ),
    showProgressBar: v.optional(v.boolean()),
    showDismissButton: v.optional(v.boolean()),
    audienceRules: v.optional(audienceRulesValidator),
    triggers: v.optional(
      v.object({
        type: v.union(
          v.literal("immediate"),
          v.literal("page_visit"),
          v.literal("time_on_page"),
          v.literal("event")
        ),
        pageUrl: v.optional(v.string()),
        pageUrlMatch: v.optional(
          v.union(v.literal("exact"), v.literal("contains"), v.literal("regex"))
        ),
        delaySeconds: v.optional(v.number()),
        eventName: v.optional(v.string()),
      })
    ),
    frequency: v.optional(v.union(v.literal("once"), v.literal("until_completed"))),
    scheduling: v.optional(
      v.object({
        startDate: v.optional(v.number()),
        endDate: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireSurveyManagePermission(ctx, args.workspaceId);

    // Validate audienceRules if provided
    if (args.audienceRules !== undefined && !validateAudienceRule(args.audienceRules)) {
      throw new Error("Invalid audience rules");
    }

    const now = Date.now();

    const surveyId = await ctx.db.insert("surveys", {
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

    return surveyId;
  },
});

export const update = mutation({
  args: {
    id: v.id("surveys"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    format: v.optional(v.union(v.literal("small"), v.literal("large"))),
    questions: v.optional(v.array(questionValidator)),
    introStep: v.optional(
      v.object({
        title: v.string(),
        description: v.optional(v.string()),
        buttonText: v.optional(v.string()),
      })
    ),
    thankYouStep: v.optional(
      v.object({
        title: v.string(),
        description: v.optional(v.string()),
        buttonText: v.optional(v.string()),
      })
    ),
    showProgressBar: v.optional(v.boolean()),
    showDismissButton: v.optional(v.boolean()),
    audienceRules: v.optional(audienceRulesValidator),
    triggers: v.optional(
      v.object({
        type: v.union(
          v.literal("immediate"),
          v.literal("page_visit"),
          v.literal("time_on_page"),
          v.literal("event")
        ),
        pageUrl: v.optional(v.string()),
        pageUrlMatch: v.optional(
          v.union(v.literal("exact"), v.literal("contains"), v.literal("regex"))
        ),
        delaySeconds: v.optional(v.number()),
        eventName: v.optional(v.string()),
      })
    ),
    frequency: v.optional(v.union(v.literal("once"), v.literal("until_completed"))),
    scheduling: v.optional(
      v.object({
        startDate: v.optional(v.number()),
        endDate: v.optional(v.number()),
      })
    ),
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

    // Delete all responses for this survey
    const responses = await ctx.db
      .query("surveyResponses")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.id))
      .collect();

    for (const response of responses) {
      await ctx.db.delete(response._id);
    }

    // Delete all impressions for this survey
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

// Survey Responses

export const submitResponse = mutation({
  args: {
    surveyId: v.id("surveys"),
    visitorId: v.optional(v.id("visitors")),
    userId: v.optional(v.id("users")),
    sessionId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    answers: v.array(
      v.object({
        questionId: v.string(),
        value: v.union(
          v.string(),
          v.number(),
          v.boolean(),
          v.null(),
          v.array(v.string()),
          v.array(v.number())
        ),
      })
    ),
    isComplete: v.boolean(),
  },
  handler: async (ctx, args) => {
    const survey = (await ctx.db.get(args.surveyId)) as Doc<"surveys"> | null;
    if (!survey) {
      throw new Error("Survey not found");
    }

    const authUser = await getAuthenticatedUserFromSession(ctx);
    let authorizedVisitorId: Id<"visitors"> | undefined = undefined;

    if (authUser) {
      await requirePermission(ctx, authUser._id, survey.workspaceId, "settings.workspace");
      if (args.userId && args.userId !== authUser._id) {
        throw new Error("Cannot submit survey response on behalf of another user");
      }
    } else {
      const resolved = await resolveVisitorFromSession(ctx, {
        sessionToken: args.sessionToken,
        workspaceId: survey.workspaceId,
      });
      if (args.visitorId && resolved.visitorId !== args.visitorId) {
        throw new Error("Not authorized to submit survey response");
      }
      if (args.userId) {
        throw new Error("Cannot submit visitor response with userId");
      }
      authorizedVisitorId = resolved.visitorId;
    }

    const now = Date.now();

    // Check for existing partial response from this visitor
    let existingResponse: Doc<"surveyResponses"> | undefined = undefined;
    if (authorizedVisitorId) {
      const responses = await ctx.db
        .query("surveyResponses")
        .withIndex("by_visitor_survey", (q) =>
          q.eq("visitorId", authorizedVisitorId).eq("surveyId", args.surveyId)
        )
        .collect();
      existingResponse = responses.find((r) => r.status === "partial");
    }

    if (existingResponse) {
      // Update existing response
      await ctx.db.patch(existingResponse._id, {
        answers: args.answers,
        status: args.isComplete ? "completed" : "partial",
        completedAt: args.isComplete ? now : undefined,
      });

      // Store answers as user attributes if configured
      if (args.isComplete && authorizedVisitorId) {
        await storeAnswersAsAttributes(ctx, survey, args.answers, authorizedVisitorId);
      }

      return existingResponse._id;
    } else {
      // Create new response
      const responseId = await ctx.db.insert("surveyResponses", {
        surveyId: args.surveyId,
        workspaceId: survey.workspaceId,
        visitorId: authorizedVisitorId,
        userId: args.userId,
        sessionId: args.sessionId,
        answers: args.answers,
        status: args.isComplete ? "completed" : "partial",
        startedAt: now,
        completedAt: args.isComplete ? now : undefined,
      });

      // Store answers as user attributes if configured
      if (args.isComplete && authorizedVisitorId) {
        await storeAnswersAsAttributes(ctx, survey, args.answers, authorizedVisitorId);
      }

      return responseId;
    }
  },
});

async function storeAnswersAsAttributes(
  ctx: MutationCtx,
  survey: { questions: Array<{ id: string; storeAsAttribute?: string }> },
  answers: Array<{ questionId: string; value: unknown }>,
  visitorId: Id<"visitors">
) {
  const visitor = (await ctx.db.get(visitorId)) as Doc<"visitors"> | null;
  if (!visitor) return;

  const customAttributes = { ...(visitor.customAttributes || {}) } as Record<
    string,
    string | number | boolean | (string | number)[] | {} | null
  >;
  let hasUpdates = false;

  for (const answer of answers) {
    const question = survey.questions.find((q) => q.id === answer.questionId);
    if (question?.storeAsAttribute) {
      // Cast answer.value to allowed attribute types
      const value = answer.value as string | number | boolean | (string | number)[] | {} | null;
      customAttributes[question.storeAsAttribute] = value;
      hasUpdates = true;
    }
  }

  if (hasUpdates) {
    await ctx.db.patch(visitorId, { customAttributes });
  }
}

export const listResponses = query({
  args: {
    surveyId: v.id("surveys"),
    status: v.optional(v.union(v.literal("partial"), v.literal("completed"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const survey = (await ctx.db.get(args.surveyId)) as Doc<"surveys"> | null;
    if (!survey) {
      throw new Error("Survey not found");
    }
    const canManage = await canManageSurveys(ctx, survey.workspaceId);
    if (!canManage) {
      return [];
    }

    let query = ctx.db
      .query("surveyResponses")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.surveyId));

    const responses = await query.collect();

    let filtered = responses;
    if (args.status) {
      filtered = responses.filter((r) => r.status === args.status);
    }

    if (args.limit) {
      filtered = filtered.slice(0, args.limit);
    }

    return filtered;
  },
});

function serializeAnswerValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function escapeCsvCell(value: string): string {
  if (!/[",\n]/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}

export const exportResponsesCsv = mutation({
  args: {
    surveyId: v.id("surveys"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const survey = (await ctx.db.get(args.surveyId)) as Doc<"surveys"> | null;
    if (!survey) {
      throw new Error("Survey not found");
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, survey.workspaceId, "data.export");

    const responses = await ctx.db
      .query("surveyResponses")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.surveyId))
      .collect();

    const filteredResponses = responses.filter((response) => {
      const timestamp = response.completedAt ?? response.startedAt;
      if (args.startDate !== undefined && timestamp < args.startDate) {
        return false;
      }
      if (args.endDate !== undefined && timestamp > args.endDate) {
        return false;
      }
      return true;
    });

    const questionColumnIds = survey.questions.map((question) => question.id);
    const headers = [
      "responseId",
      "visitorId",
      "userId",
      "sessionId",
      "status",
      "startedAt",
      "completedAt",
      ...questionColumnIds.map((questionId) => `answer:${questionId}`),
    ];

    const rows = filteredResponses.map((response) => {
      const answerByQuestion = new Map(
        response.answers.map((answer) => [answer.questionId, serializeAnswerValue(answer.value)])
      );

      const values = [
        response._id,
        response.visitorId ?? "",
        response.userId ?? "",
        response.sessionId ?? "",
        response.status,
        String(response.startedAt),
        response.completedAt ? String(response.completedAt) : "",
        ...questionColumnIds.map((questionId) => answerByQuestion.get(questionId) ?? ""),
      ];
      return values.map((value) => escapeCsvCell(String(value))).join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");

    await logAudit(ctx, {
      workspaceId: survey.workspaceId,
      actorType: "user",
      actorId: user._id,
      action: "data.exported",
      resourceType: "surveys",
      resourceId: args.surveyId,
      metadata: {
        format: "csv",
        responseCount: filteredResponses.length,
        ...(args.startDate != null && { startDate: args.startDate }),
        ...(args.endDate != null && { endDate: args.endDate }),
      },
    });

    return {
      fileName: `survey-${args.surveyId}-responses.csv`,
      count: filteredResponses.length,
      csv,
    };
  },
});

// Survey Impressions

export const recordImpression = mutation({
  args: {
    surveyId: v.id("surveys"),
    visitorId: v.optional(v.id("visitors")),
    sessionId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    action: v.union(
      v.literal("shown"),
      v.literal("started"),
      v.literal("completed"),
      v.literal("dismissed")
    ),
  },
  handler: async (ctx, args) => {
    const survey = (await ctx.db.get(args.surveyId)) as Doc<"surveys"> | null;
    if (!survey) {
      throw new Error("Survey not found");
    }

    const resolved = await resolveVisitorFromSession(ctx, {
      sessionToken: args.sessionToken,
      workspaceId: survey.workspaceId,
    });
    if (args.visitorId && resolved.visitorId !== args.visitorId) {
      throw new Error("Not authorized to record survey impression");
    }

    const now = Date.now();

    const impressionId = await ctx.db.insert("surveyImpressions", {
      surveyId: args.surveyId,
      visitorId: resolved.visitorId,
      sessionId: args.sessionId,
      action: args.action,
      createdAt: now,
    });

    return impressionId;
  },
});

// Get active surveys for a visitor (for widget/mobile display)
export const getActiveSurveys = query({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUserFromSession(ctx);
    let authorizedVisitorId: Id<"visitors"> | undefined = undefined;

    if (authUser) {
      const canManage = await hasPermission(
        ctx,
        authUser._id,
        args.workspaceId,
        "settings.workspace"
      );
      if (!canManage) {
        return [];
      }
    } else {
      try {
        const resolved = await resolveVisitorFromSession(ctx, {
          sessionToken: args.sessionToken,
          workspaceId: args.workspaceId,
        });
        if (args.visitorId && resolved.visitorId !== args.visitorId) {
          return [];
        }
        authorizedVisitorId = resolved.visitorId;
      } catch {
        return [];
      }
    }

    const now = Date.now();

    // Get all active surveys for the workspace
    const activeSurveys = await ctx.db
      .query("surveys")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "active")
      )
      .collect();

    // Filter by scheduling
    const scheduledSurveys = activeSurveys.filter((survey) => {
      if (!survey.scheduling) return true;
      const { startDate, endDate } = survey.scheduling;
      if (startDate && now < startDate) return false;
      if (endDate && now > endDate) return false;
      return true;
    });

    if (!authorizedVisitorId) {
      return scheduledSurveys;
    }
    const visitorId = authorizedVisitorId;

    // Get visitor's completed surveys and impressions
    const completedResponses = await ctx.db
      .query("surveyResponses")
      .withIndex("by_visitor", (q) => q.eq("visitorId", visitorId))
      .collect();

    const completedSurveyIds = new Set(
      completedResponses.filter((r) => r.status === "completed").map((r) => r.surveyId.toString())
    );

    const impressions = await ctx.db
      .query("surveyImpressions")
      .withIndex("by_visitor", (q) => q.eq("visitorId", visitorId))
      .collect();

    const shownSurveyIds = new Set(
      impressions.filter((i) => i.action === "shown").map((i) => i.surveyId.toString())
    );

    // Filter based on frequency rules
    const eligibleSurveys = scheduledSurveys.filter((survey) => {
      const surveyIdStr = survey._id.toString();

      // If already completed, don't show again
      if (completedSurveyIds.has(surveyIdStr)) {
        return false;
      }

      // Check frequency
      if (survey.frequency === "once" && shownSurveyIds.has(surveyIdStr)) {
        return false;
      }

      return true;
    });

    return eligibleSurveys;
  },
});

// Analytics queries

export const getAnalytics = query({
  args: {
    surveyId: v.id("surveys"),
  },
  handler: async (ctx, args) => {
    const survey = (await ctx.db.get(args.surveyId)) as Doc<"surveys"> | null;
    if (!survey) {
      throw new Error("Survey not found");
    }
    await requireSurveyManagePermission(ctx, survey.workspaceId);

    // Get all impressions
    const impressions = await ctx.db
      .query("surveyImpressions")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.surveyId))
      .collect();

    // Get all responses
    const responses = await ctx.db
      .query("surveyResponses")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.surveyId))
      .collect();

    const shown = impressions.filter((i) => i.action === "shown").length;
    const started = impressions.filter((i) => i.action === "started").length;
    const completed = responses.filter((r) => r.status === "completed").length;
    const dismissed = impressions.filter((i) => i.action === "dismissed").length;

    // Calculate answer distributions per question
    const questionAnalytics: Record<
      string,
      {
        questionId: string;
        questionTitle: string;
        questionType: string;
        totalResponses: number;
        distribution: Record<string, number>;
        average?: number;
        npsScore?: number;
      }
    > = {};

    for (const question of survey.questions) {
      const answersForQuestion = responses
        .filter((r) => r.status === "completed")
        .flatMap((r) => r.answers)
        .filter((a) => a.questionId === question.id);

      const distribution: Record<string, number> = {};
      let sum = 0;
      let numericCount = 0;

      for (const answer of answersForQuestion) {
        const valueStr = String(answer.value);
        distribution[valueStr] = (distribution[valueStr] || 0) + 1;

        // Calculate average for numeric types
        if (typeof answer.value === "number") {
          sum += answer.value;
          numericCount++;
        }
      }

      const analytics: (typeof questionAnalytics)[string] = {
        questionId: question.id,
        questionTitle: question.title,
        questionType: question.type,
        totalResponses: answersForQuestion.length,
        distribution,
      };

      // Add average for numeric types
      if (
        numericCount > 0 &&
        ["nps", "numeric_scale", "star_rating", "emoji_rating"].includes(question.type)
      ) {
        analytics.average = sum / numericCount;
      }

      // Calculate NPS score for NPS questions
      if (question.type === "nps" && answersForQuestion.length > 0) {
        let promoters = 0;
        let detractors = 0;
        for (const answer of answersForQuestion) {
          const value = Number(answer.value);
          if (value >= 9) promoters++;
          else if (value <= 6) detractors++;
        }
        analytics.npsScore = Math.round(
          ((promoters - detractors) / answersForQuestion.length) * 100
        );
      }

      questionAnalytics[question.id] = analytics;
    }

    return {
      surveyId: args.surveyId,
      impressions: {
        shown,
        started,
        completed,
        dismissed,
      },
      responseRate: shown > 0 ? Math.round((completed / shown) * 100) : 0,
      completionRate: started > 0 ? Math.round((completed / started) * 100) : 0,
      totalResponses: completed,
      questionAnalytics,
    };
  },
});
