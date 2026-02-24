import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { formatReadableVisitorId } from "../visitorReadableId";

const seriesEntryTriggerTestValidator = v.object({
  source: v.union(
    v.literal("event"),
    v.literal("auto_event"),
    v.literal("visitor_attribute_changed"),
    v.literal("visitor_state_changed")
  ),
  eventName: v.optional(v.string()),
  attributeKey: v.optional(v.string()),
  fromValue: v.optional(v.string()),
  toValue: v.optional(v.string()),
});

const seriesProgressStatusValidator = v.union(
  v.literal("active"),
  v.literal("waiting"),
  v.literal("completed"),
  v.literal("exited"),
  v.literal("goal_reached"),
  v.literal("failed")
);

/**
 * Creates an isolated test workspace with a unique name.
 * Use this at the start of each test suite to ensure data isolation.
 */
export const createTestWorkspace = internalMutation({
  args: {
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const workspaceName = args.name || `test-workspace-${timestamp}-${randomSuffix}`;

    const workspaceId = await ctx.db.insert("workspaces", {
      name: workspaceName,
      createdAt: timestamp,
      helpCenterAccessPolicy: "public",
      signupMode: "invite-only",
      authMethods: ["password", "otp"],
    });

    // Create a default admin user for the workspace
    const email = `admin-${randomSuffix}@test.opencom.dev`;
    const userId = await ctx.db.insert("users", {
      email,
      name: "Test Admin",
      workspaceId,
      role: "admin",
      createdAt: timestamp,
    });

    await ctx.db.insert("workspaceMembers", {
      userId,
      workspaceId,
      role: "admin",
      createdAt: timestamp,
    });

    return { workspaceId, userId, name: workspaceName };
  },
});

/**
 * Updates workspace help-center access policy directly (bypasses auth).
 */
export const updateTestHelpCenterAccessPolicy = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    policy: v.union(v.literal("public"), v.literal("restricted")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workspaceId, {
      helpCenterAccessPolicy: args.policy,
    });
  },
});

/**
 * Runs series enrollment evaluation for a visitor with explicit trigger context.
 */
export const runSeriesEvaluateEnrollmentForVisitor: ReturnType<typeof internalMutation> =
  internalMutation({
    args: {
      workspaceId: v.id("workspaces"),
      visitorId: v.id("visitors"),
      triggerContext: seriesEntryTriggerTestValidator,
    },
    handler: async (ctx, args): Promise<unknown> => {
      return await ctx.runMutation((internal as any).series.evaluateEnrollmentForVisitor, args);
    },
  });

/**
 * Runs event-based wait resumption for waiting series progress records.
 */
export const runSeriesResumeWaitingForEvent: ReturnType<typeof internalMutation> = internalMutation(
  {
    args: {
      workspaceId: v.id("workspaces"),
      visitorId: v.id("visitors"),
      eventName: v.string(),
    },
    handler: async (ctx, args): Promise<unknown> => {
      return await ctx.runMutation((internal as any).series.resumeWaitingForEvent, args);
    },
  }
);

/**
 * Runs wait backstop processing for active series.
 */
export const runSeriesProcessWaitingProgress: ReturnType<typeof internalMutation> =
  internalMutation({
    args: {
      seriesLimit: v.optional(v.number()),
      waitingLimitPerSeries: v.optional(v.number()),
    },
    handler: async (ctx, args): Promise<unknown> => {
      return await ctx.runMutation((internal as any).series.processWaitingProgress, args);
    },
  });

/**
 * Returns the current progress record for a visitor in a series.
 */
export const getSeriesProgressForVisitorSeries = internalMutation({
  args: {
    visitorId: v.id("visitors"),
    seriesId: v.id("series"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("seriesProgress")
      .withIndex("by_visitor_series", (q) =>
        q.eq("visitorId", args.visitorId).eq("seriesId", args.seriesId)
      )
      .first();
  },
});

/**
 * Patches series progress fields for deterministic runtime retry/backstop tests.
 */
export const updateSeriesProgressForTest = internalMutation({
  args: {
    progressId: v.id("seriesProgress"),
    status: v.optional(seriesProgressStatusValidator),
    waitUntil: v.optional(v.number()),
    waitEventName: v.optional(v.string()),
    attemptCount: v.optional(v.number()),
    lastExecutionError: v.optional(v.string()),
    clearWaitUntil: v.optional(v.boolean()),
    clearWaitEventName: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db.get(args.progressId);
    if (!progress) {
      throw new Error("Progress not found");
    }

    await ctx.db.patch(args.progressId, {
      ...(args.status !== undefined ? { status: args.status } : {}),
      ...(args.waitUntil !== undefined ? { waitUntil: args.waitUntil } : {}),
      ...(args.waitEventName !== undefined ? { waitEventName: args.waitEventName } : {}),
      ...(args.attemptCount !== undefined ? { attemptCount: args.attemptCount } : {}),
      ...(args.lastExecutionError !== undefined
        ? { lastExecutionError: args.lastExecutionError }
        : {}),
      ...(args.clearWaitUntil ? { waitUntil: undefined } : {}),
      ...(args.clearWaitEventName ? { waitEventName: undefined } : {}),
    });

    return await ctx.db.get(args.progressId);
  },
});

/**
 * Creates a test audit log entry directly (bypasses auth) for deterministic audit E2E flows.
 */
export const createTestAuditLog = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    action: v.string(),
    actorType: v.optional(v.union(v.literal("user"), v.literal("system"), v.literal("api"))),
    actorId: v.optional(v.id("users")),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.timestamp ?? Date.now();
    const logId = await ctx.db.insert("auditLogs", {
      workspaceId: args.workspaceId,
      actorId: args.actorId,
      actorType: args.actorType ?? "system",
      action: args.action,
      resourceType: args.resourceType ?? "test",
      resourceId: args.resourceId,
      metadata: args.metadata,
      timestamp: now,
    });

    return { logId, timestamp: now };
  },
});

/**
 * Creates a test user in the specified workspace.
 */
export const createTestUser = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    role: v.optional(v.union(v.literal("admin"), v.literal("agent"))),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const email = args.email || `test-${randomSuffix}@test.opencom.dev`;
    const name = args.name || `Test User ${randomSuffix}`;
    const role = args.role || "agent";

    const userId = await ctx.db.insert("users", {
      email,
      name,
      workspaceId: args.workspaceId,
      role,
      createdAt: timestamp,
    });

    await ctx.db.insert("workspaceMembers", {
      userId,
      workspaceId: args.workspaceId,
      role,
      createdAt: timestamp,
    });

    return { userId, email, name };
  },
});

/**
 * Creates a test session token for a visitor (used by tests that call visitor-facing endpoints).
 */
