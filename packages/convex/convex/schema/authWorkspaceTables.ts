import { defineTable } from "convex/server";
import { v } from "convex/values";

export const authWorkspaceTables = {
  users: defineTable({
    // Standard Convex Auth fields
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Our custom fields for workspace integration
    avatarUrl: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
    role: v.optional(v.union(v.literal("admin"), v.literal("agent"))),
    createdAt: v.optional(v.number()),
    // Compatibility field for older records; new code should not write this value.
    passwordHash: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_workspace", ["workspaceId"]),

  workspaces: defineTable({
    name: v.string(),
    createdAt: v.number(),
    allowedOrigins: v.optional(v.array(v.string())),
    helpCenterAccessPolicy: v.optional(v.union(v.literal("public"), v.literal("restricted"))),
    signupMode: v.optional(v.union(v.literal("invite-only"), v.literal("domain-allowlist"))),
    allowedDomains: v.optional(v.array(v.string())),
    authMethods: v.optional(v.array(v.union(v.literal("password"), v.literal("otp")))),
    hostedOnboardingStatus: v.optional(
      v.union(v.literal("not_started"), v.literal("in_progress"), v.literal("completed"))
    ),
    hostedOnboardingCurrentStep: v.optional(v.number()),
    hostedOnboardingCompletedSteps: v.optional(v.array(v.string())),
    hostedOnboardingVerificationToken: v.optional(v.string()),
    hostedOnboardingVerificationTokenIssuedAt: v.optional(v.number()),
    hostedOnboardingWidgetVerifiedAt: v.optional(v.number()),
    hostedOnboardingVerificationEvents: v.optional(
      v.array(
        v.object({
          token: v.string(),
          origin: v.optional(v.string()),
          currentUrl: v.optional(v.string()),
          createdAt: v.number(),
        })
      )
    ),
    hostedOnboardingUpdatedAt: v.optional(v.number()),
    // Identity Verification (HMAC) fields
    identitySecret: v.optional(v.string()),
    identityVerificationEnabled: v.optional(v.boolean()),
    identityVerificationMode: v.optional(v.union(v.literal("optional"), v.literal("required"))),
    // Signed widget sessions (always on — sessionLifetimeMs configures per-workspace lifetime)
    sessionLifetimeMs: v.optional(v.number()),
  })
    .index("by_name", ["name"])
    .index("by_created_at", ["createdAt"]),

  workspaceMembers: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("agent"), v.literal("viewer")),
    permissions: v.optional(v.array(v.string())),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_user_workspace", ["userId", "workspaceId"]),

  workspaceInvitations: defineTable({
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("agent"), v.literal("viewer")),
    invitedBy: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined")),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_email", ["email"])
    .index("by_email_workspace", ["email", "workspaceId"]),

  // OTP codes for password reset (kept for backward compatibility)
  otpCodes: defineTable({
    email: v.string(),
    code: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    used: v.boolean(),
  })
    .index("by_code", ["code"])
    .index("by_email", ["email"]),
};
