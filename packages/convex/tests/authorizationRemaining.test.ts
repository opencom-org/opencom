import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import {
  cleanupTestData,
  createTestConversation,
  createTestSessionToken,
  createTestVisitor,
  createTestWorkspace,
} from "./helpers/testHelpers";

describe("authorization coverage for remaining hardened modules", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testUserId: Id<"users">;
  let testVisitorId: Id<"visitors">;
  let testConversationId: Id<"conversations">;
  let sessionToken: string;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    const workspace = await createTestWorkspace(client);
    testWorkspaceId = workspace.workspaceId;
    testUserId = workspace.userId;

    const visitor = await createTestVisitor(client, {
      workspaceId: testWorkspaceId,
      email: `auth-remaining-${Date.now()}@test.opencom.dev`,
    });
    testVisitorId = visitor.visitorId;

    const session = await createTestSessionToken(client, {
      visitorId: testVisitorId,
      workspaceId: testWorkspaceId,
    });
    sessionToken = session.sessionToken;

    const conversation = await createTestConversation(client, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
    });
    testConversationId = conversation.conversationId;
  });

  afterAll(async () => {
    if (testWorkspaceId) {
      try {
        await cleanupTestData(client, { workspaceId: testWorkspaceId });
      } catch (e) {
        console.warn("Cleanup failed:", e);
      }
    }
    await client.close();
  });

  it("events admin/reporting paths deny unauthenticated callers", async () => {
    const events = await client.query(api.events.list, {
      visitorId: testVisitorId,
      workspaceId: testWorkspaceId,
    });
    expect(events).toEqual([]);

    const count = await client.query(api.events.count, {
      visitorId: testVisitorId,
      name: "test-event",
      workspaceId: testWorkspaceId,
    });
    expect(count).toBe(0);

    const names = await client.query(api.events.getDistinctNames, {
      workspaceId: testWorkspaceId,
    });
    expect(names).toEqual([]);

    await expect(
      client.mutation(api.events.cleanupOldAutoEvents, {
        workspaceId: testWorkspaceId,
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("push token endpoints require authenticated user context", async () => {
    await expect(
      client.mutation(api.pushTokens.register, {
        token: `expo-token-${Date.now()}`,
        userId: testUserId,
        platform: "ios",
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.mutation(api.pushTokens.unregister, {
        token: "missing-token",
      })
    ).rejects.toThrow("Not authenticated");

    const tokens = await client.query(api.pushTokens.getByUser, {
      userId: testUserId,
    });
    expect(tokens).toEqual([]);
  });

  it("visitor push token APIs require visitor session or integration permission", async () => {
    await expect(
      client.mutation(api.visitorPushTokens.register, {
        visitorId: testVisitorId,
        token: `visitor-token-${Date.now()}`,
        platform: "ios",
      })
    ).rejects.toThrow("Not authorized to manage visitor push tokens");

    const seededToken = `visitor-token-${Date.now()}-seed`;
    await client.mutation(api.visitorPushTokens.register, {
      visitorId: testVisitorId,
      token: seededToken,
      platform: "ios",
      workspaceId: testWorkspaceId,
      sessionToken,
    });

    const visitorTokens = await client.query(api.visitorPushTokens.getByVisitor, {
      visitorId: testVisitorId,
    });
    expect(visitorTokens).toEqual([]);

    await expect(
      client.mutation(api.visitorPushTokens.unregister, {
        token: seededToken,
      })
    ).rejects.toThrow("Not authorized to manage visitor push tokens");

    const workspaceTokens = await client.query(api.visitorPushTokens.getByWorkspace, {
      workspaceId: testWorkspaceId,
    });
    expect(workspaceTokens).toEqual([]);

    const targetingTokens = await client.query(api.visitorPushTokens.listForTargeting, {
      workspaceId: testWorkspaceId,
      visitorIds: [testVisitorId],
    });
    expect(targetingTokens).toEqual([]);

    const tokensWithInfo = await client.query(api.visitorPushTokens.listWithVisitorInfo, {
      workspaceId: testWorkspaceId,
    });
    expect(tokensWithInfo).toEqual([]);

    const stats = await client.query(api.visitorPushTokens.getStats, {
      workspaceId: testWorkspaceId,
    });
    expect(stats).toEqual({ total: 0, ios: 0, android: 0, uniqueVisitors: 0 });
  });

  it("email channel admin and agent endpoints enforce auth", async () => {
    const config = await client.query(api.emailChannel.getEmailConfig, {
      workspaceId: testWorkspaceId,
    });
    expect(config).toBeNull();

    await expect(
      client.mutation(api.emailChannel.upsertEmailConfig, {
        workspaceId: testWorkspaceId,
        enabled: true,
      })
    ).rejects.toThrow("Not authenticated");

    const threads = await client.query(api.emailChannel.listEmailThreads, {
      conversationId: testConversationId,
    });
    expect(threads).toEqual([]);

    await expect(
      client.mutation(api.emailChannel.sendEmailReply, {
        conversationId: testConversationId,
        agentId: testUserId,
        to: ["visitor@example.com"],
        subject: "Auth check",
        htmlBody: "<p>Hello</p>",
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("tags and assignment rules management endpoints enforce auth", async () => {
    const tags = await client.query(api.tags.list, {
      workspaceId: testWorkspaceId,
    });
    expect(tags).toEqual([]);

    await expect(
      client.mutation(api.tags.create, {
        workspaceId: testWorkspaceId,
        name: "NoAuthTag",
      })
    ).rejects.toThrow("Not authenticated");

    const rules = await client.query(api.assignmentRules.list, {
      workspaceId: testWorkspaceId,
    });
    expect(rules).toEqual([]);

    const evaluated = await client.query(api.assignmentRules.evaluateRules, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
      conversationId: testConversationId,
    });
    expect(evaluated).toBeNull();

    await expect(
      client.mutation(api.assignmentRules.create, {
        workspaceId: testWorkspaceId,
        name: "NoAuthRule",
        priority: 0,
        enabled: true,
        conditions: [],
        action: {
          type: "assign_team",
          teamId: "support",
        },
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("checklists and messenger settings admin paths enforce auth", async () => {
    const checklists = await client.query(api.checklists.list, {
      workspaceId: testWorkspaceId,
    });
    expect(checklists).toEqual([]);

    await expect(
      client.mutation(api.checklists.create, {
        workspaceId: testWorkspaceId,
        name: "NoAuthChecklist",
        tasks: [
          {
            id: "task-1",
            title: "Task 1",
            completionType: "manual",
          },
        ],
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.query(api.checklists.getEligible, {
        workspaceId: testWorkspaceId,
        visitorId: testVisitorId,
      })
    ).rejects.toThrow("Session token required");

    const settings = await client.query(api.messengerSettings.get, {
      workspaceId: testWorkspaceId,
    });
    expect(settings).toBeNull();

    const getOrCreate = await client.query(api.messengerSettings.getOrCreate, {
      workspaceId: testWorkspaceId,
    });
    expect(getOrCreate).toBeNull();

    const homeConfig = await client.query(api.messengerSettings.getHomeConfig, {
      workspaceId: testWorkspaceId,
    });
    expect(homeConfig.enabled).toBe(true);

    await expect(
      client.mutation(api.messengerSettings.upsert, {
        workspaceId: testWorkspaceId,
        welcomeMessage: "Hello",
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.mutation(api.messengerSettings.generateLogoUploadUrl, {
        workspaceId: testWorkspaceId,
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("common issue buttons and ticket forms admin paths enforce auth", async () => {
    const buttons = await client.query(api.commonIssueButtons.listAll, {
      workspaceId: testWorkspaceId,
    });
    expect(buttons).toEqual([]);

    await expect(
      client.mutation(api.commonIssueButtons.create, {
        workspaceId: testWorkspaceId,
        label: "Help",
        action: "start_conversation",
        conversationStarter: "How can we help?",
        enabled: true,
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.mutation(api.commonIssueButtons.reorder, {
        workspaceId: testWorkspaceId,
        buttonIds: [],
      })
    ).rejects.toThrow("Not authenticated");

    const forms = await client.query(api.ticketForms.list, {
      workspaceId: testWorkspaceId,
    });
    expect(forms).toEqual([]);

    const defaultForm = await client.query(api.ticketForms.getDefault, {
      workspaceId: testWorkspaceId,
    });
    expect(defaultForm).toBeNull();

    await expect(
      client.mutation(api.ticketForms.create, {
        workspaceId: testWorkspaceId,
        name: "NoAuthForm",
        fields: [
          {
            id: "subject",
            type: "text",
            label: "Subject",
            required: true,
          },
        ],
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("snippets and segments management endpoints enforce auth", async () => {
    await expect(
      client.query(api.snippets.list, {
        workspaceId: testWorkspaceId,
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.query(api.snippets.search, {
        workspaceId: testWorkspaceId,
        query: "hello",
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.mutation(api.snippets.create, {
        workspaceId: testWorkspaceId,
        name: "NoAuthSnippet",
        content: "Hello",
      })
    ).rejects.toThrow("Not authenticated");

    const segments = await client.query(api.segments.list, {
      workspaceId: testWorkspaceId,
    });
    expect(segments).toEqual([]);

    const preview = await client.query(api.segments.preview, {
      workspaceId: testWorkspaceId,
      audienceRules: {
        type: "group",
        operator: "and",
        conditions: [],
      },
    });
    expect(preview).toBe(0);

    await expect(
      client.mutation(api.segments.create, {
        workspaceId: testWorkspaceId,
        name: "NoAuthSegment",
        audienceRules: {
          type: "group",
          operator: "and",
          conditions: [],
        },
      })
    ).rejects.toThrow("Not authenticated");
  });
});
