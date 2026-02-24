import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { evaluateRuleWithSegmentSupport, validateAudienceRule } from "./audienceRules";
import { authAction, authMutation, authQuery } from "./lib/authWrappers";
import { getAuthenticatedUserFromSession } from "./auth";
import { requirePermission } from "./permissions";
import { resolveVisitorFromSession } from "./widgetSessions";
import { audienceRulesOrSegmentValidator } from "./validators";

const screenValidator = v.object({
  id: v.string(),
  title: v.optional(v.string()),
  body: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  buttons: v.optional(
    v.array(
      v.object({
        text: v.string(),
        action: v.union(
          v.literal("url"),
          v.literal("dismiss"),
          v.literal("next"),
          v.literal("deeplink")
        ),
        url: v.optional(v.string()),
        deepLink: v.optional(v.string()),
      })
    )
  ),
});

type CarouselButton = {
  text: string;
  action: "url" | "dismiss" | "next" | "deeplink";
  url?: string;
  deepLink?: string;
};

type CarouselScreen = {
  id: string;
  title?: string;
  body?: string;
  imageUrl?: string;
  buttons?: CarouselButton[];
};

const STATUS_TRANSITIONS: Record<string, Set<string>> = {
  draft: new Set(["active", "archived"]),
  active: new Set(["paused", "archived"]),
  paused: new Set(["active", "archived"]),
  archived: new Set(),
};

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidDeepLink(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\/.+/i.test(value);
}

function normalizeCarouselScreens(rawScreens: unknown): CarouselScreen[] {
  if (!Array.isArray(rawScreens)) return [];

  return rawScreens
    .map((rawScreen, index) => {
      const screen =
        typeof rawScreen === "object" && rawScreen !== null
          ? (rawScreen as Record<string, unknown>)
          : {};

      const normalizedButtons = Array.isArray(screen.buttons)
        ? screen.buttons
            .map((rawButton) => {
              const button =
                typeof rawButton === "object" && rawButton !== null
                  ? (rawButton as Record<string, unknown>)
                  : {};
              const action = button.action;
              if (
                action !== "url" &&
                action !== "dismiss" &&
                action !== "next" &&
                action !== "deeplink"
              ) {
                return null;
              }
              const text = normalizeOptionalString(button.text);
              if (!text) return null;
              const normalizedButton: CarouselButton = {
                text,
                action,
              };
              const normalizedUrl = normalizeOptionalString(button.url);
              const normalizedDeepLink = normalizeOptionalString(button.deepLink);
              if (normalizedUrl) {
                normalizedButton.url = normalizedUrl;
              }
              if (normalizedDeepLink) {
                normalizedButton.deepLink = normalizedDeepLink;
              }
              return normalizedButton;
            })
            .filter((button): button is CarouselButton => button !== null)
        : [];

      const id = normalizeOptionalString(screen.id) ?? `screen-${index + 1}`;
      return {
        id,
        title: normalizeOptionalString(screen.title),
        body: normalizeOptionalString(screen.body),
        imageUrl: normalizeOptionalString(screen.imageUrl),
        buttons: normalizedButtons.length ? normalizedButtons : undefined,
      } satisfies CarouselScreen;
    })
    .filter((screen) => Boolean(screen.id));
}

function validateCarouselScreens(rawScreens: unknown): CarouselScreen[] {
  const screens = normalizeCarouselScreens(rawScreens);
  if (!screens.length) {
    throw new Error("Carousel requires at least one screen.");
  }

  screens.forEach((screen, screenIndex) => {
    if (!screen.title && !screen.body) {
      throw new Error(`Screen ${screenIndex + 1} must include a title or body.`);
    }

    (screen.buttons ?? []).forEach((button, buttonIndex) => {
      if (button.action === "url") {
        if (!button.url || !isValidHttpUrl(button.url)) {
          throw new Error(
            `Screen ${screenIndex + 1}, button ${buttonIndex + 1} requires a valid http(s) URL.`
          );
        }
      }

      if (button.action === "deeplink") {
        if (!button.deepLink || !isValidDeepLink(button.deepLink)) {
          throw new Error(
            `Screen ${screenIndex + 1}, button ${buttonIndex + 1} requires a valid deep link URL.`
          );
        }
      }
    });
  });

  return screens;
}