export const createTestSessionToken = internalMutation({
  args: {
    visitorId: v.id("visitors"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const randomHex = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0")
    ).join("");
    const token = `wst_test_${randomHex}`;

    await ctx.db.insert("widgetSessions", {
      token,
      visitorId: args.visitorId,
      workspaceId: args.workspaceId,
      identityVerified: false,
      expiresAt: now + 24 * 60 * 60 * 1000, // 24 hours
      createdAt: now,
    });

    return { sessionToken: token };
  },
});

/**
 * Creates a test visitor in the specified workspace.
 */
export const createTestVisitor = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    externalUserId: v.optional(v.string()),
    customAttributes: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const sessionId = `test-session-${timestamp}-${randomSuffix}`;

    const visitorId = await ctx.db.insert("visitors", {
      sessionId,
      workspaceId: args.workspaceId,
      email: args.email,
      name: args.name,
      externalUserId: args.externalUserId,
      customAttributes: args.customAttributes,
      createdAt: timestamp,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
    });

    await ctx.db.patch(visitorId, {
      readableId: formatReadableVisitorId(visitorId),
    });

    return { visitorId, sessionId };
  },
});

/**
 * Creates a test conversation in the specified workspace.
 */
export const createTestConversation = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    userId: v.optional(v.id("users")),
    assignedAgentId: v.optional(v.id("users")),
    status: v.optional(v.union(v.literal("open"), v.literal("closed"), v.literal("snoozed"))),
    firstResponseAt: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();

    const conversationId = await ctx.db.insert("conversations", {
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      userId: args.userId,
      assignedAgentId: args.assignedAgentId,
      status: args.status || "open",
      createdAt: timestamp,
      updatedAt: timestamp,
      unreadByAgent: 0,
      unreadByVisitor: 0,
      firstResponseAt: args.firstResponseAt,
      resolvedAt: args.resolvedAt,
      aiWorkflowState: "none",
    });

    return { conversationId };
  },
});

/**
 * Creates a test survey directly (bypasses auth on surveys.create).
 */
export const createTestSurvey = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("draft"), v.literal("active"), v.literal("paused"), v.literal("archived"))
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const surveyId = await ctx.db.insert("surveys", {
      workspaceId: args.workspaceId,
      name: args.name ?? `Test Survey ${randomSuffix}`,
      format: "small",
      status: args.status ?? "active",
      questions: [
        {
          id: "q1",
          type: "nps" as const,
          title: "How likely are you to recommend us?",
          required: true,
        },
      ],
      frequency: "once",
      showProgressBar: true,
      showDismissButton: true,
      triggers: { type: "immediate" as const },
      createdAt: now,
      updatedAt: now,
    });

    return { surveyId };
  },
});

/**
 * Forces a tooltip authoring session to expire for deterministic test scenarios.
 */
export const expireTooltipAuthoringSession = internalMutation({
  args: {
    token: v.string(),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("tooltipAuthoringSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session) {
      throw new Error("Session not found");
    }
    if (session.workspaceId !== args.workspaceId) {
      throw new Error("Session workspace mismatch");
    }

    await ctx.db.patch(session._id, {
      expiresAt: Date.now() - 1000,
      status: "active",
    });

    return { sessionId: session._id };
  },
});

/**
 * Completes a tooltip authoring session for deterministic E2E flows.
 */
export const completeTooltipAuthoringSession = internalMutation({
  args: {
    token: v.string(),
    workspaceId: v.id("workspaces"),
    elementSelector: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("tooltipAuthoringSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session) {
      throw new Error("Session not found");
    }
    if (session.workspaceId !== args.workspaceId) {
      throw new Error("Session workspace mismatch");
    }

    const quality = {
      score: 90,
      grade: "good" as const,
      warnings: [] as string[],
      signals: {
        matchCount: 1,
        depth: 1,
        usesNth: false,
        hasId: args.elementSelector.includes("#"),
        hasDataAttribute: args.elementSelector.includes("[data-"),
        classCount: (args.elementSelector.match(/\.[A-Za-z0-9_-]+/g) ?? []).length,
        usesWildcard: args.elementSelector.includes("*"),
      },
    };

    await ctx.db.patch(session._id, {
      selectedSelector: args.elementSelector,
      selectedSelectorQuality: quality,
      status: "completed",
    });

    if (session.tooltipId) {
      await ctx.db.patch(session.tooltipId, {
        elementSelector: args.elementSelector,
        selectorQuality: quality,
        updatedAt: Date.now(),
      });
    }

    return { sessionId: session._id };
  },
});

/**
 * Creates a test series directly (bypasses auth on series.create).
 */
export const createTestSeries = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("draft"), v.literal("active"), v.literal("paused"), v.literal("archived"))
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 8);

    const seriesId = await ctx.db.insert("series", {
      workspaceId: args.workspaceId,
      name: args.name ?? `Test Series ${randomSuffix}`,
      status: args.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });

    // Add a minimal entry block so evaluateEntry can traverse the series.
    await ctx.db.insert("seriesBlocks", {
      seriesId,
      type: "wait",
      position: { x: 0, y: 0 },
      config: {
        waitType: "duration",
        waitDuration: 1,
        waitUnit: "minutes",
      },
      createdAt: now,
      updatedAt: now,
    });

    return { seriesId };
  },
});

/**
 * Creates a test push campaign directly (bypasses auth on pushCampaigns.create).
 */
export const createTestPushCampaign = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    targeting: v.optional(v.any()),
    audienceRules: v.optional(v.any()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("scheduled"),
        v.literal("sending"),
        v.literal("sent"),
        v.literal("paused")
      )
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 8);

    const campaignId = await ctx.db.insert("pushCampaigns", {
      workspaceId: args.workspaceId,
      name: args.name ?? `Test Push Campaign ${randomSuffix}`,
      title: args.title ?? "Test push title",
      body: args.body ?? "Test push body",
      targeting: args.targeting,
      audienceRules: args.audienceRules,
      status: args.status ?? "draft",
      createdAt: now,
      updatedAt: now,
    });

    return { campaignId };
  },
});

export const sendTestPushCampaign: ReturnType<typeof internalMutation> = internalMutation({
  args: {
    campaignId: v.id("pushCampaigns"),
  },
  handler: async (ctx, args): Promise<unknown> => {
    return await ctx.runMutation((internal as any).pushCampaigns.sendForTesting, {
      id: args.campaignId,
    });
  },
});

export const getTestPendingPushCampaignRecipients: ReturnType<typeof internalMutation> =
  internalMutation({
    args: {
      campaignId: v.id("pushCampaigns"),
      limit: v.optional(v.number()),
    },
    handler: async (ctx, args): Promise<unknown> => {
      return await ctx.runQuery((internal as any).pushCampaigns.getPendingRecipients, {
        campaignId: args.campaignId,
        limit: args.limit,
      });
    },
  });

/**
 * Creates a test message in the specified conversation.
 */
