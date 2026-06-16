import { v } from "convex/values";
import { authMutation, authQuery } from "./lib/authWrappers";
import { logAudit } from "./auditLogs";
import { validateScopes } from "./automationScopes";

function generateSecureSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const length = 48;
  let result = "osk_";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const create = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    scopes: v.array(v.string()),
    actorName: v.string(),
    expiresAt: v.optional(v.number()),
  },
  permission: "settings.integrations",
  handler: async (ctx, args) => {
    const validScopes = validateScopes(args.scopes);
    const secret = generateSecureSecret();
    const secretHash = await sha256Hex(secret);
    const secretPrefix = secret.slice(0, 12); // "osk_" + 8 chars

    const now = Date.now();
    const credentialId = await ctx.db.insert("automationCredentials", {
      workspaceId: args.workspaceId,
      name: args.name,
      secretHash,
      secretPrefix,
      scopes: validScopes,
      status: "active",
      expiresAt: args.expiresAt,
      actorName: args.actorName,
      createdBy: ctx.user._id,
      createdAt: now,
    });

    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorId: ctx.user._id,
      actorType: "user",
      action: "integration.created",
      resourceType: "automationCredential",
      resourceId: credentialId,
      metadata: { name: args.name, actorName: args.actorName },
    });

    return { credentialId, secret };
  },
});

export const list = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  permission: "settings.integrations",
  handler: async (ctx, args) => {
    const credentials = await ctx.db
      .query("automationCredentials")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return credentials.map((c) => ({
      _id: c._id,
      name: c.name,
      secretPrefix: c.secretPrefix,
      scopes: c.scopes,
      status: c.status,
      expiresAt: c.expiresAt,
      actorName: c.actorName,
      lastUsedAt: c.lastUsedAt,
      createdAt: c.createdAt,
    }));
  },
});

export const get = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    credentialId: v.id("automationCredentials"),
  },
  permission: "settings.integrations",
  handler: async (ctx, args) => {
    const credential = await ctx.db.get(args.credentialId);
    if (!credential || credential.workspaceId !== args.workspaceId) {
      return null;
    }

    return {
      _id: credential._id,
      name: credential.name,
      secretPrefix: credential.secretPrefix,
      scopes: credential.scopes,
      status: credential.status,
      expiresAt: credential.expiresAt,
      actorName: credential.actorName,
      lastUsedAt: credential.lastUsedAt,
      createdAt: credential.createdAt,
      createdBy: credential.createdBy,
    };
  },
});

export const rotate = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    credentialId: v.id("automationCredentials"),
  },
  permission: "settings.integrations",
  handler: async (ctx, args) => {
    const credential = await ctx.db.get(args.credentialId);
    if (!credential || credential.workspaceId !== args.workspaceId) {
      throw new Error("Credential not found");
    }

    const secret = generateSecureSecret();
    const secretHash = await sha256Hex(secret);
    const secretPrefix = secret.slice(0, 12);

    await ctx.db.patch(args.credentialId, { secretHash, secretPrefix });

    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorId: ctx.user._id,
      actorType: "user",
      action: "integration.revoked",
      resourceType: "automationCredential",
      resourceId: args.credentialId,
      metadata: { name: credential.name, action: "rotated" },
    });

    return { secret };
  },
});

export const disable = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    credentialId: v.id("automationCredentials"),
  },
  permission: "settings.integrations",
  handler: async (ctx, args) => {
    const credential = await ctx.db.get(args.credentialId);
    if (!credential || credential.workspaceId !== args.workspaceId) {
      throw new Error("Credential not found");
    }

    await ctx.db.patch(args.credentialId, { status: "disabled" });

    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorId: ctx.user._id,
      actorType: "user",
      action: "integration.revoked",
      resourceType: "automationCredential",
      resourceId: args.credentialId,
      metadata: { name: credential.name, action: "disabled" },
    });

    return { success: true };
  },
});

export const enable = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    credentialId: v.id("automationCredentials"),
  },
  permission: "settings.integrations",
  handler: async (ctx, args) => {
    const credential = await ctx.db.get(args.credentialId);
    if (!credential || credential.workspaceId !== args.workspaceId) {
      throw new Error("Credential not found");
    }

    await ctx.db.patch(args.credentialId, { status: "active" });

    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorId: ctx.user._id,
      actorType: "user",
      action: "integration.created",
      resourceType: "automationCredential",
      resourceId: args.credentialId,
      metadata: { name: credential.name, action: "enabled" },
    });

    return { success: true };
  },
});

export const remove = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    credentialId: v.id("automationCredentials"),
  },
  permission: "settings.integrations",
  handler: async (ctx, args) => {
    const credential = await ctx.db.get(args.credentialId);
    if (!credential || credential.workspaceId !== args.workspaceId) {
      throw new Error("Credential not found");
    }

    await ctx.db.delete(args.credentialId);

    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorId: ctx.user._id,
      actorType: "user",
      action: "integration.revoked",
      resourceType: "automationCredential",
      resourceId: args.credentialId,
      metadata: { name: credential.name, action: "removed" },
    });

    return { success: true };
  },
});
