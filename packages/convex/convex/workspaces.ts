import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthenticatedUserFromSession } from "./auth";
import { requirePermission, getWorkspaceMembership } from "./permissions";
import { matchesAllowedOrigin, validateVisitorOrigin } from "./originValidation";
import { logAudit } from "./auditLogs";

const HOSTED_ONBOARDING_WIDGET_STEP = "widget_install";
const HOSTED_ONBOARDING_SIGNAL_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const HOSTED_ONBOARDING_SIGNAL_LIMIT = 200;

type HostedOnboardingStatus = "not_started" | "in_progress" | "completed";
type HelpCenterAccessPolicy = "public" | "restricted";

type HostedOnboardingWorkspaceFields = {
  hostedOnboardingStatus?: HostedOnboardingStatus;
  hostedOnboardingCurrentStep?: number;
  hostedOnboardingCompletedSteps?: string[];
  hostedOnboardingVerificationToken?: string;
  hostedOnboardingVerificationTokenIssuedAt?: number;
  hostedOnboardingWidgetVerifiedAt?: number;
  hostedOnboardingVerificationEvents?: Array<{
    token: string;
    origin?: string;
    currentUrl?: string;
    createdAt: number;
  }>;
  hostedOnboardingUpdatedAt?: number;
};

function getHostedOnboardingView(workspace: HostedOnboardingWorkspaceFields) {
  return getHostedOnboardingViewWithSignals(workspace, null);
}

function getHostedOnboardingViewWithSignals(
  workspace: HostedOnboardingWorkspaceFields,
  latestDetectedAt: number | null
) {
  const completedSteps = workspace.hostedOnboardingCompletedSteps ?? [];
  const hasWidgetStepComplete = completedSteps.includes(HOSTED_ONBOARDING_WIDGET_STEP);
  const status: HostedOnboardingStatus =
    workspace.hostedOnboardingStatus ?? (hasWidgetStepComplete ? "completed" : "not_started");
  const currentStep = workspace.hostedOnboardingCurrentStep ?? (hasWidgetStepComplete ? 1 : 0);
  const storedWidgetVerifiedAt = workspace.hostedOnboardingWidgetVerifiedAt ?? null;
  const widgetVerifiedAt =
    storedWidgetVerifiedAt === null
      ? latestDetectedAt
      : latestDetectedAt === null
        ? storedWidgetVerifiedAt
        : Math.max(storedWidgetVerifiedAt, latestDetectedAt);
  const tokenIssuedAt = workspace.hostedOnboardingVerificationTokenIssuedAt ?? null;
  const isWidgetVerified =
    widgetVerifiedAt !== null && (tokenIssuedAt === null || widgetVerifiedAt >= tokenIssuedAt);

  return {
    status,
    currentStep,
    completedSteps,
    onboardingVerificationToken: workspace.hostedOnboardingVerificationToken ?? null,
    verificationToken: workspace.hostedOnboardingVerificationToken ?? null,
    verificationTokenIssuedAt: tokenIssuedAt,
    widgetVerifiedAt,
    isWidgetVerified,
    updatedAt: workspace.hostedOnboardingUpdatedAt ?? null,
  };
}

type HostedOnboardingIntegrationSignal = {
  id: string;
  clientType: string;
  clientVersion: string | null;
  clientIdentifier: string | null;
  origin: string | null;
  currentUrl: string | null;
  devicePlatform: string | null;
  sessionCount: number;
  activeSessionCount: number;
  lastSeenAt: number;
  latestSessionExpiresAt: number;
  matchesCurrentVerificationWindow: boolean;
  isActiveNow: boolean;
};

type HostedOnboardingSignalsResult = {
  latestDetectedAt: number | null;
  latestRecognizedDetectedAt: number | null;
  hasRecognizedInstall: boolean;
  signals: HostedOnboardingIntegrationSignal[];
};