export const createTestMessage = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    senderType: v.union(
      v.literal("user"),
      v.literal("visitor"),
      v.literal("agent"),
      v.literal("bot")
    ),
    senderId: v.optional(v.string()),
    emailMessageId: v.optional(v.string()),
    externalEmailId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const senderId = args.senderId || `test-sender-${timestamp}`;

    const emailId = args.emailMessageId || args.externalEmailId;
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId,
      senderType: args.senderType,
      content: args.content,
      createdAt: timestamp,
      ...(emailId && {
        channel: "email" as const,
        emailMetadata: { messageId: emailId },
        deliveryStatus: "pending" as const,
      }),
    });

    await ctx.db.patch(args.conversationId, {
      lastMessageAt: timestamp,
      updatedAt: timestamp,
    });

    return { messageId };
  },
});

export const createTestPushToken = internalMutation({
  args: {
    userId: v.id("users"),
    token: v.optional(v.string()),
    platform: v.optional(v.union(v.literal("ios"), v.literal("android"))),
    notificationsEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const token =
      args.token ??
      `ExponentPushToken[test-${args.userId}-${Math.random().toString(36).slice(2, 10)}]`;
    const tokenId = await ctx.db.insert("pushTokens", {
      userId: args.userId,
      token,
      platform: args.platform ?? "ios",
      notificationsEnabled: args.notificationsEnabled ?? true,
      createdAt: now,
    });
    return { tokenId, token };
  },
});

export const createTestVisitorPushToken = internalMutation({
  args: {
    visitorId: v.id("visitors"),
    token: v.optional(v.string()),
    platform: v.optional(v.union(v.literal("ios"), v.literal("android"))),
    notificationsEnabled: v.optional(v.boolean()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) {
      throw new Error("Visitor not found");
    }

    const now = Date.now();
    const token =
      args.token ??
      `ExponentPushToken[visitor-${args.visitorId}-${Math.random().toString(36).slice(2, 10)}]`;
    const tokenId = await ctx.db.insert("visitorPushTokens", {
      visitorId: args.visitorId,
      workspaceId: args.workspaceId ?? visitor.workspaceId,
      token,
      platform: args.platform ?? "ios",
      notificationsEnabled: args.notificationsEnabled ?? true,
      createdAt: now,
      updatedAt: now,
    });
    return { tokenId, token };
  },
});

export const upsertTestNotificationPreference = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    muted: v.optional(v.boolean()),
    newVisitorMessageEmail: v.optional(v.boolean()),
    newVisitorMessagePush: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", args.userId).eq("workspaceId", args.workspaceId)
      )
      .first();

    const now = Date.now();
    const nextNewVisitorMessage = {
      ...(existing?.events?.newVisitorMessage ?? {}),
      ...(args.newVisitorMessageEmail !== undefined ? { email: args.newVisitorMessageEmail } : {}),
      ...(args.newVisitorMessagePush !== undefined ? { push: args.newVisitorMessagePush } : {}),
    };

    const hasEventOverrides =
      nextNewVisitorMessage.email !== undefined || nextNewVisitorMessage.push !== undefined;

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.muted !== undefined ? { muted: args.muted } : {}),
        ...(hasEventOverrides
          ? {
              events: {
                ...(existing.events ?? {}),
                newVisitorMessage: nextNewVisitorMessage,
              },
            }
          : {}),
        updatedAt: now,
      });
      return { preferenceId: existing._id };
    }

    const preferenceId = await ctx.db.insert("notificationPreferences", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      muted: args.muted ?? false,
      ...(hasEventOverrides
        ? {
            events: {
              newVisitorMessage: nextNewVisitorMessage,
            },
          }
        : {}),
      createdAt: now,
      updatedAt: now,
    });
    return { preferenceId };
  },
});

export const upsertTestWorkspaceNotificationDefaults = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    newVisitorMessageEmail: v.optional(v.boolean()),
    newVisitorMessagePush: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("workspaceNotificationDefaults")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const now = Date.now();
    const nextNewVisitorMessage = {
      ...(existing?.events?.newVisitorMessage ?? {}),
      ...(args.newVisitorMessageEmail !== undefined ? { email: args.newVisitorMessageEmail } : {}),
      ...(args.newVisitorMessagePush !== undefined ? { push: args.newVisitorMessagePush } : {}),
    };

    const hasEventDefaults =
      nextNewVisitorMessage.email !== undefined || nextNewVisitorMessage.push !== undefined;

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(hasEventDefaults
          ? {
              events: {
                ...(existing.events ?? {}),
                newVisitorMessage: nextNewVisitorMessage,
              },
            }
          : {}),
        updatedAt: now,
      });
      return { defaultsId: existing._id };
    }

    const defaultsId = await ctx.db.insert("workspaceNotificationDefaults", {
      workspaceId: args.workspaceId,
      ...(hasEventDefaults
        ? {
            events: {
              newVisitorMessage: nextNewVisitorMessage,
            },
          }
        : {}),
      createdAt: now,
      updatedAt: now,
    });
    return { defaultsId };
  },
});

export const getTestMemberRecipientsForNewVisitorMessage: ReturnType<typeof internalMutation> =
  internalMutation({
    args: {
      workspaceId: v.id("workspaces"),
    },
    handler: async (ctx, args): Promise<unknown> => {
      return await ctx.runQuery(
        (internal as any).notifications.getMemberRecipientsForNewVisitorMessage,
        {
          workspaceId: args.workspaceId,
        }
      );
    },
  });

export const getTestVisitorRecipientsForSupportReply: ReturnType<typeof internalMutation> =
  internalMutation({
    args: {
      conversationId: v.id("conversations"),
      channel: v.optional(v.union(v.literal("chat"), v.literal("email"))),
    },
    handler: async (ctx, args): Promise<unknown> => {
      return await ctx.runQuery(
        (internal as any).notifications.getVisitorRecipientsForSupportReply,
        {
          conversationId: args.conversationId,
          channel: args.channel,
        }
      );
    },
  });

/**
 * Creates a test invitation in the specified workspace.
 * This bypasses the email sending action for testing purposes.
 */
export const createTestInvitation = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("agent")),
    invitedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const normalizedEmail = args.email.toLowerCase();

    const invitationId = await ctx.db.insert("workspaceInvitations", {
      workspaceId: args.workspaceId,
      email: normalizedEmail,
      role: args.role,
      invitedBy: args.invitedBy,
      status: "pending",
      createdAt: timestamp,
    });

    return { invitationId };
  },
});

/**
 * Updates workspace settings for testing (e.g. identity verification).
 */
