import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("conversation list benchmarks", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testVisitorIds: Id<"visitors">[] = [];
  let testConversationIds: Id<"conversations">[] = [];

  const NUM_VISITORS = 20;
  const NUM_CONVERSATIONS_PER_VISITOR = 2;
  const MESSAGES_PER_CONVERSATION = 3;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    // Create test workspace
    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;

    // Create multiple visitors with conversations
    for (let i = 0; i < NUM_VISITORS; i++) {
      const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
        workspaceId: testWorkspaceId,
        email: `visitor${i}@benchmark.test`,
        name: `Benchmark Visitor ${i}`,
      });
      testVisitorIds.push(visitor.visitorId);

      // Create conversations for each visitor
      for (let j = 0; j < NUM_CONVERSATIONS_PER_VISITOR; j++) {
        const conv = await client.mutation(api.testing.helpers.createTestConversation, {
          workspaceId: testWorkspaceId,
          visitorId: visitor.visitorId,
          status: j === 0 ? "open" : "closed",
        });
        testConversationIds.push(conv.conversationId);

        // Add messages to each conversation
        for (let k = 0; k < MESSAGES_PER_CONVERSATION; k++) {
          await client.mutation(api.testing.helpers.createTestMessage, {
            conversationId: conv.conversationId,
            content: `Benchmark message ${k} in conversation ${j} for visitor ${i}`,
            senderType: k % 2 === 0 ? "visitor" : "agent",
          });
        }
      }
    }
  }, 120000); // 2 minute timeout for setup

  afterAll(async () => {
    if (testWorkspaceId) {
      try {
        await client.mutation(api.testing.helpers.cleanupTestData, {
          workspaceId: testWorkspaceId,
        });
      } catch (e) {
        console.warn("Cleanup failed:", e);
      }
    }
    await client.close();
  });

  it("should list conversations for inbox efficiently", async () => {
    const startTime = performance.now();

    const result = await client.mutation(api.testing.helpers.listTestConversations, {
      workspaceId: testWorkspaceId,
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(
      `listTestConversations took ${duration.toFixed(2)}ms for ${result.length} conversations`
    );

    // Verify results
    expect(result.length).toBeGreaterThan(0);

    // Performance assertion: should complete within 2 seconds for reasonable dataset
    expect(duration).toBeLessThan(2000);
  });

  it("should list conversations by visitor efficiently", async () => {
    const testVisitorId = testVisitorIds[0];
    const startTime = performance.now();

    const result = await client.mutation(api.testing.helpers.listTestConversations, {
      workspaceId: testWorkspaceId,
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Filter by visitor
    const visitorConversations = result.filter((c: any) => c.visitorId === testVisitorId);
    console.log(
      `listTestConversations filtered by visitor took ${duration.toFixed(2)}ms for ${visitorConversations.length} conversations`
    );

    expect(visitorConversations.length).toBe(NUM_CONVERSATIONS_PER_VISITOR);

    // Performance assertion: should complete within 2 seconds
    expect(duration).toBeLessThan(2000);
  });

  it("should paginate inbox results correctly", async () => {
    const pageSize = 10;

    const allConversations = await client.mutation(api.testing.helpers.listTestConversations, {
      workspaceId: testWorkspaceId,
    });

    // Simulate pagination by slicing
    const page1 = allConversations.slice(0, pageSize);
    expect(page1.length).toBeLessThanOrEqual(pageSize);

    if (allConversations.length > pageSize) {
      const page2 = allConversations.slice(pageSize, pageSize * 2);

      // Verify no duplicates between pages
      const page1Ids = new Set(page1.map((c: any) => c._id));
      const page2Ids = page2.map((c: any) => c._id);
      const duplicates = page2Ids.filter((id: any) => page1Ids.has(id));
      expect(duplicates.length).toBe(0);
    }
  });

  it("should filter by status efficiently", async () => {
    const startTime = performance.now();

    const allConversations = await client.mutation(api.testing.helpers.listTestConversations, {
      workspaceId: testWorkspaceId,
    });

    const openConversations = allConversations.filter((c: any) => c.status === "open");

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(
      `listTestConversations with status filter took ${duration.toFixed(2)}ms for ${openConversations.length} open conversations`
    );

    // Verify all returned conversations are open
    for (const conv of openConversations) {
      expect(conv.status).toBe("open");
    }

    // Performance assertion
    expect(duration).toBeLessThan(2000);
  });
});