function normalizeHostedOnboardingSignalValue(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

async function collectHostedOnboardingIntegrationSignals(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  tokenIssuedAt: number | null
): Promise<HostedOnboardingSignalsResult> {
  const now = Date.now();
  const cutoff = now - HOSTED_ONBOARDING_SIGNAL_LOOKBACK_MS;
  const sessions = await ctx.db
    .query("widgetSessions")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .order("desc")
    .take(HOSTED_ONBOARDING_SIGNAL_LIMIT);

  const signalsById = new Map<string, HostedOnboardingIntegrationSignal>();

  for (const session of sessions) {
    if (session.createdAt < cutoff) {
      continue;
    }

    const clientType =
      normalizeHostedOnboardingSignalValue(session.clientType) ??
      (session.devicePlatform === "ios" || session.devicePlatform === "android"
        ? "mobile_sdk"
        : "web_widget");
    const clientVersion = normalizeHostedOnboardingSignalValue(session.clientVersion);
    const clientIdentifier = normalizeHostedOnboardingSignalValue(session.clientIdentifier);
    const origin = normalizeHostedOnboardingSignalValue(session.origin);
    const currentUrl = normalizeHostedOnboardingSignalValue(session.currentUrl);
    const devicePlatform = normalizeHostedOnboardingSignalValue(session.devicePlatform);

    const signalId = [
      clientType,
      clientVersion ?? "unknown",
      clientIdentifier ?? "unknown",
      origin ?? "unknown",
      devicePlatform ?? "unknown",
    ].join("|");

    const existing = signalsById.get(signalId);
    const isActive = session.expiresAt > now;
    const matchesCurrentVerificationWindow =
      tokenIssuedAt === null || session.createdAt >= tokenIssuedAt;

    if (!existing) {
      signalsById.set(signalId, {
        id: signalId,
        clientType,
        clientVersion,
        clientIdentifier,
        origin,
        currentUrl,
        devicePlatform,
        sessionCount: 1,
        activeSessionCount: isActive ? 1 : 0,
        lastSeenAt: session.createdAt,
        latestSessionExpiresAt: session.expiresAt,
        matchesCurrentVerificationWindow,
        isActiveNow: isActive,
      });
      continue;
    }

    existing.sessionCount += 1;
    if (isActive) {
      existing.activeSessionCount += 1;
    }
    if (session.createdAt > existing.lastSeenAt) {
      existing.lastSeenAt = session.createdAt;
      existing.currentUrl = currentUrl;
    }
    if (session.expiresAt > existing.latestSessionExpiresAt) {
      existing.latestSessionExpiresAt = session.expiresAt;
    }
    existing.matchesCurrentVerificationWindow =
      existing.matchesCurrentVerificationWindow || matchesCurrentVerificationWindow;
    existing.isActiveNow = existing.latestSessionExpiresAt > now;
  }

  const signals = Array.from(signalsById.values()).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  const latestDetectedAt = signals.length > 0 ? signals[0].lastSeenAt : null;
  const recognizedSignals = signals.filter(
    (signal) => signal.isActiveNow && signal.matchesCurrentVerificationWindow
  );
  const latestRecognizedDetectedAt =
    recognizedSignals.length > 0 ? recognizedSignals[0].lastSeenAt : null;
  const hasRecognizedInstall = recognizedSignals.length > 0;

  return {
    latestDetectedAt,
    latestRecognizedDetectedAt,
    hasRecognizedInstall,
    signals,
  };
}

function generateHostedOnboardingVerificationToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `onb_${hex}`;
}

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