export const updateWorkspaceSettings = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    identityVerificationEnabled: v.optional(v.boolean()),
    identityVerificationMode: v.optional(v.union(v.literal("optional"), v.literal("required"))),
    identitySecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {};
    if (args.identityVerificationEnabled !== undefined) {
      updates.identityVerificationEnabled = args.identityVerificationEnabled;
    }
    if (args.identityVerificationMode !== undefined) {
      updates.identityVerificationMode = args.identityVerificationMode;
    }
    if (args.identitySecret !== undefined) {
      updates.identitySecret = args.identitySecret;
    }
    await ctx.db.patch(args.workspaceId, updates);
  },
});

/**
 * Upserts automation settings for deterministic tests.
 */
export const upsertTestAutomationSettings = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    suggestArticlesEnabled: v.optional(v.boolean()),
    showReplyTimeEnabled: v.optional(v.boolean()),
    collectEmailEnabled: v.optional(v.boolean()),
    askForRatingEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("automationSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.suggestArticlesEnabled !== undefined && {
          suggestArticlesEnabled: args.suggestArticlesEnabled,
        }),
        ...(args.showReplyTimeEnabled !== undefined && {
          showReplyTimeEnabled: args.showReplyTimeEnabled,
        }),
        ...(args.collectEmailEnabled !== undefined && {
          collectEmailEnabled: args.collectEmailEnabled,
        }),
        ...(args.askForRatingEnabled !== undefined && {
          askForRatingEnabled: args.askForRatingEnabled,
        }),
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("automationSettings", {
      workspaceId: args.workspaceId,
      suggestArticlesEnabled: args.suggestArticlesEnabled ?? false,
      showReplyTimeEnabled: args.showReplyTimeEnabled ?? false,
      collectEmailEnabled: args.collectEmailEnabled ?? true,
      askForRatingEnabled: args.askForRatingEnabled ?? false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Cleans up all test data for a workspace.
 * Call this after each test suite to remove test data.
 */
export const cleanupTestData = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const { workspaceId } = args;

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    for (const conversation of conversations) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
        .collect();
      for (const message of messages) {
        await ctx.db.delete(message._id);
      }
      await ctx.db.delete(conversation._id);
    }

    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    const visitorPushTokens = await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const token of visitorPushTokens) {
      await ctx.db.delete(token._id);
    }

    for (const visitor of visitors) {
      await ctx.db.delete(visitor._id);
    }

    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    const users = await ctx.db
      .query("users")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const user of users) {
      const pushTokens = await ctx.db
        .query("pushTokens")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const token of pushTokens) {
        await ctx.db.delete(token._id);
      }

      const notifPrefs = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const pref of notifPrefs) {
        await ctx.db.delete(pref._id);
      }

      await ctx.db.delete(user._id);
    }

    const invitations = await ctx.db
      .query("workspaceInvitations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const invitation of invitations) {
      await ctx.db.delete(invitation._id);
    }

    const workspaceNotificationDefaults = await ctx.db
      .query("workspaceNotificationDefaults")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const defaults of workspaceNotificationDefaults) {
      await ctx.db.delete(defaults._id);
    }

    // Clean up content folders
    const contentFolders = await ctx.db
      .query("contentFolders")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const folder of contentFolders) {
      await ctx.db.delete(folder._id);
    }

    // Clean up internal articles
    const internalArticles = await ctx.db
      .query("internalArticles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const article of internalArticles) {
      await ctx.db.delete(article._id);
    }

    // Clean up recent content access for users in this workspace
    for (const user of users) {
      const recentAccess = await ctx.db
        .query("recentContentAccess")
        .withIndex("by_user_workspace", (q) =>
          q.eq("userId", user._id).eq("workspaceId", workspaceId)
        )
        .collect();
      for (const access of recentAccess) {
        await ctx.db.delete(access._id);
      }
    }

    // Clean up articles
    const articles = await ctx.db
      .query("articles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const article of articles) {
      await ctx.db.delete(article._id);
    }

    // Clean up snippets
    const snippets = await ctx.db
      .query("snippets")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const snippet of snippets) {
      await ctx.db.delete(snippet._id);
    }

    // Clean up content embeddings
    const contentEmbeddings = await ctx.db
      .query("contentEmbeddings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const embedding of contentEmbeddings) {
      await ctx.db.delete(embedding._id);
    }

    // Clean up suggestion feedback
    const suggestionFeedback = await ctx.db
      .query("suggestionFeedback")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const feedback of suggestionFeedback) {
      await ctx.db.delete(feedback._id);
    }

    // Clean up AI agent settings
    const aiSettings = await ctx.db
      .query("aiAgentSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const setting of aiSettings) {
      await ctx.db.delete(setting._id);
    }

    // Clean up automation settings
    const automationSettings = await ctx.db
      .query("automationSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const setting of automationSettings) {
      await ctx.db.delete(setting._id);
    }

    // Clean up CSAT responses
    const csatResponses = await ctx.db
      .query("csatResponses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const response of csatResponses) {
      await ctx.db.delete(response._id);
    }

    // Clean up report snapshots
    const reportSnapshots = await ctx.db
      .query("reportSnapshots")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const snapshot of reportSnapshots) {
      await ctx.db.delete(snapshot._id);
    }

    // Clean up email configs
    const emailConfigs = await ctx.db
      .query("emailConfigs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const config of emailConfigs) {
      await ctx.db.delete(config._id);
    }

    // Clean up email threads
    for (const conversation of conversations) {
      const threads = await ctx.db
        .query("emailThreads")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
        .collect();
      for (const thread of threads) {
        await ctx.db.delete(thread._id);
      }
    }

    // Clean up tickets and ticket comments
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const ticket of tickets) {
      const comments = await ctx.db
        .query("ticketComments")
        .withIndex("by_ticket", (q) => q.eq("ticketId", ticket._id))
        .collect();
      for (const comment of comments) {
        await ctx.db.delete(comment._id);
      }
      await ctx.db.delete(ticket._id);
    }

    // Clean up ticket forms
    const ticketForms = await ctx.db
      .query("ticketForms")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const form of ticketForms) {
      await ctx.db.delete(form._id);
    }

    await ctx.db.delete(workspaceId);

    return { success: true };
  },
});

/**
 * Cleans up all E2E test data from the database.
 * This removes all users with emails matching *@test.opencom.dev pattern
 * and their associated workspaces, conversations, etc.
 *
 * Can be run manually or at the start/end of E2E test runs.
 */
