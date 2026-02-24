import { v } from "convex/values";
import { mutation, query, internalMutation, QueryCtx, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { requireValidOrigin } from "./originValidation";
import { getAuthenticatedUserFromSession } from "./auth";
import { requirePermission } from "./permissions";
import { customAttributesValidator } from "./validators";
import { logAudit } from "./auditLogs";
import { formatReadableVisitorId } from "./visitorReadableId";

const DEFAULT_SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_SESSION_LIFETIME_MS = 1 * 60 * 60 * 1000; // 1 hour
const MAX_SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REFRESH_THRESHOLD = 0.25; // Refresh when <25% lifetime remains

/**
 * Generate a cryptographically random session token with `wst_` prefix.
 * 32 random bytes → 64 hex chars → 256 bits entropy.
 */
function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `wst_${hex}`;
}

/**
 * Get the session lifetime for a workspace, clamped to [1h, 7d].
 */
function getSessionLifetime(sessionLifetimeMs: number | undefined): number {
  if (!sessionLifetimeMs) return DEFAULT_SESSION_LIFETIME_MS;
  return Math.max(MIN_SESSION_LIFETIME_MS, Math.min(MAX_SESSION_LIFETIME_MS, sessionLifetimeMs));
}

/**
 * Shared helper: validates a session token and returns the associated visitor.
 * Always requires a valid, non-expired session token — signed sessions are mandatory.
 *
 * Used by all visitor-facing endpoints to resolve the caller's identity.
 */
export async function resolveVisitorFromSession(
  ctx: QueryCtx | MutationCtx,
  args: {
    sessionToken?: string;
    workspaceId: Id<"workspaces">;
  }
): Promise<{ visitorId: Id<"visitors">; identityVerified: boolean }> {
  if (!args.sessionToken) {
    throw new Error("Session token required");
  }

  const session = await ctx.db
    .query("widgetSessions")
    .withIndex("by_token", (q) => q.eq("token", args.sessionToken!))
    .first();

  if (!session) {
    throw new Error("Invalid session token");
  }

  if (session.workspaceId !== args.workspaceId) {
    throw new Error("Session token does not match workspace");
  }

  if (session.expiresAt < Date.now()) {
    throw new Error("Session expired");
  }

  return {
    visitorId: session.visitorId,
    identityVerified: session.identityVerified,
  };
}

/**
 * Boot mutation — the widget's entry point.
 * Validates origin, creates/gets visitor, validates HMAC if required,
 * creates a widgetSessions record, and returns { visitor, sessionToken, expiresAt }.
 */
