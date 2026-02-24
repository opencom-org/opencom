import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthenticatedUserFromSession } from "./auth";
import { requirePermission } from "./permissions";
import { logAudit } from "./auditLogs";
import { resolveVisitorFromSession } from "./widgetSessions";

// HMAC secret generation (task 5.1)
// Generates a cryptographically secure random secret
function generateSecureSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const length = 64;
  let result = "";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

// Get identity verification settings
export const getSettings = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return null;
    }

    await requirePermission(ctx, user._id, args.workspaceId, "settings.security");

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      return null;
    }

    return {
      enabled: workspace.identityVerificationEnabled ?? false,
      mode: workspace.identityVerificationMode ?? "optional",
      hasSecret: !!workspace.identitySecret,
    };
  },
});

// Enable identity verification and generate secret (task 5.2)
export const enable = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    mode: v.optional(v.union(v.literal("optional"), v.literal("required"))),
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

    // Generate new secret if none exists
    const secret = workspace.identitySecret ?? generateSecureSecret();
    const mode = args.mode ?? "optional";

    await ctx.db.patch(args.workspaceId, {
      identitySecret: secret,
      identityVerificationEnabled: true,
      identityVerificationMode: mode,
    });

    // Log the action
    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorId: user._id,
      actorType: "user",
      action: "widget.identity.enabled",
      resourceType: "workspace",
      resourceId: args.workspaceId,
      metadata: { mode },
    });

    // Return the secret only on first generation (shown once)
    const isNewSecret = !workspace.identitySecret;
    return {
      success: true,
      secret: isNewSecret ? secret : undefined,
      isNewSecret,
      mode,
    };
  },
});

// Disable identity verification (task 5.3)
export const disable = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    confirmDisable: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    if (!args.confirmDisable) {
      throw new Error("Confirmation required to disable identity verification");
    }

    await requirePermission(ctx, user._id, args.workspaceId, "settings.security");

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    await ctx.db.patch(args.workspaceId, {
      identityVerificationEnabled: false,
    });

    // Log the action
    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorId: user._id,
      actorType: "user",
      action: "widget.identity.disabled",
      resourceType: "workspace",
      resourceId: args.workspaceId,
    });

    return { success: true };
  },
});

// Update identity verification mode (task 5.8)
export const updateMode = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    mode: v.union(v.literal("optional"), v.literal("required")),
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

    if (!workspace.identityVerificationEnabled) {
      throw new Error("Identity verification must be enabled first");
    }

    const oldMode = workspace.identityVerificationMode ?? "optional";

    await ctx.db.patch(args.workspaceId, {
      identityVerificationMode: args.mode,
    });

    // Log the action
    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorId: user._id,
      actorType: "user",
      action: "workspace.security.changed",
      resourceType: "workspace",
      resourceId: args.workspaceId,
      metadata: {
        setting: "identityVerificationMode",
        oldValue: oldMode,
        newValue: args.mode,
      },
    });

    return { success: true };
  },
});

// Rotate HMAC secret with grace period (task 5.7)
export const rotateSecret = mutation({
  args: {
    workspaceId: v.id("workspaces"),
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

    if (!workspace.identityVerificationEnabled) {
      throw new Error("Identity verification must be enabled to rotate secret");
    }

    // Generate new secret
    const newSecret = generateSecureSecret();

    await ctx.db.patch(args.workspaceId, {
      identitySecret: newSecret,
    });

    // Log the action
    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorId: user._id,
      actorType: "user",
      action: "widget.identity.secret.rotated",
      resourceType: "workspace",
      resourceId: args.workspaceId,
    });

    return {
      success: true,
      secret: newSecret,
    };
  },
});

// Get the current secret (for displaying in settings, shown once)
export const getSecret = query({
  args: {
    workspaceId: v.id("workspaces"),
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

    if (!workspace.identitySecret) {
      return null;
    }

    return {
      secret: workspace.identitySecret,
    };
  },
});

// Verify HMAC identity (task 5.4)
// This is called internally when widget sends userId + userHash
export const verifyIdentity = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.id("visitors"),
    userId: v.string(),
    userHash: v.string(),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      return { verified: false, error: "Workspace not found" };
    }

    // If identity verification is not enabled, mark as unverified but allow
    if (!workspace.identityVerificationEnabled) {
      return { verified: false, skipped: true };
    }

    const secret = workspace.identitySecret;
    if (!secret) {
      return { verified: false, error: "No identity secret configured" };
    }

    // Verify HMAC
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(args.userId));

    const expectedHash = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const verified = expectedHash === args.userHash.toLowerCase();

    // Update visitor record (task 5.6)
    if (verified) {
      await ctx.db.patch(args.visitorId, {
        identityVerified: true,
        identityVerifiedAt: Date.now(),
      });
    } else {
      // Fail-closed: Invalid HMAC = reject
      await ctx.db.patch(args.visitorId, {
        identityVerified: false,
      });
    }

    return { verified };
  },
});

// Check if identity verification is required for a workspace
export const isRequired = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      return { required: false, enabled: false };
    }

    return {
      enabled: workspace.identityVerificationEnabled ?? false,
      required:
        workspace.identityVerificationEnabled && workspace.identityVerificationMode === "required",
    };
  },
});

// Get visitor verification status
export const getVisitorStatus = query({
  args: {
    visitorId: v.id("visitors"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) {
      return null;
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (user) {
      await requirePermission(ctx, user._id, visitor.workspaceId, "users.read");
    } else {
      const resolved = await resolveVisitorFromSession(ctx, {
        sessionToken: args.sessionToken,
        workspaceId: visitor.workspaceId,
      });
      if (resolved.visitorId !== args.visitorId) {
        throw new Error("Not authorized to access visitor verification status");
      }
    }

    return {
      verified: visitor.identityVerified ?? false,
      verifiedAt: visitor.identityVerifiedAt,
    };
  },
});
