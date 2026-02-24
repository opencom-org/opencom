import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUserFromSession } from "./auth";
import { requirePermission } from "./permissions";
import { selectorQualityValidator } from "./validators";

type TooltipAuthoringSessionDoc = Doc<"tooltipAuthoringSessions">;
type TooltipDoc = Doc<"tooltips">;

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => chars.charAt(byte % chars.length)).join("");
}

function isExpired(session: TooltipAuthoringSessionDoc): boolean {
  return Date.now() > session.expiresAt;
}

async function getSessionByToken(
  ctx: QueryCtx | MutationCtx,
  token: string
): Promise<TooltipAuthoringSessionDoc | null> {
  return ctx.db
    .query("tooltipAuthoringSessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();
}

function assertWorkspaceMatch(
  session: TooltipAuthoringSessionDoc,
  workspaceId: Id<"workspaces">
): void {
  if (session.workspaceId !== workspaceId) {
    throw new Error("Session workspace mismatch");
  }
}

async function getTooltipForSession(
  ctx: QueryCtx | MutationCtx,
  session: TooltipAuthoringSessionDoc
): Promise<TooltipDoc | null> {
  if (!session.tooltipId) {
    return null;
  }

  const tooltip = (await ctx.db.get(session.tooltipId)) as TooltipDoc | null;
  if (!tooltip) {
    throw new Error("Tooltip not found");
  }
  if (tooltip.workspaceId !== session.workspaceId) {
    throw new Error("Tooltip does not belong to session workspace");
  }
  return tooltip;
}

async function requireActiveSessionForMutation(
  ctx: MutationCtx,
  token: string,
  workspaceId: Id<"workspaces">
): Promise<TooltipAuthoringSessionDoc> {
  const session = await getSessionByToken(ctx, token);
  if (!session) {
    throw new Error("Session not found");
  }

  assertWorkspaceMatch(session, workspaceId);

  if (session.status !== "active") {
    throw new Error(`Session is ${session.status}`);
  }

  if (isExpired(session)) {
    await ctx.db.patch(session._id, { status: "expired" });
    throw new Error("Session expired");
  }

  await getTooltipForSession(ctx, session);
  return session;
}

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    tooltipId: v.optional(v.id("tooltips")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }
    await requirePermission(ctx, user._id, args.workspaceId, "settings.workspace");

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    if (args.tooltipId) {
      const tooltip = await ctx.db.get(args.tooltipId);
      if (!tooltip) {
        throw new Error("Tooltip not found");
      }
      if (tooltip.workspaceId !== args.workspaceId) {
        throw new Error("Tooltip does not belong to this workspace");
      }
    }

    const now = Date.now();
    const token = generateToken();
    const expiresAt = now + 30 * 60 * 1000;

    const sessionId = await ctx.db.insert("tooltipAuthoringSessions", {
      token,
      tooltipId: args.tooltipId,
      workspaceId: args.workspaceId,
      userId: user._id,
      status: "active",
      createdAt: now,
      expiresAt,
    });

    return { sessionId, token };
  },
});

export const validate = query({
  args: {
    token: v.string(),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const session = await getSessionByToken(ctx, args.token);
    if (!session) {
      return { valid: false, reason: "Session not found" } as const;
    }

    if (session.workspaceId !== args.workspaceId) {
      return { valid: false, reason: "Session workspace mismatch" } as const;
    }

    if (session.status !== "active") {
      return { valid: false, reason: `Session is ${session.status}` } as const;
    }

    if (isExpired(session)) {
      return { valid: false, reason: "Session expired" } as const;
    }

    let tooltip: TooltipDoc | null = null;
    try {
      tooltip = await getTooltipForSession(ctx, session);
    } catch (error) {
      return {
        valid: false,
        reason: error instanceof Error ? error.message : "Tooltip session invalid",
      } as const;
    }

    return {
      valid: true,
      session: {
        _id: session._id,
        tooltipId: session.tooltipId,
        workspaceId: session.workspaceId,
        status: session.status,
        selectedSelector: session.selectedSelector,
        selectedSelectorQuality: session.selectedSelectorQuality,
      },
      tooltip: tooltip
        ? {
            _id: tooltip._id,
            name: tooltip.name,
            content: tooltip.content,
            elementSelector: tooltip.elementSelector,
            triggerType: tooltip.triggerType,
            selectorQuality: tooltip.selectorQuality,
          }
        : null,
    } as const;
  },
});

export const updateSelector = mutation({
  args: {
    token: v.string(),
    workspaceId: v.id("workspaces"),
    elementSelector: v.string(),
    selectorQuality: v.optional(selectorQualityValidator),
  },
  handler: async (ctx, args) => {
    const session = await requireActiveSessionForMutation(ctx, args.token, args.workspaceId);

    await ctx.db.patch(session._id, {
      selectedSelector: args.elementSelector,
      selectedSelectorQuality: args.selectorQuality,
    });

    if (session.tooltipId) {
      await ctx.db.patch(session.tooltipId, {
        elementSelector: args.elementSelector,
        selectorQuality: args.selectorQuality,
        updatedAt: Date.now(),
      });
    }

    return {
      success: true,
      selector: args.elementSelector,
      selectorQuality: args.selectorQuality,
    };
  },
});

export const end = mutation({
  args: {
    token: v.string(),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const session = await requireActiveSessionForMutation(ctx, args.token, args.workspaceId);

    await ctx.db.patch(session._id, {
      status: "completed",
    });

    return {
      success: true,
      selectedSelector: session.selectedSelector,
      selectedSelectorQuality: session.selectedSelectorQuality,
    };
  },
});

export const getByToken = query({
  args: {
    token: v.string(),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const session = await getSessionByToken(ctx, args.token);
    if (!session || session.workspaceId !== args.workspaceId) {
      return null;
    }

    const status = session.status === "active" && isExpired(session) ? "expired" : session.status;
    return {
      ...session,
      status,
    };
  },
});