function assertValidStatusTransition(currentStatus: string, nextStatus: string): void {
  if (currentStatus === nextStatus) {
    throw new Error(`Carousel is already ${currentStatus}.`);
  }

  const allowedTransitions = STATUS_TRANSITIONS[currentStatus];
  if (!allowedTransitions?.has(nextStatus)) {
    throw new Error(`Cannot transition carousel from ${currentStatus} to ${nextStatus}.`);
  }
}

function assertCarouselDeliverable(carousel: Doc<"carousels">): void {
  if (carousel.status !== "active") {
    throw new Error("Carousel is not active.");
  }

  validateCarouselScreens(carousel.screens);
}

async function findExistingTerminalImpression(
  ctx: { db: any },
  visitorId: Id<"visitors">,
  carouselId: Id<"carousels">
): Promise<Doc<"carouselImpressions"> | null> {
  return await ctx.db
    .query("carouselImpressions")
    .withIndex("by_visitor_carousel", (q: any) =>
      q.eq("visitorId", visitorId).eq("carouselId", carouselId)
    )
    .filter((q: any) =>
      q.or(q.eq(q.field("action"), "completed"), q.eq(q.field("action"), "dismissed"))
    )
    .first();
}

// Task 4.1: Create carousel
export const create = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    screens: v.array(screenValidator),
    targeting: v.optional(audienceRulesOrSegmentValidator),
    priority: v.optional(v.number()),
  },
  permission: "settings.workspace",
  handler: async (ctx, args) => {
    const hasSegmentReference =
      typeof args.targeting === "object" &&
      args.targeting !== null &&
      "segmentId" in args.targeting;
    if (
      args.targeting !== undefined &&
      !hasSegmentReference &&
      !validateAudienceRule(args.targeting)
    ) {
      throw new Error("Invalid targeting rules");
    }

    const normalizedName = args.name.trim();
    if (!normalizedName) {
      throw new Error("Carousel name is required.");
    }

    const validatedScreens = validateCarouselScreens(args.screens);

    const now = Date.now();
    return await ctx.db.insert("carousels", {
      workspaceId: args.workspaceId,
      name: normalizedName,
      screens: validatedScreens,
      targeting: args.targeting,
      priority: args.priority,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Task 4.2: Update carousel
export const update = authMutation({
  args: {
    id: v.id("carousels"),
    name: v.optional(v.string()),
    screens: v.optional(v.array(screenValidator)),
    targeting: v.optional(audienceRulesOrSegmentValidator),
    priority: v.optional(v.number()),
  },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    return carousel?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = (await ctx.db.get(id)) as Doc<"carousels"> | null;
    if (!existing) throw new Error("Carousel not found");

    const hasSegmentReference =
      typeof args.targeting === "object" &&
      args.targeting !== null &&
      "segmentId" in args.targeting;
    if (
      args.targeting !== undefined &&
      !hasSegmentReference &&
      !validateAudienceRule(args.targeting)
    ) {
      throw new Error("Invalid targeting rules");
    }

    const normalizedUpdates: {
      name?: string;
      screens?: CarouselScreen[];
      targeting?: typeof args.targeting;
      priority?: number;
    } = {
      ...updates,
    };

    if (typeof args.name === "string") {
      const normalizedName = args.name.trim();
      if (!normalizedName) {
        throw new Error("Carousel name is required.");
      }
      normalizedUpdates.name = normalizedName;
    }

    if (args.screens !== undefined) {
      normalizedUpdates.screens = validateCarouselScreens(args.screens);
    } else {
      const normalizedExistingScreens = normalizeCarouselScreens(existing.screens);
      if (JSON.stringify(existing.screens) !== JSON.stringify(normalizedExistingScreens)) {
        normalizedUpdates.screens = validateCarouselScreens(normalizedExistingScreens);
      }
    }

    await ctx.db.patch(id, {
      ...normalizedUpdates,
      updatedAt: Date.now(),
    });
    return id;
  },
});

// Task 4.3: List carousels
export const list = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(
      v.union(v.literal("draft"), v.literal("active"), v.literal("paused"), v.literal("archived"))
    ),
  },
  permission: "settings.workspace",
  handler: async (ctx, args) => {
    let carousels;

    if (args.status) {
      carousels = await ctx.db
        .query("carousels")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", args.status!)
        )
        .collect();
    } else {
      carousels = await ctx.db
        .query("carousels")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect();
    }

    return carousels
      .map((carousel) => ({
        ...carousel,
        screens: normalizeCarouselScreens(carousel.screens),
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get single carousel
export const get = authQuery({
  args: { id: v.id("carousels") },
  permission: "settings.workspace",
  allowMissingWorkspace: true,
  resolveWorkspaceId: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    return carousel?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const carousel = await ctx.db.get(args.id);
    if (!carousel) return null;
    return {
      ...carousel,
      screens: normalizeCarouselScreens(carousel.screens),
    };
  },
});

// Delete carousel
export const remove = authMutation({
  args: { id: v.id("carousels") },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    return carousel?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    if (!carousel) throw new Error("Carousel not found");

    // Delete associated impressions
    const impressions = await ctx.db
      .query("carouselImpressions")
      .withIndex("by_carousel", (q) => q.eq("carouselId", args.id))
      .collect();

    for (const impression of impressions) {
      await ctx.db.delete(impression._id);
    }

    await ctx.db.delete(args.id);
  },
});

// Activate carousel
export const activate = authMutation({
  args: { id: v.id("carousels") },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    return carousel?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    if (!carousel) throw new Error("Carousel not found");
    assertValidStatusTransition(carousel.status, "active");
    validateCarouselScreens(carousel.screens);

    await ctx.db.patch(args.id, { status: "active", updatedAt: Date.now() });
  },
});

// Pause carousel
export const pause = authMutation({
  args: { id: v.id("carousels") },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    return carousel?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    if (!carousel) throw new Error("Carousel not found");
    assertValidStatusTransition(carousel.status, "paused");

    await ctx.db.patch(args.id, { status: "paused", updatedAt: Date.now() });
  },
});