export const cleanupE2ETestData = internalMutation({
  args: {},
  handler: async (ctx) => {
    let deletedUsers = 0;
    let deletedWorkspaces = 0;
    let deletedConversations = 0;
    let deletedMessages = 0;
    let deletedVisitors = 0;
    let deletedMembers = 0;
    let deletedInvitations = 0;

    // Find all test users (emails ending with @test.opencom.dev)
    const allUsers = await ctx.db.query("users").collect();
    const testUsers = allUsers.filter(
      (user) => user.email && user.email.endsWith("@test.opencom.dev")
    );

    // Collect unique workspace IDs from test users
    const testWorkspaceIds = new Set<Id<"workspaces">>();
    for (const user of testUsers) {
      if (user.workspaceId) {
        testWorkspaceIds.add(user.workspaceId);
      }
    }

    // Clean up each test workspace
    for (const workspaceId of testWorkspaceIds) {
      // Delete conversations and messages
      const conversations = await ctx.db
        .query("conversations")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .collect();

      for (const conversation of conversations) {
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
          .collect();
        for (const message of messages) {
          await ctx.db.delete(message._id);
          deletedMessages++;
        }
        await ctx.db.delete(conversation._id);
        deletedConversations++;
      }

      // Delete visitors
      const visitors = await ctx.db
        .query("visitors")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .collect();

      const visitorPushTokens = await ctx.db
        .query("visitorPushTokens")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .collect();
      for (const token of visitorPushTokens) {
        await ctx.db.delete(token._id);
      }

      for (const visitor of visitors) {
        await ctx.db.delete(visitor._id);
        deletedVisitors++;
      }

      // Delete workspace members
      const members = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .collect();
      for (const member of members) {
        await ctx.db.delete(member._id);
        deletedMembers++;
      }

      // Delete invitations
      const invitations = await ctx.db
        .query("workspaceInvitations")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .collect();
      for (const invitation of invitations) {
        await ctx.db.delete(invitation._id);
        deletedInvitations++;
      }

      const workspaceNotificationDefaults = await ctx.db
        .query("workspaceNotificationDefaults")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .collect();
      for (const defaults of workspaceNotificationDefaults) {
        await ctx.db.delete(defaults._id);
      }

      // Delete the workspace
      try {
        await ctx.db.delete(workspaceId);
        deletedWorkspaces++;
      } catch (e) {
        // Workspace might already be deleted
      }
    }

    // Delete test users and their data
    for (const user of testUsers) {
      // Delete push tokens
      const pushTokens = await ctx.db
        .query("pushTokens")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const token of pushTokens) {
        await ctx.db.delete(token._id);
      }

      // Delete notification preferences
      const notifPrefs = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const pref of notifPrefs) {
        await ctx.db.delete(pref._id);
      }

      await ctx.db.delete(user._id);
      deletedUsers++;
    }

    return {
      success: true,
      deleted: {
        users: deletedUsers,
        workspaces: deletedWorkspaces,
        conversations: deletedConversations,
        messages: deletedMessages,
        visitors: deletedVisitors,
        members: deletedMembers,
        invitations: deletedInvitations,
      },
    };
  },
});

/**
 * Creates a test email config for a workspace.
 */
export const createTestEmailConfig = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    enabled: v.optional(v.boolean()),
    fromName: v.optional(v.string()),
    fromEmail: v.optional(v.string()),
    signature: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const forwardingAddress = `test-inbox-${randomSuffix}@mail.opencom.app`;

    const emailConfigId = await ctx.db.insert("emailConfigs", {
      workspaceId: args.workspaceId,
      forwardingAddress,
      fromName: args.fromName,
      fromEmail: args.fromEmail,
      signature: args.signature,
      enabled: args.enabled ?? true,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return { emailConfigId, forwardingAddress };
  },
});

/**
 * Creates a test email conversation with email-specific fields.
 */
export const createTestEmailConversation = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    subject: v.string(),
    status: v.optional(v.union(v.literal("open"), v.literal("closed"), v.literal("snoozed"))),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();

    const conversationId = await ctx.db.insert("conversations", {
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      status: args.status || "open",
      channel: "email",
      subject: args.subject,
      createdAt: timestamp,
      updatedAt: timestamp,
      unreadByAgent: 0,
      unreadByVisitor: 0,
    });

    return { conversationId };
  },
});

/**
 * Creates a test email message with email metadata.
 */
export const createTestEmailMessage = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    senderType: v.union(v.literal("visitor"), v.literal("agent")),
    senderId: v.optional(v.string()),
    subject: v.string(),
    from: v.string(),
    to: v.array(v.string()),
    messageId: v.string(),
    inReplyTo: v.optional(v.string()),
    references: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const senderId = args.senderId || `test-sender-${timestamp}`;

    const dbMessageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId,
      senderType: args.senderType,
      content: args.content,
      channel: "email",
      emailMetadata: {
        subject: args.subject,
        from: args.from,
        to: args.to,
        messageId: args.messageId,
        inReplyTo: args.inReplyTo,
        references: args.references,
      },
      createdAt: timestamp,
    });

    await ctx.db.patch(args.conversationId, {
      lastMessageAt: timestamp,
      updatedAt: timestamp,
    });

    return { messageId: dbMessageId };
  },
});

/**
 * Creates a test email thread record for thread matching tests.
 */
export const createTestEmailThread = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    messageId: v.string(),
    subject: v.string(),
    senderEmail: v.string(),
    inReplyTo: v.optional(v.string()),
    references: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const normalizedSubject = args.subject
      .replace(/^(re|fwd|fw):\s*/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    const threadId = await ctx.db.insert("emailThreads", {
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      messageId: args.messageId,
      inReplyTo: args.inReplyTo,
      references: args.references,
      subject: args.subject,
      normalizedSubject,
      senderEmail: args.senderEmail.toLowerCase(),
      createdAt: timestamp,
    });

    return { threadId };
  },
});

/**
 * Creates a test ticket in the specified workspace.
 */
export const createTestTicket = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    conversationId: v.optional(v.id("conversations")),
    subject: v.string(),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("submitted"),
        v.literal("in_progress"),
        v.literal("waiting_on_customer"),
        v.literal("resolved")
      )
    ),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent"))
    ),
    assigneeId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();

    const ticketId = await ctx.db.insert("tickets", {
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      conversationId: args.conversationId,
      subject: args.subject,
      description: args.description,
      status: args.status || "submitted",
      priority: args.priority || "normal",
      assigneeId: args.assigneeId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return { ticketId };
  },
});

/**
 * Creates a test ticket form in the specified workspace.
 */
export const createTestTicketForm = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();

    const ticketFormId = await ctx.db.insert("ticketForms", {
      workspaceId: args.workspaceId,
      name: args.name,
      description: args.description,
      fields: [
        {
          id: "subject",
          type: "text",
          label: "Subject",
          required: true,
        },
        {
          id: "description",
          type: "textarea",
          label: "Description",
          required: false,
        },
      ],
      isDefault: args.isDefault || false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return { ticketFormId };
  },
});

// ============================================================================
// Auth-bypassing operation helpers for tests
// These mirror auth-protected API functions but skip auth checks.
// Only available via api.testing.helpers.* for test environments.
// ============================================================================

/**
 * Creates a collection directly (bypasses auth on collections.create).
 */