export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

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
      userId: user._id,
      workspaceId,
      role: "owner",
      createdAt: Date.now(),
    });

    await logAudit(ctx, {
      workspaceId,
      actorId: user._id,
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

export const getOrCreateDefault = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Return user's own workspace if they have one
    if (user.workspaceId) {
      const workspace = await ctx.db.get(user.workspaceId);
      if (workspace) return workspace;
    }

    const id = await ctx.db.insert("workspaces", {
      name: "Default Workspace",
      createdAt: Date.now(),
      helpCenterAccessPolicy: "public",
    });

    // Add user as owner
    await ctx.db.insert("workspaceMembers", {
      userId: user._id,
      workspaceId: id,
      role: "owner",
      createdAt: Date.now(),
    });

    await logAudit(ctx, {
      workspaceId: id,
      actorId: user._id,
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
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return null;
    }

    const membership = await getWorkspaceMembership(ctx, user._id, args.workspaceId);
    if (!membership) {
      return null;
    }

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      return null;
    }

    const tokenIssuedAt = workspace.hostedOnboardingVerificationTokenIssuedAt ?? null;
    const signals = await collectHostedOnboardingIntegrationSignals(
      ctx,
      args.workspaceId,
      tokenIssuedAt
    );

    return {
      ...getHostedOnboardingViewWithSignals(
        workspace as unknown as HostedOnboardingWorkspaceFields,
        signals.latestRecognizedDetectedAt
      ),
      hasRecognizedInstall: signals.hasRecognizedInstall,
      latestDetectedAt: signals.latestDetectedAt,
      latestRecognizedDetectedAt: signals.latestRecognizedDetectedAt,
      detectedIntegrationCount: signals.signals.length,
    };
  },
});

export const getHostedOnboardingIntegrationSignals = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return null;
    }

    const membership = await getWorkspaceMembership(ctx, user._id, args.workspaceId);
    if (!membership) {
      return null;
    }

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      return null;
    }

    const tokenIssuedAt = workspace.hostedOnboardingVerificationTokenIssuedAt ?? null;
    const signals = await collectHostedOnboardingIntegrationSignals(
      ctx,
      args.workspaceId,
      tokenIssuedAt
    );

    return {
      tokenIssuedAt,
      hasRecognizedInstall: signals.hasRecognizedInstall,
      latestDetectedAt: signals.latestDetectedAt,
      latestRecognizedDetectedAt: signals.latestRecognizedDetectedAt,
      integrations: signals.signals,
    };
  },
});

export const startHostedOnboarding = mutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, user._id, args.workspaceId, "conversations.read");

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const onboarding = workspace as unknown as HostedOnboardingWorkspaceFields;
    const now = Date.now();
    const view = getHostedOnboardingView(onboarding);
    if (view.status === "completed") {
      return view;
    }

    const patch: Partial<HostedOnboardingWorkspaceFields> = {
      hostedOnboardingStatus: "in_progress",
      hostedOnboardingCurrentStep: view.currentStep,
      hostedOnboardingCompletedSteps: view.completedSteps,
      hostedOnboardingUpdatedAt: now,
    };

    await ctx.db.patch(args.workspaceId, patch);

    const updatedWorkspace = await ctx.db.get(args.workspaceId);
    return getHostedOnboardingView(updatedWorkspace as unknown as HostedOnboardingWorkspaceFields);
  },
});

export const issueHostedOnboardingVerificationToken = mutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, user._id, args.workspaceId, "conversations.read");

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const onboarding = workspace as unknown as HostedOnboardingWorkspaceFields;
    const view = getHostedOnboardingView(onboarding);
    const now = Date.now();
    const token = generateHostedOnboardingVerificationToken();

    const patch: Partial<HostedOnboardingWorkspaceFields> = {
      hostedOnboardingVerificationToken: token,
      hostedOnboardingVerificationTokenIssuedAt: now,
      hostedOnboardingStatus: view.status === "completed" ? "completed" : "in_progress",
      hostedOnboardingCurrentStep: view.currentStep,
      hostedOnboardingCompletedSteps: view.completedSteps,
      hostedOnboardingUpdatedAt: now,
    };

    await ctx.db.patch(args.workspaceId, patch);

    return {
      token,
      issuedAt: now,
    };
  },
});