// Archive carousel
export const archive = authMutation({
  args: { id: v.id("carousels") },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    return carousel?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    if (!carousel) throw new Error("Carousel not found");
    assertValidStatusTransition(carousel.status, "archived");

    await ctx.db.patch(args.id, { status: "archived", updatedAt: Date.now() });
  },
});

// Task 4.4: Get eligible carousels for mobile app
export const getEligible = query({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUserFromSession(ctx);
    let resolvedVisitorId = args.visitorId;

    if (authUser) {
      await requirePermission(ctx, authUser._id, args.workspaceId, "conversations.read");
      if (!resolvedVisitorId) {
        throw new Error("visitorId is required for authenticated carousel access");
      }
    } else {
      const resolved = await resolveVisitorFromSession(ctx, {
        sessionToken: args.sessionToken,
        workspaceId: args.workspaceId,
      });
      if (args.visitorId && args.visitorId !== resolved.visitorId) {
        throw new Error("Not authorized for requested visitor");
      }
      resolvedVisitorId = resolved.visitorId;
    }

    const visitor = (await ctx.db.get(resolvedVisitorId!)) as Doc<"visitors"> | null;
    if (!visitor || visitor.workspaceId !== args.workspaceId) {
      throw new Error("Visitor not found in workspace");
    }

    // Get all active carousels
    const activeCarousels = await ctx.db
      .query("carousels")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "active")
      )
      .collect();

    // Get visitor's carousel impressions
    const impressions = await ctx.db
      .query("carouselImpressions")
      .withIndex("by_visitor", (q) => q.eq("visitorId", resolvedVisitorId!))
      .collect();

    const completedCarouselIds = new Set(
      impressions
        .filter((i) => i.action === "completed" || i.action === "dismissed")
        .map((i) => i.carouselId as string)
    );

    const eligible: Doc<"carousels">[] = [];

    for (const carousel of activeCarousels) {
      // Skip already completed/dismissed carousels
      if (completedCarouselIds.has(carousel._id as string)) continue;

      try {
        assertCarouselDeliverable(carousel);
      } catch {
        continue;
      }

      // Check targeting rules (audienceRules with targeting fallback)
      const audienceRules = carousel.audienceRules ?? carousel.targeting;
      if (audienceRules) {
        const matches = await evaluateRuleWithSegmentSupport(ctx, audienceRules, visitor);
        if (!matches) continue;
      }

      eligible.push({
        ...carousel,
        screens: normalizeCarouselScreens(carousel.screens),
      });
    }

    // Sort by priority (higher first)
    return eligible.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  },
});

