import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthenticatedUserFromSession } from "./auth";
import { requirePermission } from "./permissions";
import { selectorQualityValidator } from "./validators";

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => chars.charAt(byte % chars.length)).join("");
}

function deriveRoutePath(currentUrl?: string, fallbackUrl?: string): string | undefined {
  const candidate = currentUrl ?? fallbackUrl;
  if (!candidate) {
    return undefined;
  }
  try {
    const parsed = new URL(candidate);
    parsed.searchParams.delete("opencom_authoring");
    parsed.searchParams.delete("opencom_tooltip_authoring");
    const search = parsed.searchParams.toString();
    return `${parsed.pathname}${search ? `?${search}` : ""}` || "/";
  } catch {
    return undefined;
  }
}

export const create = mutation({
  args: {
    tourId: v.id("tours"),
    stepId: v.optional(v.id("tourSteps")),
    targetUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const tour = await ctx.db.get(args.tourId);
    if (!tour) {
      throw new Error("Tour not found");
    }
    await requirePermission(ctx, user._id, tour.workspaceId, "tours.manage");

    if (args.stepId) {
      const step = await ctx.db.get(args.stepId);
      if (!step || step.tourId !== args.tourId) {
        throw new Error("Step does not belong to this tour");
      }
    }

    const now = Date.now();
    const token = generateToken();
    const expiresAt = now + 60 * 60 * 1000; // 1 hour expiry

    const sessionId = await ctx.db.insert("authoringSessions", {
      token,
      tourId: args.tourId,
      stepId: args.stepId,
      userId: user._id,
      workspaceId: tour.workspaceId,
      targetUrl: args.targetUrl,
      expiresAt,
      createdAt: now,
    });

    return { sessionId, token };
  },
});

export const validate = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("authoringSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session) {
      return { valid: false, reason: "Session not found" };
    }

    if (Date.now() > session.expiresAt) {
      return { valid: false, reason: "Session expired" };
    }

    const tour = await ctx.db.get(session.tourId);
    if (!tour) {
      return { valid: false, reason: "Tour not found" };
    }

    const steps = await ctx.db
      .query("tourSteps")
      .withIndex("by_tour", (q) => q.eq("tourId", session.tourId))
      .collect();

    return {
      valid: true,
      session: {
        tourId: session.tourId,
        stepId: session.stepId,
        workspaceId: session.workspaceId,
        targetUrl: session.targetUrl,
      },
      tour: {
        _id: tour._id,
        name: tour.name,
        buttonColor: tour.buttonColor,
      },
      steps: steps.sort((a, b) => a.order - b.order),
    };
  },
});

export const updateStep = mutation({
  args: {
    token: v.string(),
    stepId: v.id("tourSteps"),
    elementSelector: v.string(),
    currentUrl: v.optional(v.string()),
    selectorQuality: v.optional(selectorQualityValidator),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("authoringSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session) {
      throw new Error("Session not found");
    }

    if (Date.now() > session.expiresAt) {
      throw new Error("Session expired");
    }

    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new Error("Step not found");
    }

    if (step.tourId !== session.tourId) {
      throw new Error("Step does not belong to this tour");
    }

    await ctx.db.patch(args.stepId, {
      elementSelector: args.elementSelector,
      routePath: deriveRoutePath(args.currentUrl, session.targetUrl),
      selectorQuality: args.selectorQuality,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const setCurrentStep = mutation({
  args: {
    token: v.string(),
    stepId: v.optional(v.id("tourSteps")),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("authoringSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session) {
      throw new Error("Session not found");
    }

    if (Date.now() > session.expiresAt) {
      throw new Error("Session expired");
    }

    await ctx.db.patch(session._id, {
      stepId: args.stepId,
    });

    return { success: true };
  },
});

export const end = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("authoringSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (session) {
      await ctx.db.delete(session._id);
    }

    return { success: true };
  },
});
