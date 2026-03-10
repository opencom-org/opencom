import { internalMutation } from "../../_generated/server";
import { v } from "convex/values";

const createTestSurvey = internalMutation({
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
const expireTooltipAuthoringSession = internalMutation({
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
const completeTooltipAuthoringSession = internalMutation({
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
const createTestCollection = internalMutation({
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
const createTestArticle = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    content: v.string(),
    collectionId: v.optional(v.id("collections")),
    widgetLargeScreen: v.optional(v.boolean()),
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
      widgetLargeScreen: args.widgetLargeScreen ?? false,
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
const publishTestArticle = internalMutation({
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
const updateTestArticle = internalMutation({
  args: {
    id: v.id("articles"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    audienceRules: v.optional(v.any()),
    widgetLargeScreen: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
  },
});

/**
 * Removes an article directly (bypasses auth on articles.remove).
 */
const removeTestArticle = internalMutation({
  args: { id: v.id("articles") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

/**
 * Creates an internal article directly (bypasses auth).
 */
const createTestInternalArticle = internalMutation({
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
const publishTestInternalArticle = internalMutation({
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
const createTestSnippet = internalMutation({
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
const createTestContentFolder = internalMutation({
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
const createTestTour = internalMutation({
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
const updateTestTour = internalMutation({
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
const removeTestTour = internalMutation({
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
const activateTestTour = internalMutation({
  args: { id: v.id("tours") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "active", updatedAt: Date.now() });
  },
});

/**
 * Deactivates a tour directly (bypasses auth).
 */
const deactivateTestTour = internalMutation({
  args: { id: v.id("tours") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "draft", updatedAt: Date.now() });
  },
});

/**
 * Gets a tour by ID directly (bypasses auth).
 */
const getTestTour = internalMutation({
  args: { id: v.id("tours") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Lists tours for a workspace directly (bypasses auth).
 */
const listTestTours = internalMutation({
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
const duplicateTestTour = internalMutation({
  args: {
    id: v.id("tours"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tour = await ctx.db.get(args.id);
    if (!tour) throw new Error("Tour not found");
    const now = Date.now();
    const { _id: _tourId, _creationTime: _tourCreationTime, ...tourData } = tour;
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
      const { _id: _stepId, _creationTime: _stepCreationTime, ...stepData } = step;
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

export const contentTestHelpers: Record<string, ReturnType<typeof internalMutation>> = {
  createTestSurvey,
  expireTooltipAuthoringSession,
  completeTooltipAuthoringSession,
  createTestCollection,
  createTestArticle,
  publishTestArticle,
  updateTestArticle,
  removeTestArticle,
  createTestInternalArticle,
  publishTestInternalArticle,
  createTestSnippet,
  createTestContentFolder,
  createTestTour,
  updateTestTour,
  removeTestTour,
  activateTestTour,
  deactivateTestTour,
  getTestTour,
  listTestTours,
  duplicateTestTour,
} as const;