// Task 4.5: Track carousel impressions
export const trackImpression = mutation({
  args: {
    carouselId: v.id("carousels"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    action: v.union(v.literal("shown"), v.literal("completed"), v.literal("dismissed")),
    screenIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.carouselId)) as Doc<"carousels"> | null;
    if (!carousel) {
      throw new Error("Carousel not found");
    }
    assertCarouselDeliverable(carousel);

    const authUser = await getAuthenticatedUserFromSession(ctx);
    let resolvedVisitorId = args.visitorId;

    if (authUser) {
      await requirePermission(ctx, authUser._id, carousel.workspaceId, "conversations.read");
      if (!resolvedVisitorId) {
        throw new Error("visitorId is required for authenticated impression tracking");
      }
    } else {
      const resolved = await resolveVisitorFromSession(ctx, {
        sessionToken: args.sessionToken,
        workspaceId: carousel.workspaceId,
      });
      if (args.visitorId && args.visitorId !== resolved.visitorId) {
        throw new Error("Not authorized for requested visitor");
      }
      resolvedVisitorId = resolved.visitorId;
    }

    const visitor = (await ctx.db.get(resolvedVisitorId!)) as Doc<"visitors"> | null;
    if (!visitor || visitor.workspaceId !== carousel.workspaceId) {
      throw new Error("Visitor not found in carousel workspace");
    }

    if (args.action === "completed" || args.action === "dismissed") {
      const existingTerminal = await findExistingTerminalImpression(
        ctx,
        resolvedVisitorId!,
        args.carouselId
      );
      if (existingTerminal) {
        return existingTerminal._id;
      }
    }

    return await ctx.db.insert("carouselImpressions", {
      carouselId: args.carouselId,
      visitorId: resolvedVisitorId!,
      action: args.action,
      screenIndex: args.screenIndex,
      createdAt: Date.now(),
    });
  },
});

// Get carousel stats
export const getStats = authQuery({
  args: { id: v.id("carousels") },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    return carousel?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const impressions = await ctx.db
      .query("carouselImpressions")
      .withIndex("by_carousel", (q) => q.eq("carouselId", args.id))
      .collect();

    const shown = new Set(impressions.filter((i) => i.action === "shown").map((i) => i.visitorId))
      .size;
    const completed = new Set(
      impressions.filter((i) => i.action === "completed").map((i) => i.visitorId)
    ).size;
    const dismissed = new Set(
      impressions.filter((i) => i.action === "dismissed").map((i) => i.visitorId)
    ).size;

    // Get unique visitors
    const uniqueVisitors = new Set(impressions.map((i) => i.visitorId)).size;

    return {
      shown,
      completed,
      dismissed,
      uniqueVisitors,
      completionRate: shown > 0 ? (completed / shown) * 100 : 0,
      dismissRate: shown > 0 ? (dismissed / shown) * 100 : 0,
    };
  },
});

