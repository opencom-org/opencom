import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthenticatedUserFromSession } from "./auth";
import { authMutation } from "./lib/authWrappers";
import { getWorkspaceMembership } from "./permissions";
import { matchesAllowedOrigin } from "./originValidation";
import { logAudit } from "./auditLogs";
import {
  completeHostedOnboardingWidgetStepMutationHandler,
  issueHostedOnboardingVerificationTokenMutationHandler,
  recordHostedOnboardingVerificationEventMutationHandler,
  startHostedOnboardingMutationHandler,
} from "./workspaceHostedOnboardingMutations";
import {
  getHostedOnboardingIntegrationSignalsQueryHandler,
  getHostedOnboardingStateQueryHandler,
} from "./workspaceHostedOnboardingQueries";

type HelpCenterAccessPolicy = "public" | "restricted";

export const get = query({
  args: {
    id: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.id);
    if (!workspace) return null;

    // Check if caller is an authenticated workspace member
    const user = await getAuthenticatedUserFromSession(ctx);
    if (user) {
      const membership = await getWorkspaceMembership(ctx, user._id, args.id);
      if (membership) {
        // Redact secrets for non-owner/admin members
        const role = membership.role as string;
        if (role !== "owner" && role !== "admin") {
          const { identitySecret, ...safe } = workspace;
          return safe;
        }
        return workspace;
      }
    }

    // Return only non-sensitive fields for unauthenticated or non-member callers
    return {
      _id: workspace._id,
      _creationTime: workspace._creationTime,
      name: workspace.name,
      createdAt: workspace.createdAt,
    };
  },
});

export const getPublicWorkspaceContext = query({
  args: {},
  handler: async (ctx) => {
    const workspaceRows = await ctx.db
      .query("workspaces")
      .withIndex("by_created_at")
      .order("asc")
      .take(1);
    const workspace = workspaceRows[0] ?? null;
    if (!workspace) {
      return null;
    }

    return {
      _id: workspace._id,
      name: workspace.name,
      helpCenterAccessPolicy:
        (workspace.helpCenterAccessPolicy as HelpCenterAccessPolicy | undefined) ?? "public",
    };
  },
});

export const getByName = query({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return null;
    }

    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (!workspace) return null;

    // Verify caller is a member of this workspace
    const membership = await getWorkspaceMembership(ctx, user._id, workspace._id);
    if (!membership) {
      return null;
    }

    return workspace;
  },
});

export const create = authMutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const found = await ctx.db
      .query("workspaces")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (found) {
      return found._id;
    }

    const workspaceId = await ctx.db.insert("workspaces", {
      name: args.name,
      createdAt: Date.now(),
      helpCenterAccessPolicy: "public",
    });

    // Add the creating user as owner
    await ctx.db.insert("workspaceMembers", {
      userId: ctx.user._id,
      workspaceId,
      role: "owner",
      createdAt: Date.now(),
    });

    await logAudit(ctx, {
      workspaceId,
      actorId: ctx.user._id,
      actorType: "user",
      action: "workspace.settings.changed",
      resourceType: "workspace",
      resourceId: workspaceId,
      metadata: {
        operation: "create_workspace",
        name: args.name,
      },
    });

    return workspaceId;
  },
});

export const getOrCreateDefault = authMutation({
  args: {},
  handler: async (ctx) => {
    // Return user's own workspace if they have one
    if (ctx.user.workspaceId) {
      const workspace = await ctx.db.get(ctx.user.workspaceId);
      if (workspace) return workspace;
    }

    const id = await ctx.db.insert("workspaces", {
      name: "Default Workspace",
      createdAt: Date.now(),
      helpCenterAccessPolicy: "public",
    });

    // Add user as owner
    await ctx.db.insert("workspaceMembers", {
      userId: ctx.user._id,
      workspaceId: id,
      role: "owner",
      createdAt: Date.now(),
    });

    await logAudit(ctx, {
      workspaceId: id,
      actorId: ctx.user._id,
      actorType: "user",
      action: "workspace.settings.changed",
      resourceType: "workspace",
      resourceId: id,
      metadata: {
        operation: "create_default_workspace",
      },
    });

    return await ctx.db.get(id);
  },
});

