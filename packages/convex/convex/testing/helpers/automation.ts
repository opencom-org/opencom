import { internalMutation } from "../../_generated/server";
import { v } from "convex/values";

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const enableAutomationApi = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workspaceId, { automationApiEnabled: true });
    return { success: true };
  },
});

const createTestAutomationCredential = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    createdBy: v.id("users"),
    name: v.optional(v.string()),
    scopes: v.optional(v.array(v.string())),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const secret = `osk_test_${Math.random().toString(36).slice(2)}`;
    const secretHash = await sha256Hex(secret);
    const secretPrefix = secret.slice(0, 12);
    const now = Date.now();

    const credentialId = await ctx.db.insert("automationCredentials", {
      workspaceId: args.workspaceId,
      name: args.name ?? "Test Credential",
      secretHash,
      secretPrefix,
      scopes: args.scopes ?? [
        "conversations.read",
        "conversations.write",
        "messages.read",
        "messages.write",
        "visitors.read",
        "visitors.write",
        "tickets.read",
        "tickets.write",
        "events.read",
        "events.write",
        "webhooks.manage",
        "claims.manage",
      ],
      status: "active",
      actorName: args.actorName ?? "Test Bot",
      createdBy: args.createdBy,
      createdAt: now,
    });

    return { credentialId, secret };
  },
});

export const automationTestHelpers = {
  enableAutomationApi,
  createTestAutomationCredential,
};