// List active carousels for visitor (used by Mobile SDK)
export const listActive = query({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUserFromSession(ctx);
    let resolvedVisitorId = args.visitorId;

    if (authUser) {
      await requirePermission(ctx, authUser._id, args.workspaceId, "conversations.read");
      if (!resolvedVisitorId) {
        throw new Error("visitorId is required for authenticated carousel access");
      }
    } else {
      const resolved = await resolveVisitorFromSession(ctx, {
        sessionToken: args.sessionToken,
        workspaceId: args.workspaceId,
      });
      if (args.visitorId && args.visitorId !== resolved.visitorId) {
        throw new Error("Not authorized for requested visitor");
      }
      resolvedVisitorId = resolved.visitorId;
    }

    const visitor = (await ctx.db.get(resolvedVisitorId!)) as Doc<"visitors"> | null;
    if (!visitor || visitor.workspaceId !== args.workspaceId) {
      throw new Error("Visitor not found in workspace");
    }

    // Get all active carousels
    const activeCarousels = await ctx.db
      .query("carousels")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "active")
      )
      .collect();

    // Get visitor's carousel impressions
    const impressions = await ctx.db
      .query("carouselImpressions")
      .withIndex("by_visitor", (q) => q.eq("visitorId", resolvedVisitorId!))
      .collect();

    const completedCarouselIds = new Set(
      impressions
        .filter((i) => i.action === "completed" || i.action === "dismissed")
        .map((i) => i.carouselId as string)
    );

    const eligible: Doc<"carousels">[] = [];

    for (const carousel of activeCarousels) {
      // Skip already completed/dismissed carousels
      if (completedCarouselIds.has(carousel._id as string)) continue;

      try {
        assertCarouselDeliverable(carousel);
      } catch {
        continue;
      }

      // Check targeting rules (audienceRules with targeting fallback)
      const audienceRules = carousel.audienceRules ?? carousel.targeting;
      if (audienceRules) {
        const matches = await evaluateRuleWithSegmentSupport(ctx, audienceRules, visitor);
        if (!matches) continue;
      }

      eligible.push({
        ...carousel,
        screens: normalizeCarouselScreens(carousel.screens),
      });
    }

    // Sort by priority (higher first)
    return eligible.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  },
});

// Record carousel impression (used by Mobile SDK)
export const recordImpression = mutation({
  args: {
    carouselId: v.id("carousels"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    action: v.union(v.literal("shown"), v.literal("completed"), v.literal("dismissed")),
    screenIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.carouselId)) as Doc<"carousels"> | null;
    if (!carousel) {
      throw new Error("Carousel not found");
    }
    assertCarouselDeliverable(carousel);

    const authUser = await getAuthenticatedUserFromSession(ctx);
    let resolvedVisitorId = args.visitorId;

    if (authUser) {
      await requirePermission(ctx, authUser._id, carousel.workspaceId, "conversations.read");
      if (!resolvedVisitorId) {
        throw new Error("visitorId is required for authenticated impression tracking");
      }
    } else {
      const resolved = await resolveVisitorFromSession(ctx, {
        sessionToken: args.sessionToken,
        workspaceId: carousel.workspaceId,
      });
      if (args.visitorId && args.visitorId !== resolved.visitorId) {
        throw new Error("Not authorized for requested visitor");
      }
      resolvedVisitorId = resolved.visitorId;
    }

    const visitor = (await ctx.db.get(resolvedVisitorId!)) as Doc<"visitors"> | null;
    if (!visitor || visitor.workspaceId !== carousel.workspaceId) {
      throw new Error("Visitor not found in carousel workspace");
    }

    if (args.action === "completed" || args.action === "dismissed") {
      const existingTerminal = await findExistingTerminalImpression(
        ctx,
        resolvedVisitorId!,
        args.carouselId
      );
      if (existingTerminal) {
        return existingTerminal._id;
      }
    }

    return await ctx.db.insert("carouselImpressions", {
      carouselId: args.carouselId,
      visitorId: resolvedVisitorId!,
      action: args.action,
      screenIndex: args.screenIndex,
      createdAt: Date.now(),
    });
  },
});