export const createTestCollection = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    parentId: v.optional(v.id("collections")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const baseSlug = args.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const randomSuffix = Math.random().toString(36).substring(2, 8);

    return await ctx.db.insert("collections", {
      workspaceId: args.workspaceId,
      name: args.name,
      slug: `${baseSlug}-${randomSuffix}`,
      description: args.description,
      icon: args.icon,
      parentId: args.parentId,
      order: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Creates an article directly (bypasses auth on articles.create).
 */
export const createTestArticle = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    content: v.string(),
    collectionId: v.optional(v.id("collections")),
    status: v.optional(v.union(v.literal("draft"), v.literal("published"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const slug = args.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const randomSuffix = Math.random().toString(36).substring(2, 8);

    const articleId = await ctx.db.insert("articles", {
      workspaceId: args.workspaceId,
      collectionId: args.collectionId,
      title: args.title,
      slug: `${slug}-${randomSuffix}`,
      content: args.content,
      status: args.status || "draft",
      order: 0,
      createdAt: now,
      updatedAt: now,
      ...(args.status === "published" ? { publishedAt: now } : {}),
    });

    return articleId;
  },
});

/**
 * Publishes an article directly (bypasses auth on articles.publish).
 */
export const publishTestArticle = internalMutation({
  args: { id: v.id("articles") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "published",
      publishedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Updates an article directly (bypasses auth on articles.update).
 */
export const updateTestArticle = internalMutation({
  args: {
    id: v.id("articles"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    audienceRules: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
  },
});

/**
 * Removes an article directly (bypasses auth on articles.remove).
 */
export const removeTestArticle = internalMutation({
  args: { id: v.id("articles") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

/**
 * Creates an internal article directly (bypasses auth).
 */
export const createTestInternalArticle = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    content: v.string(),
    tags: v.optional(v.array(v.string())),
    folderId: v.optional(v.id("contentFolders")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const articleId = await ctx.db.insert("internalArticles", {
      workspaceId: args.workspaceId,
      title: args.title,
      content: args.content,
      tags: args.tags || [],
      folderId: args.folderId,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    return articleId;
  },
});

/**
 * Publishes an internal article directly (bypasses auth).
 */
export const publishTestInternalArticle = internalMutation({
  args: { id: v.id("internalArticles") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "published",
      publishedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Creates a snippet directly (bypasses auth).
 */
export const createTestSnippet = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    content: v.string(),
    shortcut: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const snippetId = await ctx.db.insert("snippets", {
      workspaceId: args.workspaceId,
      name: args.name,
      content: args.content,
      shortcut: args.shortcut,
      createdAt: now,
      updatedAt: now,
    });
    return snippetId;
  },
});

/**
 * Creates a content folder directly (bypasses auth).
 */
export const createTestContentFolder = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    parentId: v.optional(v.id("contentFolders")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const folderId = await ctx.db.insert("contentFolders", {
      workspaceId: args.workspaceId,
      name: args.name,
      parentId: args.parentId,
      order: 0,
      createdAt: now,
      updatedAt: now,
    });
    return folderId;
  },
});

/**
 * Creates a tour directly (bypasses auth on tours.create).
 */
export const createTestTour = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("draft"), v.literal("active"), v.literal("archived"))),
    targetingRules: v.optional(v.any()),
    audienceRules: v.optional(v.any()),
    displayMode: v.optional(v.union(v.literal("first_time_only"), v.literal("until_dismissed"))),
    priority: v.optional(v.number()),
    buttonColor: v.optional(v.string()),
    senderId: v.optional(v.id("users")),
    showConfetti: v.optional(v.boolean()),
    allowSnooze: v.optional(v.boolean()),
    allowRestart: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const tourId = await ctx.db.insert("tours", {
      workspaceId: args.workspaceId,
      name: args.name,
      description: args.description,
      status: args.status || "draft",
      targetingRules: args.targetingRules,
      audienceRules: args.audienceRules,
      displayMode: args.displayMode ?? "first_time_only",
      priority: args.priority ?? 0,
      buttonColor: args.buttonColor,
      senderId: args.senderId,
      showConfetti: args.showConfetti ?? true,
      allowSnooze: args.allowSnooze ?? true,
      allowRestart: args.allowRestart ?? true,
      createdAt: now,
      updatedAt: now,
    });
    return tourId;
  },
});

/**
 * Updates a tour directly (bypasses auth on tours.update).
 */
export const updateTestTour = internalMutation({
  args: {
    id: v.id("tours"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    targetingRules: v.optional(v.any()),
    audienceRules: v.optional(v.any()),
    displayMode: v.optional(v.union(v.literal("first_time_only"), v.literal("until_dismissed"))),
    priority: v.optional(v.number()),
    buttonColor: v.optional(v.string()),
    showConfetti: v.optional(v.boolean()),
    allowSnooze: v.optional(v.boolean()),
    allowRestart: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
  },
});

/**
 * Removes a tour and its steps directly (bypasses auth on tours.remove).
 */
export const removeTestTour = internalMutation({
  args: { id: v.id("tours") },
  handler: async (ctx, args) => {
    const steps = await ctx.db
      .query("tourSteps")
      .withIndex("by_tour", (q) => q.eq("tourId", args.id))
      .collect();
    for (const step of steps) {
      await ctx.db.delete(step._id);
    }
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

/**
 * Activates a tour directly (bypasses auth).
 */
export const activateTestTour = internalMutation({
  args: { id: v.id("tours") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "active", updatedAt: Date.now() });
  },
});

/**
 * Deactivates a tour directly (bypasses auth).
 */
export const deactivateTestTour = internalMutation({
  args: { id: v.id("tours") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "draft", updatedAt: Date.now() });
  },
});

/**
 * Gets a tour by ID directly (bypasses auth).
 */
export const getTestTour = internalMutation({
  args: { id: v.id("tours") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Lists tours for a workspace directly (bypasses auth).
 */
export const listTestTours = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tours")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

/**
 * Duplicates a tour directly (bypasses auth).
 */
export const duplicateTestTour = internalMutation({
  args: {
    id: v.id("tours"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tour = await ctx.db.get(args.id);
    if (!tour) throw new Error("Tour not found");
    const now = Date.now();
    const { _id: _tourId, _creationTime: _tourCt, ...tourData } = tour;
    const newTourId = await ctx.db.insert("tours", {
      ...tourData,
      name: args.name || `${tour.name} (Copy)`,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    const steps = await ctx.db
      .query("tourSteps")
      .withIndex("by_tour", (q) => q.eq("tourId", args.id))
      .collect();
    for (const step of steps) {
      const { _id: _stepId, _creationTime: _stepCt, ...stepData } = step;
      await ctx.db.insert("tourSteps", {
        ...stepData,
        workspaceId: tour.workspaceId,
        tourId: newTourId,
        createdAt: now,
        updatedAt: now,
      });
    }
    return newTourId;
  },
});

/**
 * Gets a conversation by ID directly (bypasses auth).
 */
export const getTestConversation = internalMutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Lists conversations for a workspace directly (bypasses auth).
 */
export const listTestConversations = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(v.union(v.literal("open"), v.literal("closed"), v.literal("snoozed"))),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("conversations")
        .withIndex("by_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", args.status!)
        )
        .order("desc")
        .collect();
    }
    return await ctx.db
      .query("conversations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
  },
});

/**
 * Updates conversation status directly (bypasses auth on conversations.updateStatus).
 */
export const updateTestConversationStatus = internalMutation({
  args: {
    id: v.id("conversations"),
    status: v.union(v.literal("open"), v.literal("closed"), v.literal("snoozed")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };
    if (args.status === "closed") {
      patch.resolvedAt = now;
    } else if (args.status === "open") {
      patch.resolvedAt = undefined;
    }
    await ctx.db.patch(args.id, patch);
  },
});

/**
 * Assigns a conversation directly (bypasses auth on conversations.assign).
 */
export const assignTestConversation = internalMutation({
  args: {
    id: v.id("conversations"),
    agentId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      assignedAgentId: args.agentId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Marks a conversation as read directly (bypasses auth).
 */
export const markTestConversationAsRead = internalMutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      unreadByAgent: 0,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Lists messages for a conversation directly (bypasses auth).
 */
export const listTestMessages = internalMutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();
  },
});

/**
 * Sends a message directly (bypasses auth on messages.send, including bot restriction).
 */
export const sendTestMessageDirect = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    senderId: v.string(),
    senderType: v.union(
      v.literal("user"),
      v.literal("visitor"),
      v.literal("agent"),
      v.literal("bot")
    ),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: args.senderId,
      senderType: args.senderType,
      content: args.content,
      createdAt: now,
    });

    const conversation = await ctx.db.get(args.conversationId);
    const unreadUpdate: Record<string, number> = {};
    if (args.senderType === "visitor") {
      unreadUpdate.unreadByAgent = (conversation?.unreadByAgent || 0) + 1;
    } else if (args.senderType === "agent" || args.senderType === "user") {
      unreadUpdate.unreadByVisitor = (conversation?.unreadByVisitor || 0) + 1;
    }

    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
      lastMessageAt: now,
      ...unreadUpdate,
    });
    return messageId;
  },
});

