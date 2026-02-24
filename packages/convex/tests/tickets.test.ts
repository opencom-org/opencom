import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";

describe("tickets", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testVisitorId: Id<"visitors">;
  let testVisitorSessionToken: string;
  let testUserId: Id<"users">;
  let testTicketId: Id<"tickets">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);
    testWorkspaceId = (await authenticateClientForWorkspace(client)).workspaceId;

    const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
      email: "ticket-visitor@test.com",
      name: "Ticket Test Visitor",
    });
    testVisitorId = visitor.visitorId;

    const visitorSession = await client.mutation(api.testing.helpers.createTestSessionToken, {
      visitorId: testVisitorId,
      workspaceId: testWorkspaceId,
    });
    testVisitorSessionToken = visitorSession.sessionToken;

    const user = await client.mutation(api.testing.helpers.createTestUser, {
      workspaceId: testWorkspaceId,
      email: "ticket-agent@test.opencom.dev",
      name: "Ticket Test Agent",
      role: "agent",
    });
    testUserId = user.userId;
  });

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

  it("should create a ticket", async () => {
    const ticketId = await client.mutation(api.tickets.create, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
      sessionToken: testVisitorSessionToken,
      subject: "Test Ticket",
      description: "This is a test ticket description",
      priority: "normal",
    });

    expect(ticketId).toBeDefined();
    testTicketId = ticketId;
  });

  it("should get a ticket by id", async () => {
    const ticket = await client.query(api.tickets.get, {
      id: testTicketId,
    });

    expect(ticket).toBeDefined();
    expect(ticket?._id).toBe(testTicketId);
    expect(ticket?.subject).toBe("Test Ticket");
    expect(ticket?.status).toBe("submitted");
    expect(ticket?.priority).toBe("normal");
  });

  it("should list tickets for workspace", async () => {
    const tickets = await client.query(api.tickets.list, {
      workspaceId: testWorkspaceId,
    });

    expect(tickets).toBeDefined();
    expect(tickets.length).toBeGreaterThan(0);
    expect(tickets.some((t: { _id: string }) => t._id === testTicketId)).toBe(true);
  });

  it("should update ticket status", async () => {
    await client.mutation(api.tickets.update, {
      id: testTicketId,
      status: "in_progress",
    });

    const ticket = await client.query(api.tickets.get, {
      id: testTicketId,
    });

    expect(ticket?.status).toBe("in_progress");
  });

  it("should update ticket priority", async () => {
    await client.mutation(api.tickets.update, {
      id: testTicketId,
      priority: "high",
    });

    const ticket = await client.query(api.tickets.get, {
      id: testTicketId,
    });

    expect(ticket?.priority).toBe("high");
  });

  it("should assign ticket to agent", async () => {
    await client.mutation(api.tickets.update, {
      id: testTicketId,
      assigneeId: testUserId,
    });

    const ticket = await client.query(api.tickets.get, {
      id: testTicketId,
    });

    expect(ticket?.assigneeId).toBe(testUserId);
    expect(ticket?.assignee).toBeDefined();
  });

  it("should add internal comment to ticket", async () => {
    const commentId = await client.mutation(api.tickets.addComment, {
      ticketId: testTicketId,
      authorId: testUserId,
      authorType: "agent",
      content: "This is an internal note",
      isInternal: true,
    });

    expect(commentId).toBeDefined();

    const comments = await client.query(api.tickets.getComments, {
      ticketId: testTicketId,
      includeInternal: true,
    });

    expect(comments.some((c: { _id: string }) => c._id === commentId)).toBe(true);
  });

  it("should add customer-visible comment to ticket", async () => {
    const commentId = await client.mutation(api.tickets.addComment, {
      ticketId: testTicketId,
      authorId: testUserId,
      authorType: "agent",
      content: "This is a customer-visible comment",
      isInternal: false,
    });

    expect(commentId).toBeDefined();

    const publicComments = await client.query(api.tickets.getComments, {
      ticketId: testTicketId,
      includeInternal: false,
    });

    expect(publicComments.some((c: { _id: string }) => c._id === commentId)).toBe(true);
  });

  it("should filter out internal comments when not requested", async () => {
    const publicComments = await client.query(api.tickets.getComments, {
      ticketId: testTicketId,
      includeInternal: false,
    });

    const allComments = await client.query(api.tickets.getComments, {
      ticketId: testTicketId,
      includeInternal: true,
    });

    expect(allComments.length).toBeGreaterThan(publicComments.length);
  });

  it("should list tickets by visitor", async () => {
    const visitorClient = new ConvexClient(process.env.CONVEX_URL!);
    try {
      const tickets = await visitorClient.query(api.tickets.listByVisitor, {
        visitorId: testVisitorId,
        sessionToken: testVisitorSessionToken,
        workspaceId: testWorkspaceId,
      });

      expect(tickets).toBeDefined();
      expect(tickets.length).toBeGreaterThan(0);
      expect(tickets.some((t: { _id: string }) => t._id === testTicketId)).toBe(true);
    } finally {
      await visitorClient.close();
    }
  });

  it("should ignore visitor-forged author metadata", async () => {
    const visitorClient = new ConvexClient(process.env.CONVEX_URL!);
    try {
      const commentId = await visitorClient.mutation(api.tickets.addComment, {
        ticketId: testTicketId,
        visitorId: testVisitorId,
        sessionToken: testVisitorSessionToken,
        content: "Visitor trying to forge metadata",
        authorId: testUserId,
        authorType: "agent",
        isInternal: true,
      });

      const comments = await client.query(api.tickets.getComments, {
        ticketId: testTicketId,
        includeInternal: true,
      });
      const forgedComment = comments.find((comment) => comment._id === commentId);
      expect(forgedComment).toBeDefined();
      expect(forgedComment?.authorType).toBe("visitor");
      expect(forgedComment?.isInternal).toBe(false);
      expect(forgedComment?.authorId).toBe(testVisitorId);
    } finally {
      await visitorClient.close();
    }
  });

  it("should reject mismatched visitor identity on comment", async () => {
    const visitorClient = new ConvexClient(process.env.CONVEX_URL!);
    const otherVisitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
      email: "other-ticket-visitor@test.com",
      name: "Other Ticket Visitor",
    });
    const otherSession = await client.mutation(api.testing.helpers.createTestSessionToken, {
      visitorId: otherVisitor.visitorId,
      workspaceId: testWorkspaceId,
    });

    try {
      await expect(
        visitorClient.mutation(api.tickets.addComment, {
          ticketId: testTicketId,
          visitorId: testVisitorId,
          sessionToken: otherSession.sessionToken,
          content: "Should fail",
        })
      ).rejects.toThrow();
    } finally {
      await visitorClient.close();
    }
  });

  it("should filter tickets by status", async () => {
    const inProgressTickets = await client.query(api.tickets.list, {
      workspaceId: testWorkspaceId,
      status: "in_progress",
    });

    expect(inProgressTickets.every((t: { status: string }) => t.status === "in_progress")).toBe(
      true
    );
  });

  it("should resolve ticket with summary", async () => {
    await client.mutation(api.tickets.resolve, {
      id: testTicketId,
      resolutionSummary: "Issue resolved by updating settings",
    });

    const ticket = await client.query(api.tickets.get, {
      id: testTicketId,
    });

    expect(ticket?.status).toBe("resolved");
    expect(ticket?.resolutionSummary).toBe("Issue resolved by updating settings");
    expect(ticket?.resolvedAt).toBeDefined();
  });

  it("should convert conversation to ticket", async () => {
    const newConversation = await client.mutation(api.testing.helpers.createTestConversation, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
      status: "open",
    });

    const ticketId = await client.mutation(api.tickets.convertFromConversation, {
      conversationId: newConversation.conversationId,
      subject: "Converted from conversation",
      priority: "urgent",
    });

    expect(ticketId).toBeDefined();

    const ticket = await client.query(api.tickets.get, {
      id: ticketId,
    });

    expect(ticket?.conversationId).toBe(newConversation.conversationId);
    expect(ticket?.subject).toBe("Converted from conversation");
    expect(ticket?.priority).toBe("urgent");
  });

  it("should not allow duplicate conversion of same conversation", async () => {
    // First create a ticket from the conversation
    const anotherConversation = await client.mutation(api.testing.helpers.createTestConversation, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
      status: "open",
    });

    await client.mutation(api.tickets.convertFromConversation, {
      conversationId: anotherConversation.conversationId,
      subject: "First conversion",
    });

    // Now try to convert the same conversation again - should fail
    await expect(
      client.mutation(api.tickets.convertFromConversation, {
        conversationId: anotherConversation.conversationId,
      })
    ).rejects.toThrow();
  });
});