// Duplicate carousel
export const duplicate = authMutation({
  args: { id: v.id("carousels") },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    return carousel?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    if (!carousel) throw new Error("Carousel not found");

    const normalizedScreens = normalizeCarouselScreens(carousel.screens);
    const validatedScreens = validateCarouselScreens(normalizedScreens);

    const now = Date.now();
    return await ctx.db.insert("carousels", {
      workspaceId: carousel.workspaceId,
      name: `${carousel.name} (Copy)`,
      screens: validatedScreens,
      targeting: carousel.targeting,
      priority: carousel.priority,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Task 6.5: Trigger carousel for specific visitors (from campaigns/workflows)
export const triggerForVisitors = authMutation({
  args: {
    carouselId: v.id("carousels"),
    visitorIds: v.array(v.id("visitors")),
  },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.carouselId)) as Doc<"carousels"> | null;
    return carousel?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.carouselId)) as Doc<"carousels"> | null;
    if (!carousel) throw new Error("Carousel not found");
    if (carousel.status !== "active") throw new Error("Carousel must be active to trigger");

    const now = Date.now();
    const triggered: Id<"visitors">[] = [];

    for (const visitorId of args.visitorIds) {
      // Check if visitor already completed/dismissed this carousel
      const existingImpression = await ctx.db
        .query("carouselImpressions")
        .withIndex("by_visitor", (q) => q.eq("visitorId", visitorId))
        .filter((q) => q.eq(q.field("carouselId"), args.carouselId))
        .filter((q) =>
          q.or(q.eq(q.field("action"), "completed"), q.eq(q.field("action"), "dismissed"))
        )
        .first();

      if (existingImpression) continue;

      // Create a "triggered" impression to mark this carousel for the visitor
      await ctx.db.insert("carouselImpressions", {
        carouselId: args.carouselId,
        visitorId,
        action: "shown", // Mark as triggered/shown
        createdAt: now,
      });

      triggered.push(visitorId);
    }

    return { triggered: triggered.length, skipped: args.visitorIds.length - triggered.length };
  },
});

// Trigger carousel for all visitors matching targeting criteria
export const triggerForTargetedVisitors = authMutation({
  args: {
    carouselId: v.id("carousels"),
  },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.carouselId)) as Doc<"carousels"> | null;
    return carousel?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.carouselId)) as Doc<"carousels"> | null;
    if (!carousel) throw new Error("Carousel not found");
    if (carousel.status !== "active") throw new Error("Carousel must be active to trigger");

    // Get all visitors in the workspace
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", carousel.workspaceId))
      .collect();

    const eligibleVisitorIds: Id<"visitors">[] = [];

    for (const visitor of visitors) {
      // Check targeting rules if specified (audienceRules with targeting fallback)
      const audienceRules = carousel.audienceRules ?? carousel.targeting;
      if (audienceRules) {
        const matches = await evaluateRuleWithSegmentSupport(ctx, audienceRules, visitor);
        if (!matches) continue;
      }
      eligibleVisitorIds.push(visitor._id);
    }

    if (eligibleVisitorIds.length === 0) {
      return { triggered: 0, skipped: 0, message: "No visitors match targeting criteria" };
    }

    // Trigger for eligible visitors
    const now = Date.now();
    let triggered = 0;
    let skipped = 0;

    for (const visitorId of eligibleVisitorIds) {
      // Check if visitor already completed/dismissed this carousel
      const existingImpression = await ctx.db
        .query("carouselImpressions")
        .withIndex("by_visitor", (q) => q.eq("visitorId", visitorId))
        .filter((q) => q.eq(q.field("carouselId"), args.carouselId))
        .filter((q) =>
          q.or(q.eq(q.field("action"), "completed"), q.eq(q.field("action"), "dismissed"))
        )
        .first();

      if (existingImpression) {
        skipped++;
        continue;
      }

      await ctx.db.insert("carouselImpressions", {
        carouselId: args.carouselId,
        visitorId,
        action: "shown",
        createdAt: now,
      });

      triggered++;
    }

    return { triggered, skipped };
  },
});

