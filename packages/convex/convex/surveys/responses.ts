import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getAuthenticatedUserFromSession } from "../auth";
import { requirePermission } from "../permissions";
import { resolveVisitorFromSession } from "../widgetSessions";
import { logAudit } from "../auditLogs";
import {
  canManageSurveys,
  escapeCsvCell,
  serializeAnswerValue,
  storeAnswersAsAttributes,
} from "./helpers";

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

    let existingResponse: Doc<"surveyResponses"> | undefined = undefined;
    if (authorizedVisitorId) {
      const responses = await ctx.db
        .query("surveyResponses")
        .withIndex("by_visitor_survey", (q) =>
          q.eq("visitorId", authorizedVisitorId).eq("surveyId", args.surveyId)
        )
        .collect();
      existingResponse = responses.find((response) => response.status === "partial");
    }

    if (existingResponse) {
      await ctx.db.patch(existingResponse._id, {
        answers: args.answers,
        status: args.isComplete ? "completed" : "partial",
        completedAt: args.isComplete ? now : undefined,
      });

      if (args.isComplete && authorizedVisitorId) {
        await storeAnswersAsAttributes(ctx, survey, args.answers, authorizedVisitorId);
      }

      return existingResponse._id;
    }

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

    if (args.isComplete && authorizedVisitorId) {
      await storeAnswersAsAttributes(ctx, survey, args.answers, authorizedVisitorId);
    }

    return responseId;
  },
});

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

    const responses = await ctx.db
      .query("surveyResponses")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.surveyId))
      .collect();

    let filtered = responses;
    if (args.status) {
      filtered = responses.filter((response) => response.status === args.status);
    }

    if (args.limit) {
      filtered = filtered.slice(0, args.limit);
    }

    return filtered;
  },
});

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