export const getHostedOnboardingState = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: getHostedOnboardingStateQueryHandler,
});

export const getHostedOnboardingIntegrationSignals = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: getHostedOnboardingIntegrationSignalsQueryHandler,
});

export const startHostedOnboarding = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  permission: "conversations.read",
  handler: startHostedOnboardingMutationHandler,
});

export const issueHostedOnboardingVerificationToken = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  permission: "conversations.read",
  handler: issueHostedOnboardingVerificationTokenMutationHandler,
});

export const recordHostedOnboardingVerificationEvent = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    token: v.string(),
    origin: v.optional(v.string()),
    currentUrl: v.optional(v.string()),
  },
  handler: recordHostedOnboardingVerificationEventMutationHandler,
});

export const completeHostedOnboardingWidgetStep = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    token: v.optional(v.string()),
  },
  permission: "conversations.read",
  handler: completeHostedOnboardingWidgetStepMutationHandler,
});

export const updateAllowedOrigins = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    allowedOrigins: v.array(v.string()),
  },
  permission: "settings.security",
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workspaceId, {
      allowedOrigins: args.allowedOrigins,
    });

    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorId: ctx.user._id,
      actorType: "user",
      action: "workspace.security.changed",
      resourceType: "workspace",
      resourceId: args.workspaceId,
      metadata: {
        setting: "allowedOrigins",
        valueCount: args.allowedOrigins.length,
      },
    });
  },
});

export const updateSignupSettings = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    signupMode: v.union(v.literal("invite-only"), v.literal("domain-allowlist")),
    allowedDomains: v.optional(v.array(v.string())),
    authMethods: v.optional(v.array(v.union(v.literal("password"), v.literal("otp")))),
  },
  permission: "settings.security",
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const updateData: {
      signupMode: "invite-only" | "domain-allowlist";
      allowedDomains?: string[];
      authMethods?: ("password" | "otp")[];
    } = {
      signupMode: args.signupMode,
    };

    if (args.signupMode === "domain-allowlist") {
      updateData.allowedDomains = args.allowedDomains ?? [];
    } else {
      updateData.allowedDomains = [];
    }

    if (args.authMethods) {
      updateData.authMethods = args.authMethods;
    }

    await ctx.db.patch(args.workspaceId, updateData);

    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorId: ctx.user._id,
      actorType: "user",
      action: "workspace.security.changed",
      resourceType: "workspace",
      resourceId: args.workspaceId,
      metadata: {
        setting: "signup",
        signupMode: args.signupMode,
        allowedDomainsCount: updateData.allowedDomains?.length ?? 0,
        authMethods: (updateData.authMethods ?? workspace.authMethods ?? []).join(","),
      },
    });
  },
});

export const updateHelpCenterAccessPolicy = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    policy: v.union(v.literal("public"), v.literal("restricted")),
  },
  permission: "settings.workspace",
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workspaceId, {
      helpCenterAccessPolicy: args.policy,
    });

    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorId: ctx.user._id,
      actorType: "user",
      action: "workspace.settings.changed",
      resourceType: "workspace",
      resourceId: args.workspaceId,
      metadata: {
        setting: "helpCenterAccessPolicy",
        value: args.policy,
      },
    });
  },
});

export const validateOrigin = query({
  args: {
    workspaceId: v.id("workspaces"),
    origin: v.string(),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      return { valid: false, reason: "Workspace not found" };
    }

    // If no origins configured, allow all (for development/initial setup)
    if (!workspace.allowedOrigins || workspace.allowedOrigins.length === 0) {
      return { valid: true, reason: "No origin restrictions configured" };
    }

    // Check if origin matches any allowed pattern
    if (!/^https?:\/\//.test(args.origin)) {
      return {
        valid: false,
        reason: "Origin must be a valid http(s) origin",
      };
    }

    const isAllowed = workspace.allowedOrigins.some((allowed) =>
      matchesAllowedOrigin(args.origin, allowed)
    );

    return {
      valid: isAllowed,
      reason: isAllowed ? "Origin allowed" : "Origin not in allowed list",
    };
  },
});
