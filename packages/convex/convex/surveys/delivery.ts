import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getAuthenticatedUserFromSession } from "../auth";
import { hasPermission } from "../permissions";
import { resolveVisitorFromSession } from "../widgetSessions";
import { requireSurveyManagePermission } from "./helpers";

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

    const impressionId = await ctx.db.insert("surveyImpressions", {
      surveyId: args.surveyId,
      visitorId: resolved.visitorId,
      sessionId: args.sessionId,
      action: args.action,
      createdAt: Date.now(),
    });

    return impressionId;
  },
});

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

    const activeSurveys = await ctx.db
      .query("surveys")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "active")
      )
      .collect();

    const scheduledSurveys = activeSurveys.filter((survey) => {
      if (!survey.scheduling) {
        return true;
      }
      const { startDate, endDate } = survey.scheduling;
      if (startDate && now < startDate) {
        return false;
      }
      if (endDate && now > endDate) {
        return false;
      }
      return true;
    });

    if (!authorizedVisitorId) {
      return scheduledSurveys;
    }
    const visitorId = authorizedVisitorId;

    const completedResponses = await ctx.db
      .query("surveyResponses")
      .withIndex("by_visitor", (q) => q.eq("visitorId", visitorId))
      .collect();

    const completedSurveyIds = new Set(
      completedResponses
        .filter((response) => response.status === "completed")
        .map((response) => response.surveyId.toString())
    );

    const impressions = await ctx.db
      .query("surveyImpressions")
      .withIndex("by_visitor", (q) => q.eq("visitorId", visitorId))
      .collect();

    const shownSurveyIds = new Set(
      impressions
        .filter((impression) => impression.action === "shown")
        .map((impression) => impression.surveyId.toString())
    );

    const eligibleSurveys = scheduledSurveys.filter((survey) => {
      const surveyIdStr = survey._id.toString();

      if (completedSurveyIds.has(surveyIdStr)) {
        return false;
      }

      if (survey.frequency === "once" && shownSurveyIds.has(surveyIdStr)) {
        return false;
      }

      return true;
    });

    return eligibleSurveys;
  },
});

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

    const impressions = await ctx.db
      .query("surveyImpressions")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.surveyId))
      .collect();

    const responses = await ctx.db
      .query("surveyResponses")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.surveyId))
      .collect();

    const shown = impressions.filter((impression) => impression.action === "shown").length;
    const started = impressions.filter((impression) => impression.action === "started").length;
    const completed = responses.filter((response) => response.status === "completed").length;
    const dismissed = impressions.filter((impression) => impression.action === "dismissed").length;

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
        .filter((response) => response.status === "completed")
        .flatMap((response) => response.answers)
        .filter((answer) => answer.questionId === question.id);

      const distribution: Record<string, number> = {};
      let sum = 0;
      let numericCount = 0;

      for (const answer of answersForQuestion) {
        const valueStr = String(answer.value);
        distribution[valueStr] = (distribution[valueStr] || 0) + 1;

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

      if (
        numericCount > 0 &&
        ["nps", "numeric_scale", "star_rating", "emoji_rating"].includes(question.type)
      ) {
        analytics.average = sum / numericCount;
      }

      if (question.type === "nps" && answersForQuestion.length > 0) {
        let promoters = 0;
        let detractors = 0;
        for (const answer of answersForQuestion) {
          const value = Number(answer.value);
          if (value >= 9) {
            promoters++;
          } else if (value <= 6) {
            detractors++;
          }
        }
        analytics.npsScore = Math.round(((promoters - detractors) / answersForQuestion.length) * 100);
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