/**
 * Seeds an AI response record and updates conversation workflow fields for deterministic tests.
 */
export const seedTestAIResponse = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    query: v.string(),
    response: v.string(),
    confidence: v.optional(v.number()),
    handedOff: v.optional(v.boolean()),
    handoffReason: v.optional(v.string()),
    feedback: v.optional(v.union(v.literal("helpful"), v.literal("not_helpful"))),
    sources: v.optional(
      v.array(
        v.object({
          type: v.string(),
          id: v.string(),
          title: v.string(),
        })
      )
    ),
    model: v.optional(v.string()),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const confidence = args.confidence ?? 0.75;
    const handedOff = args.handedOff ?? false;
    const handoffReason = handedOff
      ? (args.handoffReason ?? "AI requested human handoff")
      : undefined;

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: "ai-agent",
      senderType: "bot",
      content: args.response,
      createdAt: now,
    });

    const responseId = await ctx.db.insert("aiResponses", {
      conversationId: args.conversationId,
      messageId,
      query: args.query,
      response: args.response,
      sources: args.sources ?? [],
      confidence,
      feedback: args.feedback,
      handedOff,
      handoffReason,
      generationTimeMs: 120,
      tokensUsed: 96,
      model: args.model ?? "openai/gpt-5-nano",
      provider: args.provider ?? "openai",
      createdAt: now,
    });

    await ctx.db.patch(args.conversationId, {
      status: "open",
      updatedAt: now,
      lastMessageAt: now,
      aiWorkflowState: handedOff ? "handoff" : "ai_handled",
      aiHandoffReason: handoffReason,
      aiLastConfidence: confidence,
      aiLastResponseAt: now,
    });

    return { responseId, messageId };
  },
});

/**
 * Gets a workspace with full data directly (bypasses auth-limited fields).
 */
export const getTestWorkspaceFull = internalMutation({
  args: { id: v.id("workspaces") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Updates workspace allowed origins directly (bypasses auth).
 */
export const updateTestAllowedOrigins = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    allowedOrigins: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workspaceId, {
      allowedOrigins: args.allowedOrigins,
    });
  },
});

/**
 * Updates workspace signup settings directly (bypasses auth).
 */
export const updateTestSignupSettings = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    signupMode: v.optional(
      v.union(v.literal("invite-only"), v.literal("domain-allowlist"), v.literal("open"))
    ),
    allowedDomains: v.optional(v.array(v.string())),
    authMethods: v.optional(v.array(v.union(v.literal("password"), v.literal("otp")))),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {};
    if (args.signupMode !== undefined) updates.signupMode = args.signupMode;
    if (args.allowedDomains !== undefined) updates.allowedDomains = args.allowedDomains;
    if (args.authMethods !== undefined) updates.authMethods = args.authMethods;
    // Clear domains when switching to invite-only
    if (args.signupMode === "invite-only" && args.allowedDomains === undefined) {
      updates.allowedDomains = [];
    }
    await ctx.db.patch(args.workspaceId, updates);
  },
});

/**
 * Gets AI agent settings directly (bypasses auth).
 */
export const getTestAISettings = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("aiAgentSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!settings) {
      return {
        enabled: false,
        knowledgeSources: ["articles"],
        confidenceThreshold: 0.6,
        personality: null,
        handoffMessage: "Let me connect you with a human agent who can help you better.",
        workingHours: null,
        model: "openai/gpt-5-nano",
        suggestionsEnabled: false,
        embeddingModel: "text-embedding-3-small",
      };
    }

    return {
      ...settings,
      suggestionsEnabled: settings.suggestionsEnabled ?? false,
      embeddingModel: settings.embeddingModel ?? "text-embedding-3-small",
    };
  },
});

/**
 * Updates AI agent settings directly (bypasses auth).
 */