export const boot = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    sessionId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    externalUserId: v.optional(v.string()),
    userHash: v.optional(v.string()),
    location: v.optional(
      v.object({
        city: v.optional(v.string()),
        region: v.optional(v.string()),
        country: v.optional(v.string()),
        countryCode: v.optional(v.string()),
      })
    ),
    device: v.optional(
      v.object({
        browser: v.optional(v.string()),
        os: v.optional(v.string()),
        deviceType: v.optional(v.string()),
        platform: v.optional(v.string()),
      })
    ),
    referrer: v.optional(v.string()),
    currentUrl: v.optional(v.string()),
    customAttributes: v.optional(customAttributesValidator),
    existingVisitorId: v.optional(v.id("visitors")),
    origin: v.optional(v.string()),
    clientType: v.optional(v.string()),
    clientVersion: v.optional(v.string()),
    clientIdentifier: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Validate origin
    await requireValidOrigin(ctx, args.workspaceId, args.origin);

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const now = Date.now();

    // 2. Create or get visitor (same logic as visitors.getOrCreate)
    let visitor: Doc<"visitors"> | null = null;

    const ensureReadableId = async (
      candidate: Doc<"visitors"> | null
    ): Promise<Doc<"visitors"> | null> => {
      if (!candidate) {
        return null;
      }
      if (candidate.readableId) {
        return candidate;
      }

      await ctx.db.patch(candidate._id, {
        readableId: formatReadableVisitorId(candidate._id),
      });
      return (await ctx.db.get(candidate._id)) as Doc<"visitors"> | null;
    };

    // Check persisted visitor ID first
    if (args.existingVisitorId) {
      const persisted = await ctx.db.get(args.existingVisitorId);
      if (persisted && persisted.workspaceId === args.workspaceId) {
        await ctx.db.patch(persisted._id, {
          sessionId: args.sessionId,
          lastSeenAt: now,
          ...(args.email && { email: args.email }),
          ...(args.name && { name: args.name }),
          ...(args.externalUserId && { externalUserId: args.externalUserId }),
          ...(args.location && { location: args.location }),
          ...(args.device && { device: args.device }),
          ...(args.referrer && { referrer: args.referrer }),
          ...(args.currentUrl && { currentUrl: args.currentUrl }),
          ...(args.customAttributes && { customAttributes: args.customAttributes }),
        });
        visitor = await ensureReadableId(
          (await ctx.db.get(persisted._id)) as Doc<"visitors"> | null
        );
      }
    }

    if (!visitor) {
      const existingBySession = await ctx.db
        .query("visitors")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .first();

      if (existingBySession && existingBySession.workspaceId === args.workspaceId) {
        await ctx.db.patch(existingBySession._id, {
          lastSeenAt: now,
          ...(args.email && { email: args.email }),
          ...(args.name && { name: args.name }),
          ...(args.externalUserId && { externalUserId: args.externalUserId }),
          ...(args.location && { location: args.location }),
          ...(args.device && { device: args.device }),
          ...(args.referrer && { referrer: args.referrer }),
          ...(args.currentUrl && { currentUrl: args.currentUrl }),
          ...(args.customAttributes && { customAttributes: args.customAttributes }),
        });
        visitor = await ensureReadableId(
          (await ctx.db.get(existingBySession._id)) as Doc<"visitors"> | null
        );
      }
    }

    if (!visitor && args.email) {
      const existingByEmail = await ctx.db
        .query("visitors")
        .withIndex("by_email", (q) => q.eq("workspaceId", args.workspaceId).eq("email", args.email))
        .first();

      if (existingByEmail) {
        await ctx.db.patch(existingByEmail._id, {
          sessionId: args.sessionId,
          lastSeenAt: now,
          ...(args.name && { name: args.name }),
          ...(args.externalUserId && { externalUserId: args.externalUserId }),
          ...(args.location && { location: args.location }),
          ...(args.device && { device: args.device }),
          ...(args.referrer && { referrer: args.referrer }),
          ...(args.currentUrl && { currentUrl: args.currentUrl }),
          ...(args.customAttributes && { customAttributes: args.customAttributes }),
        });
        visitor = await ensureReadableId(
          (await ctx.db.get(existingByEmail._id)) as Doc<"visitors"> | null
        );
      }
    }

    if (!visitor) {
      const id = await ctx.db.insert("visitors", {
        sessionId: args.sessionId,
        workspaceId: args.workspaceId,
        email: args.email,
        name: args.name,
        externalUserId: args.externalUserId,
        location: args.location,
        device: args.device,
        referrer: args.referrer,
        currentUrl: args.currentUrl,
        customAttributes: args.customAttributes,
        firstSeenAt: now,
        lastSeenAt: now,
        createdAt: now,
      });
      visitor = await ensureReadableId((await ctx.db.get(id)) as Doc<"visitors"> | null);
    }

    if (!visitor) {
      throw new Error("Failed to create or retrieve visitor");
    }

    // 3. Validate HMAC if workspace requires it
    let identityVerified = false;

    if (args.externalUserId && args.userHash) {
      const result = await ctx.runMutation(internal.identityVerification.verifyIdentity, {
        workspaceId: args.workspaceId,
        visitorId: visitor._id,
        userId: args.externalUserId,
        userHash: args.userHash,
      });

      if (result.verified) {
        identityVerified = true;
      } else if (!result.skipped) {
        // Check if verification is required
        if (workspace.identityVerificationMode === "required") {
          throw new Error("Identity verification failed: invalid userHash");
        }
      }
    } else if (args.externalUserId && !args.userHash) {
      // userId without userHash — reject in required mode
      if (
        workspace.identityVerificationEnabled &&
        workspace.identityVerificationMode === "required"
      ) {
        throw new Error("Identity verification failed: userHash is required");
      }
    }

    // 4. Create session record
    const lifetime = getSessionLifetime(workspace.sessionLifetimeMs);
    const token = generateSessionToken();
    const expiresAt = now + lifetime;
    const devicePlatform = args.device?.platform;
    const inferredClientType =
      args.clientType ??
      (devicePlatform === "ios" || devicePlatform === "android" ? "mobile_sdk" : "web_widget");

    await ctx.db.insert("widgetSessions", {
      token,
      visitorId: visitor._id,
      workspaceId: args.workspaceId,
      identityVerified,
      clientType: inferredClientType,
      clientVersion: args.clientVersion,
      clientIdentifier: args.clientIdentifier,
      origin: args.origin,
      currentUrl: args.currentUrl,
      devicePlatform,
      expiresAt,
      createdAt: now,
    });

    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorType: "api",
      action: "auth.session.created",
      resourceType: "widgetSession",
      resourceId: visitor._id,
      metadata: {
        source: "widgetSessions.boot",
        identityVerified,
      },
    });

    return {
      visitor,
      sessionToken: token,
      expiresAt,
    };
  },
});