export const recordHostedOnboardingVerificationEvent = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    token: v.string(),
    origin: v.optional(v.string()),
    currentUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      return { accepted: false as const, reason: "workspace_not_found" as const };
    }

    const onboarding = workspace as unknown as HostedOnboardingWorkspaceFields;
    if (!onboarding.hostedOnboardingVerificationToken) {
      return { accepted: false as const, reason: "token_not_issued" as const };
    }

    if (onboarding.hostedOnboardingVerificationToken !== args.token) {
      return { accepted: false as const, reason: "token_mismatch" as const };
    }

    const originValidation = await validateVisitorOrigin(ctx, args.workspaceId, args.origin);
    if (!originValidation.valid) {
      return { accepted: false as const, reason: "origin_invalid" as const };
    }

    const now = Date.now();
    const existingEvents = onboarding.hostedOnboardingVerificationEvents ?? [];
    const nextEvents = [
      ...existingEvents,
      {
        token: args.token,
        origin: args.origin,
        currentUrl: args.currentUrl,
        createdAt: now,
      },
    ].slice(-20);

    const patch: Partial<HostedOnboardingWorkspaceFields> = {
      hostedOnboardingVerificationEvents: nextEvents,
      hostedOnboardingWidgetVerifiedAt: now,
      hostedOnboardingUpdatedAt: now,
    };

    await ctx.db.patch(args.workspaceId, patch);

    return {
      accepted: true as const,
      verifiedAt: now,
    };
  },
});

export const completeHostedOnboardingWidgetStep = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, user._id, args.workspaceId, "conversations.read");

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const onboarding = workspace as unknown as HostedOnboardingWorkspaceFields;
    if (
      args.token &&
      onboarding.hostedOnboardingVerificationToken &&
      args.token !== onboarding.hostedOnboardingVerificationToken
    ) {
      return { success: false as const, reason: "token_mismatch" as const };
    }

    const signals = await collectHostedOnboardingIntegrationSignals(
      ctx,
      args.workspaceId,
      onboarding.hostedOnboardingVerificationTokenIssuedAt ?? null
    );
    const view = getHostedOnboardingViewWithSignals(onboarding, signals.latestRecognizedDetectedAt);
    if (!view.isWidgetVerified) {
      return { success: false as const, reason: "not_verified" as const };
    }

    const completedSteps = Array.from(
      new Set([...view.completedSteps, HOSTED_ONBOARDING_WIDGET_STEP])
    );
    const now = Date.now();

    const patch: Partial<HostedOnboardingWorkspaceFields> = {
      hostedOnboardingStatus: "completed",
      hostedOnboardingCurrentStep: 1,
      hostedOnboardingCompletedSteps: completedSteps,
      hostedOnboardingUpdatedAt: now,
    };

    await ctx.db.patch(args.workspaceId, patch);

    return {
      success: true as const,
      status: "completed" as const,
      currentStep: 1,
      completedSteps,
      updatedAt: now,
    };
  },
});

export const updateAllowedOrigins = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    allowedOrigins: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, args.workspaceId, "settings.security");

    await ctx.db.patch(args.workspaceId, {
      allowedOrigins: args.allowedOrigins,
    });

    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorId: user._id,
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

export const updateSignupSettings = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    signupMode: v.union(v.literal("invite-only"), v.literal("domain-allowlist")),
    allowedDomains: v.optional(v.array(v.string())),
    authMethods: v.optional(v.array(v.union(v.literal("password"), v.literal("otp")))),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, args.workspaceId, "settings.security");

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
      actorId: user._id,
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

export const updateHelpCenterAccessPolicy = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    policy: v.union(v.literal("public"), v.literal("restricted")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, args.workspaceId, "settings.workspace");

    await ctx.db.patch(args.workspaceId, {
      helpCenterAccessPolicy: args.policy,
    });

    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorId: user._id,
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
