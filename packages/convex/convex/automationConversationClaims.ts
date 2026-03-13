import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

const CLAIM_LEASE_MS = 5 * 60 * 1000; // 5 minutes

export const claimConversation = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    credentialId: v.id("automationCredentials"),
  },
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.workspaceId !== args.workspaceId) {
      throw new Error("Conversation not found");
    }

    if (conv.status !== "open") {
      throw new Error("Can only claim open conversations");
    }

    // Check for existing active claim
    const existingClaim = await ctx.db
      .query("automationConversationClaims")
      .withIndex("by_conversation_status", (q) =>
        q.eq("conversationId", args.conversationId).eq("status", "active")
      )
      .first();

    if (existingClaim) {
      if (existingClaim.expiresAt > Date.now()) {
        if (existingClaim.credentialId === args.credentialId) {
          // Same credential — renew the lease
          await ctx.db.patch(existingClaim._id, {
            expiresAt: Date.now() + CLAIM_LEASE_MS,
          });
          return { claimId: existingClaim._id, renewed: true };
        }
        throw new Error("Conversation is already claimed by another automation");
      }
      // Expired — mark it
      await ctx.db.patch(existingClaim._id, { status: "expired" });
    }

    const now = Date.now();
    const claimId = await ctx.db.insert("automationConversationClaims", {
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      credentialId: args.credentialId,
      status: "active",
      expiresAt: now + CLAIM_LEASE_MS,
      createdAt: now,
    });

    return { claimId, renewed: false };
  },
});

export const releaseConversation = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    credentialId: v.id("automationCredentials"),
  },
  handler: async (ctx, args) => {
    const claim = await ctx.db
      .query("automationConversationClaims")
      .withIndex("by_conversation_status", (q) =>
        q.eq("conversationId", args.conversationId).eq("status", "active")
      )
      .first();

    if (!claim) {
      throw new Error("No active claim found");
    }

    if (claim.credentialId !== args.credentialId) {
      throw new Error("Claim belongs to a different credential");
    }

    await ctx.db.patch(claim._id, {
      status: "released",
      releasedAt: Date.now(),
    });

    return { success: true };
  },
});

export const escalateConversation = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    credentialId: v.id("automationCredentials"),
  },
  handler: async (ctx, args) => {
    const claim = await ctx.db
      .query("automationConversationClaims")
      .withIndex("by_conversation_status", (q) =>
        q.eq("conversationId", args.conversationId).eq("status", "active")
      )
      .first();

    if (!claim) {
      throw new Error("No active claim found");
    }

    if (claim.credentialId !== args.credentialId) {
      throw new Error("Claim belongs to a different credential");
    }

    await ctx.db.patch(claim._id, {
      status: "escalated",
      releasedAt: Date.now(),
    });

    // Mark conversation for human handling
    const conv = await ctx.db.get(args.conversationId);
    if (conv) {
      await ctx.db.patch(args.conversationId, {
        aiWorkflowState: "handoff",
        aiHandoffReason: "Escalated by automation",
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

export const renewLease = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    credentialId: v.id("automationCredentials"),
  },
  handler: async (ctx, args) => {
    const claim = await ctx.db
      .query("automationConversationClaims")
      .withIndex("by_conversation_status", (q) =>
        q.eq("conversationId", args.conversationId).eq("status", "active")
      )
      .first();

    if (!claim) {
      throw new Error("No active claim found");
    }

    if (claim.credentialId !== args.credentialId) {
      throw new Error("Claim belongs to a different credential");
    }

    if (claim.expiresAt < Date.now()) {
      throw new Error("Claim has already expired");
    }

    await ctx.db.patch(claim._id, {
      expiresAt: Date.now() + CLAIM_LEASE_MS,
    });

    return { success: true, expiresAt: Date.now() + CLAIM_LEASE_MS };
  },
});

export const getActiveClaim = internalQuery({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const claim = await ctx.db
      .query("automationConversationClaims")
      .withIndex("by_conversation_status", (q) =>
        q.eq("conversationId", args.conversationId).eq("status", "active")
      )
      .first();

    if (!claim || claim.expiresAt < Date.now()) {
      return null;
    }

    return {
      claimId: claim._id,
      credentialId: claim.credentialId,
      expiresAt: claim.expiresAt,
    };
  },
});

// Scheduled function to expire stale claims
export const expireStaleClaims = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;
    const now = Date.now();

    const staleClaims = await ctx.db
      .query("automationConversationClaims")
      .withIndex("by_expires", (q) => q.eq("status", "active").lt("expiresAt", now))
      .take(batchSize);

    for (const claim of staleClaims) {
      await ctx.db.patch(claim._id, { status: "expired" });
    }

    return { expired: staleClaims.length };
  },
});