/**
 * Refresh mutation — issues a new token and invalidates the old one.
 * Rejects if the old token is expired.
 */
export const refresh = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("widgetSessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .first();

    if (!session) {
      throw new Error("Invalid session token");
    }

    const now = Date.now();

    if (session.expiresAt < now) {
      // Clean up the expired session
      await ctx.db.delete(session._id);
      throw new Error("Session expired: please re-boot");
    }

    const workspace = await ctx.db.get(session.workspaceId);
    const lifetime = getSessionLifetime(workspace?.sessionLifetimeMs);

    // Issue new token
    const newToken = generateSessionToken();
    const newExpiresAt = now + lifetime;

    await ctx.db.insert("widgetSessions", {
      token: newToken,
      visitorId: session.visitorId,
      workspaceId: session.workspaceId,
      identityVerified: session.identityVerified,
      expiresAt: newExpiresAt,
      createdAt: now,
    });

    // Invalidate old token
    await ctx.db.delete(session._id);

    await logAudit(ctx, {
      workspaceId: session.workspaceId,
      actorType: "api",
      action: "auth.session.created",
      resourceType: "widgetSession",
      resourceId: session.visitorId,
      metadata: {
        source: "widgetSessions.refresh",
        refreshed: true,
      },
    });

    return {
      sessionToken: newToken,
      expiresAt: newExpiresAt,
    };
  },
});

export const validateSessionToken = query({
  args: {
    workspaceId: v.id("workspaces"),
    sessionToken: v.string(),
    visitorId: v.optional(v.id("visitors")),
  },
  handler: async (ctx, args) => {
    try {
      const resolved = await resolveVisitorFromSession(ctx, {
        workspaceId: args.workspaceId,
        sessionToken: args.sessionToken,
      });

      if (args.visitorId && resolved.visitorId !== args.visitorId) {
        return {
          valid: false,
          reason: "Session token does not match visitor",
        };
      }

      return {
        valid: true,
        visitorId: resolved.visitorId,
        identityVerified: resolved.identityVerified,
      };
    } catch (error) {
      return {
        valid: false,
        reason: error instanceof Error ? error.message : "Session token validation failed",
      };
    }
  },
});

/**
 * Revoke mutation — immediately invalidates a session token.
 */
export const revoke = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("widgetSessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .first();

    if (session) {
      await ctx.db.delete(session._id);
      await logAudit(ctx, {
        workspaceId: session.workspaceId,
        actorType: "api",
        action: "auth.logout",
        resourceType: "widgetSession",
        resourceId: session.visitorId,
        metadata: {
          source: "widgetSessions.revoke",
        },
      });
    }

    return { success: true };
  },
});

/**
 * Scheduled cleanup — deletes all expired sessions.
 * Run periodically via cron or scheduler.
 */
export const cleanupExpiredSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const expired = await ctx.db
      .query("widgetSessions")
      .withIndex("by_expires")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .take(1000);

    let deleted = 0;
    for (const session of expired) {
      await ctx.db.delete(session._id);
      deleted++;
    }

    return { deleted, hasMore: expired.length === 1000 };
  },
});

/**
 * Get signed session settings for a workspace (admin-facing).
 */
export const getSettings = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) return null;

    await requirePermission(ctx, user._id, args.workspaceId, "settings.security");

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) return null;

    return {
      sessionLifetimeMs: workspace.sessionLifetimeMs ?? DEFAULT_SESSION_LIFETIME_MS,
    };
  },
});

/**
 * Update signed session settings for a workspace (admin-facing).
 */
export const updateSettings = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    sessionLifetimeMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    await requirePermission(ctx, user._id, args.workspaceId, "settings.security");

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const updates: Record<string, unknown> = {};

    if (args.sessionLifetimeMs !== undefined) {
      // Clamp to valid range
      updates.sessionLifetimeMs = Math.max(
        MIN_SESSION_LIFETIME_MS,
        Math.min(MAX_SESSION_LIFETIME_MS, args.sessionLifetimeMs)
      );
    }

    await ctx.db.patch(args.workspaceId, updates);

    return { success: true };
  },
});

// Export constants for use in tests and widget client
export { DEFAULT_SESSION_LIFETIME_MS, REFRESH_THRESHOLD };