// Send push notification to trigger carousel on mobile devices
export const sendPushTrigger = authAction({
  args: {
    carouselId: v.id("carousels"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    sent: number;
    message?: string;
    failed?: number;
    error?: string;
    tickets?: Array<{ status: string; id?: string; error?: string }>;
  }> => {
    const carousel = await ctx.runQuery(api.carousels.get, { id: args.carouselId });
    if (!carousel) throw new Error("Carousel not found");
    if (carousel.status !== "active") throw new Error("Carousel must be active to trigger");

    // Get first screen for push notification content
    const firstScreen = carousel.screens[0];
    const title = firstScreen?.title || carousel.name;
    const body = firstScreen?.body || "Check out this new content";

    // Get eligible visitors with push tokens
    const eligibleVisitors = await ctx.runQuery(api.carousels.getEligibleVisitorsWithPushTokens, {
      carouselId: args.carouselId,
    });

    if (eligibleVisitors.length === 0) {
      return { success: true, sent: 0, message: "No eligible visitors with push tokens" };
    }

    const visitorIds = Array.from(
      new Set(eligibleVisitors.map((visitor: { visitorId: Id<"visitors"> }) => visitor.visitorId))
    ) as Id<"visitors">[];
    const routed = await ctx.runMutation(internal.notifications.routeEvent, {
      eventType: "carousel_trigger",
      domain: "outbound",
      audience: "visitor",
      workspaceId: carousel.workspaceId,
      actorType: "system",
      title,
      body,
      data: {
        type: "carousel_trigger",
        carouselId: args.carouselId,
      },
      recipientVisitorIds: visitorIds,
      eventKey: `carousel_trigger:${args.carouselId}:${carousel.updatedAt}`,
    });

    return {
      success: true,
      sent: routed.scheduled,
      failed: 0,
      message: routed.scheduled === 0 ? "No eligible visitors with push tokens" : undefined,
    };
  },
});

// Get visitors eligible for carousel with push tokens
export const getEligibleVisitorsWithPushTokens = authQuery({
  args: {
    carouselId: v.id("carousels"),
  },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.carouselId)) as Doc<"carousels"> | null;
    return carousel?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.carouselId)) as Doc<"carousels"> | null;
    if (!carousel) return [];

    // Get all visitors with push tokens in this workspace
    const pushTokens = await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", carousel.workspaceId))
      .collect();

    if (pushTokens.length === 0) return [];

    // Get unique visitor IDs
    const visitorIds = [...new Set(pushTokens.map((t) => t.visitorId))];

    const eligibleVisitors: Array<{ visitorId: Id<"visitors">; token: string }> = [];

    for (const visitorId of visitorIds) {
      const visitor = (await ctx.db.get(visitorId)) as Doc<"visitors"> | null;
      if (!visitor) continue;

      // Check targeting rules if specified (audienceRules with targeting fallback)
      const audienceRules = carousel.audienceRules ?? carousel.targeting;
      if (audienceRules) {
        const matches = await evaluateRuleWithSegmentSupport(ctx, audienceRules, visitor);
        if (!matches) continue;
      }

      // Check if visitor already completed/dismissed this carousel
      const existingImpression = await ctx.db
        .query("carouselImpressions")
        .withIndex("by_visitor", (q) => q.eq("visitorId", visitorId))
        .filter((q) => q.eq(q.field("carouselId"), args.carouselId))
        .filter((q) =>
          q.or(q.eq(q.field("action"), "completed"), q.eq(q.field("action"), "dismissed"))
        )
        .first();

      if (existingImpression) continue;

      // Get the most recent token for this visitor
      const visitorTokens = pushTokens.filter((t) => t.visitorId === visitorId);
      const latestToken = visitorTokens.sort((a, b) => b.updatedAt - a.updatedAt)[0];

      if (latestToken) {
        eligibleVisitors.push({
          visitorId,
          token: latestToken.token,
        });
      }
    }

    return eligibleVisitors;
  },
});
