import { beforeEach, describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");

async function seedFixture(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now();

    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Push Campaign Test Workspace",
      createdAt: now,
    });

    const userId = await ctx.db.insert("users", {
      email: "agent@test.opencom.dev",
      name: "Agent",
      workspaceId,
      role: "admin",
      createdAt: now,
    });

    await ctx.db.insert("workspaceMembers", {
      userId,
      workspaceId,
      role: "admin",
      createdAt: now,
    });

    const visitorProId = await ctx.db.insert("visitors", {
      sessionId: "session-pro",
      workspaceId,
      email: "pro@example.com",
      customAttributes: { plan: "pro" },
      createdAt: now,
    });
    const visitorFreeId = await ctx.db.insert("visitors", {
      sessionId: "session-free",
      workspaceId,
      email: "free@example.com",
      customAttributes: { plan: "free" },
      createdAt: now,
    });

    const visitorProSessionToken = "wst_pro_fixture_token";
    const visitorFreeSessionToken = "wst_free_fixture_token";
    await ctx.db.insert("widgetSessions", {
      token: visitorProSessionToken,
      visitorId: visitorProId,
      workspaceId,
      identityVerified: false,
      expiresAt: now + 60 * 60 * 1000,
      createdAt: now,
    });
    await ctx.db.insert("widgetSessions", {
      token: visitorFreeSessionToken,
      visitorId: visitorFreeId,
      workspaceId,
      identityVerified: false,
      expiresAt: now + 60 * 60 * 1000,
      createdAt: now,
    });

    return {
      workspaceId,
      userId,
      visitorProId,
      visitorFreeId,
      visitorProSessionToken,
      visitorFreeSessionToken,
    };
  });
}

describe("push campaign visitor delivery readiness", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("handles visitor push token register/update/unregister lifecycle", async () => {
    const fixture = await seedFixture(t);
    const token = "ExponentPushToken[lifecycle-token]";

    const created = await t.mutation(api.visitorPushTokens.register, {
      visitorId: fixture.visitorProId,
      token,
      platform: "ios",
      sessionToken: fixture.visitorProSessionToken,
      workspaceId: fixture.workspaceId,
    });
    expect(created.status).toBe("created");

    const updated = await t.mutation(api.visitorPushTokens.register, {
      visitorId: fixture.visitorProId,
      token,
      platform: "android",
      sessionToken: fixture.visitorProSessionToken,
      workspaceId: fixture.workspaceId,
    });
    expect(updated.status).toBe("updated");

    const visitorTokens = await t.query(api.visitorPushTokens.getByVisitor, {
      visitorId: fixture.visitorProId,
      sessionToken: fixture.visitorProSessionToken,
      workspaceId: fixture.workspaceId,
    });
    expect(visitorTokens.map((entry) => entry.token)).toContain(token);

    const removed = await t.mutation(api.visitorPushTokens.unregister, {
      token,
      visitorId: fixture.visitorProId,
      sessionToken: fixture.visitorProSessionToken,
      workspaceId: fixture.workspaceId,
    });
    expect(removed.status).toBe("removed");

    const afterRemoval = await t.query(api.visitorPushTokens.getByVisitor, {
      visitorId: fixture.visitorProId,
      sessionToken: fixture.visitorProSessionToken,
      workspaceId: fixture.workspaceId,
    });
    expect(afterRemoval.map((entry) => entry.token)).not.toContain(token);
  });

  it("routes push campaign recipients to targeted visitor tokens and excludes agent tokens", async () => {
    const fixture = await seedFixture(t);

    const visitorProToken = "ExponentPushToken[visitor-pro]";
    const visitorFreeToken = "ExponentPushToken[visitor-free]";
    const agentToken = "ExponentPushToken[agent-token]";

    await t.mutation(api.visitorPushTokens.register, {
      visitorId: fixture.visitorProId,
      token: visitorProToken,
      platform: "ios",
      sessionToken: fixture.visitorProSessionToken,
      workspaceId: fixture.workspaceId,
    });
    await t.mutation(api.visitorPushTokens.register, {
      visitorId: fixture.visitorFreeId,
      token: visitorFreeToken,
      platform: "ios",
      sessionToken: fixture.visitorFreeSessionToken,
      workspaceId: fixture.workspaceId,
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("pushTokens", {
        userId: fixture.userId,
        token: agentToken,
        platform: "ios",
        notificationsEnabled: true,
        createdAt: Date.now(),
      });
    });

    const campaignId = await t.run(async (ctx) => {
      return await ctx.db.insert("pushCampaigns", {
        workspaceId: fixture.workspaceId,
        name: "Visitor Push Campaign",
        title: "Hello",
        body: "Visitor-targeted push",
        targeting: {
          type: "group",
          operator: "and",
          conditions: [
            {
              type: "condition",
              property: { source: "custom", key: "plan" },
              operator: "equals",
              value: "pro",
            },
          ],
        },
        status: "draft",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const sendResult = await t.mutation(internal.pushCampaigns.sendForTesting, {
      id: campaignId,
    });
    expect(sendResult.recipientCount).toBe(1);

    const pendingRecipients = await t.query(internal.pushCampaigns.getPendingRecipients, {
      campaignId,
    });

    expect(pendingRecipients).toHaveLength(1);
    expect(pendingRecipients[0].recipientType).toBe("visitor");
    expect(pendingRecipients[0].visitorId).toBe(fixture.visitorProId);
    expect(pendingRecipients.map((recipient) => recipient.token)).toContain(visitorProToken);
    expect(pendingRecipients.map((recipient) => recipient.token)).not.toContain(visitorFreeToken);
    expect(pendingRecipients.map((recipient) => recipient.token)).not.toContain(agentToken);
  });
});
