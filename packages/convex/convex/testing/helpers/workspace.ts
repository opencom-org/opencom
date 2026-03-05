import { internalMutation } from "../../_generated/server";
import { v } from "convex/values";

const createTestWorkspace = internalMutation({
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
const updateTestHelpCenterAccessPolicy = internalMutation({
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
const createTestAuditLog = internalMutation({
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
const createTestUser = internalMutation({
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
const createTestSessionToken = internalMutation({
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
const createTestInvitation = internalMutation({
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
const updateWorkspaceSettings = internalMutation({
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
const upsertTestAutomationSettings = internalMutation({
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
const getTestWorkspaceFull = internalMutation({
  args: { id: v.id("workspaces") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Updates workspace allowed origins directly (bypasses auth).
 */
const updateTestAllowedOrigins = internalMutation({
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
const updateTestSignupSettings = internalMutation({
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
const addTestWorkspaceMember = internalMutation({
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
const listTestWorkspaceMembers = internalMutation({
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
const updateTestMemberPermissions = internalMutation({
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
const updateTestMemberRole = internalMutation({
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
const removeTestMember = internalMutation({
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
const removeTestWorkspaceMember = internalMutation({
  args: { membershipId: v.id("workspaceMembers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.membershipId);
  },
});

/**
 * Cancels a test invitation directly (bypasses auth).
 */
const cancelTestInvitation = internalMutation({
  args: { invitationId: v.id("workspaceInvitations") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.invitationId);
  },
});

/**
 * Accepts a test invitation directly (bypasses auth).
 */
const acceptTestInvitation = internalMutation({
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
const listTestPendingInvitations = internalMutation({
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
const updateWorkspaceOrigins = internalMutation({
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
const lookupUserByEmail = internalMutation({
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
const lookupPendingInvitationsByEmail = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspaceInvitations")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
  },
});

export const workspaceTestHelpers: Record<string, ReturnType<typeof internalMutation>> = {
  createTestWorkspace,
  updateTestHelpCenterAccessPolicy,
  createTestAuditLog,
  createTestUser,
  createTestSessionToken,
  createTestInvitation,
  updateWorkspaceSettings,
  upsertTestAutomationSettings,
  getTestWorkspaceFull,
  updateTestAllowedOrigins,
  updateTestSignupSettings,
  addTestWorkspaceMember,
  listTestWorkspaceMembers,
  updateTestMemberPermissions,
  updateTestMemberRole,
  removeTestMember,
  removeTestWorkspaceMember,
  cancelTestInvitation,
  acceptTestInvitation,
  listTestPendingInvitations,
  updateWorkspaceOrigins,
  lookupUserByEmail,
  lookupPendingInvitationsByEmail,
} as const;