export const updateTestAISettings = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    enabled: v.optional(v.boolean()),
    model: v.optional(v.string()),
    confidenceThreshold: v.optional(v.number()),
    knowledgeSources: v.optional(v.array(v.string())),
    personality: v.optional(v.string()),
    handoffMessage: v.optional(v.string()),
    suggestionsEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("aiAgentSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const { workspaceId, ...updates } = args;

    if (existing) {
      const patchData: Record<string, unknown> = { updatedAt: now };
      if (updates.enabled !== undefined) patchData.enabled = updates.enabled;
      if (updates.model !== undefined) patchData.model = updates.model;
      if (updates.confidenceThreshold !== undefined)
        patchData.confidenceThreshold = updates.confidenceThreshold;
      if (updates.knowledgeSources !== undefined)
        patchData.knowledgeSources = updates.knowledgeSources;
      if (updates.personality !== undefined) patchData.personality = updates.personality;
      if (updates.handoffMessage !== undefined) patchData.handoffMessage = updates.handoffMessage;
      if (updates.suggestionsEnabled !== undefined)
        patchData.suggestionsEnabled = updates.suggestionsEnabled;
      await ctx.db.patch(existing._id, patchData as any);
      return existing._id;
    }

    return await ctx.db.insert("aiAgentSettings", {
      workspaceId,
      enabled: args.enabled ?? false,
      knowledgeSources: (args.knowledgeSources as any) ?? ["articles"],
      confidenceThreshold: args.confidenceThreshold ?? 0.6,
      personality: args.personality,
      handoffMessage:
        args.handoffMessage ?? "Let me connect you with a human agent who can help you better.",
      model: args.model ?? "openai/gpt-5-nano",
      suggestionsEnabled: args.suggestionsEnabled ?? false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Gets a visitor by ID directly (bypasses auth).
 */
export const getTestVisitor = internalMutation({
  args: { id: v.id("visitors") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Adds a workspace member directly (bypasses auth on workspaceMembers.add).
 */
export const addTestWorkspaceMember = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("agent"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const memberId = await ctx.db.insert("workspaceMembers", {
      workspaceId: args.workspaceId,
      userId: args.userId,
      role: args.role,
      createdAt: now,
    });
    return memberId;
  },
});

/**
 * Lists workspace members directly (bypasses auth).
 */
export const listTestWorkspaceMembers = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return await Promise.all(
      members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return { ...m, user };
      })
    );
  },
});

/**
 * Updates workspace-member custom permissions directly (bypasses auth).
 * Passing an empty array clears custom permissions and falls back to role defaults.
 */
export const updateTestMemberPermissions = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userEmail: v.string(),
    permissions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();
    if (!user) {
      throw new Error("User not found");
    }

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", args.workspaceId)
      )
      .first();
    if (!membership) {
      throw new Error("Workspace member not found");
    }

    const normalized =
      args.permissions && args.permissions.length > 0 ? args.permissions : undefined;
    await ctx.db.patch(membership._id, { permissions: normalized });

    return { membershipId: membership._id };
  },
});

/**
 * Updates a workspace member role directly (bypasses auth).
 * Includes last-admin validation to match production behavior.
 */
export const updateTestMemberRole = internalMutation({
  args: {
    membershipId: v.id("workspaceMembers"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("agent"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.membershipId);
    if (!member) throw new Error("Member not found");

    // If demoting from admin, check there's at least one other admin
    if (member.role === "admin" && args.role !== "admin") {
      const admins = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", member.workspaceId))
        .filter((q) => q.eq(q.field("role"), "admin"))
        .collect();
      if (admins.length <= 1) {
        throw new Error("Cannot demote: workspace must have at least one admin");
      }
    }

    await ctx.db.patch(args.membershipId, { role: args.role });
  },
});

/**
 * Removes a workspace member directly (bypasses auth).
 * Includes last-admin validation to match production behavior.
 */
export const removeTestMember = internalMutation({
  args: { membershipId: v.id("workspaceMembers") },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.membershipId);
    if (!member) throw new Error("Member not found");

    // If removing an admin, check there's at least one other admin
    if (member.role === "admin") {
      const admins = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", member.workspaceId))
        .filter((q) => q.eq(q.field("role"), "admin"))
        .collect();
      if (admins.length <= 1) {
        throw new Error("Cannot remove: workspace must have at least one admin");
      }
    }

    await ctx.db.delete(args.membershipId);
  },
});

/**
 * Removes a workspace member directly (bypasses auth). Alias without validation.
 */
export const removeTestWorkspaceMember = internalMutation({
  args: { membershipId: v.id("workspaceMembers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.membershipId);
  },
});

/**
 * Cancels a test invitation directly (bypasses auth).
 */
export const cancelTestInvitation = internalMutation({
  args: { invitationId: v.id("workspaceInvitations") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.invitationId);
  },
});

/**
 * Accepts a test invitation directly (bypasses auth).
 */
export const acceptTestInvitation = internalMutation({
  args: { invitationId: v.id("workspaceInvitations") },
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) throw new Error("Invitation not found");
    await ctx.db.patch(args.invitationId, { status: "accepted" });
  },
});

/**
 * Lists pending invitations for a workspace directly (bypasses auth).
 */
export const listTestPendingInvitations = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspaceInvitations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
  },
});

/**
 * Simulates an email webhook event for testing delivery status updates.
 */
export const simulateEmailWebhook = internalMutation({
  args: {
    eventType: v.string(),
    emailId: v.string(),
  },
  handler: async (ctx, args) => {
    // Map event type to delivery status (only schema-valid values)
    const statusMap: Record<string, "pending" | "sent" | "delivered" | "bounced" | "failed"> = {
      "email.sent": "sent",
      "email.delivered": "delivered",
      "email.opened": "delivered",
      "email.clicked": "delivered",
      "email.bounced": "bounced",
      "email.complained": "failed",
      "email.delivery_delayed": "pending",
    };

    const deliveryStatus = statusMap[args.eventType];
    if (!deliveryStatus) return;

    // Find message by emailMetadata.messageId
    const message = await ctx.db
      .query("messages")
      .withIndex("by_email_message_id", (q) => q.eq("emailMetadata.messageId", args.emailId))
      .first();

    if (message) {
      await ctx.db.patch(message._id, { deliveryStatus });
    }
  },
});

/**
 * Gets a message by ID directly (bypasses auth).
 */
export const getTestMessage = internalMutation({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Updates workspace allowed origins directly (bypasses auth).
 */
export const updateWorkspaceOrigins = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    allowedOrigins: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workspaceId, { allowedOrigins: args.allowedOrigins });
  },
});

/**
 * Creates a conversation for a visitor directly (bypasses auth, like createForVisitor).
 */
export const createTestConversationForVisitor = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.id("visitors"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("conversations", {
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      status: "open",
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      aiWorkflowState: "none",
    });

    await ctx.db.insert("messages", {
      conversationId: id,
      senderId: "system",
      senderType: "bot",
      content: "Hi! How can we help you today?",
      createdAt: now,
    });

    return await ctx.db.get(id);
  },
});

/**
 * Looks up a user by email using the by_email index.
 * Mirrors the typed query pattern used in authConvex createOrUpdateUser.
 */
export const lookupUserByEmail = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
  },
});

/**
 * Looks up pending workspace invitations by email using the by_email index.
 * Mirrors the typed query pattern used in authConvex createOrUpdateUser.
 */
export const lookupPendingInvitationsByEmail = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspaceInvitations")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
  },
});
