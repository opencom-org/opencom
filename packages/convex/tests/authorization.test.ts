import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { roleHasPermission, memberHasPermission } from "../convex/permissions";

describe("Authorization", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testVisitorId: Id<"visitors">;
  let testConversationId: Id<"conversations">;
  let testArticleId: Id<"articles">;
  let testTourId: Id<"tours">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;

    const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
      email: "auth-test-visitor@test.com",
    });
    testVisitorId = visitor.visitorId;

    const conv = await client.mutation(api.testing.helpers.createTestConversation, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
    });
    testConversationId = conv.conversationId;

    testArticleId = await client.mutation(api.testing.helpers.createTestArticle, {
      workspaceId: testWorkspaceId,
      title: "Auth Test Article",
      content: "Test content",
    });

    testTourId = await client.mutation(api.testing.helpers.createTestTour, {
      workspaceId: testWorkspaceId,
      name: "Auth Test Tour",
    });
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

  describe("conversations", () => {
    it("list returns empty array for unauthenticated users", async () => {
      // Unauthenticated query to list conversations
      const result = await client.query(api.conversations.list, {
        workspaceId: testWorkspaceId,
      });
      expect(result).toEqual([]);
    });

    it("listForInbox returns empty array for unauthenticated users", async () => {
      const result = await client.query(api.conversations.listForInbox, {
        workspaceId: testWorkspaceId,
      });
      expect(result.conversations).toEqual([]);
    });

    it("create throws for unauthenticated users", async () => {
      await expect(
        client.mutation(api.conversations.create, {
          workspaceId: testWorkspaceId,
        })
      ).rejects.toThrow("Not authenticated");
    });
  });

  describe("messages", () => {
    it("list returns empty array for unauthenticated non-visitor requests", async () => {
      const result = await client.query(api.messages.list, {
        conversationId: testConversationId,
      });
      expect(result).toEqual([]);
    });

    it("send throws for unauthorized visitor access", async () => {
      // Create a second visitor who doesn't own the conversation
      const otherVisitor = await client.mutation(api.testing.helpers.createTestVisitor, {
        workspaceId: testWorkspaceId,
        email: "other-visitor@test.com",
      });

      await expect(
        client.mutation(api.messages.send, {
          conversationId: testConversationId,
          senderId: otherVisitor.visitorId,
          senderType: "visitor",
          content: "Unauthorized message",
          visitorId: otherVisitor.visitorId,
        })
      ).rejects.toThrow("Not authorized to send messages to this conversation");
    });
  });

  describe("articles", () => {
    it("create throws for unauthenticated users", async () => {
      await expect(
        client.mutation(api.articles.create, {
          workspaceId: testWorkspaceId,
          title: "Test Article",
          content: "Test content",
        })
      ).rejects.toThrow(/[Aa]uthenticat/);
    });

    it("update throws for unauthenticated users", async () => {
      await expect(
        client.mutation(api.articles.update, {
          id: testArticleId,
          title: "Updated Title",
        })
      ).rejects.toThrow(/[Aa]uthenticat/);
    });

    it("remove throws for unauthenticated users", async () => {
      await expect(
        client.mutation(api.articles.remove, {
          id: testArticleId,
        })
      ).rejects.toThrow(/[Aa]uthenticat/);
    });
  });

  describe("tours", () => {
    it("create throws for unauthenticated users", async () => {
      await expect(
        client.mutation(api.tours.create, {
          workspaceId: testWorkspaceId,
          name: "Test Tour",
        })
      ).rejects.toThrow(/[Aa]uthenticat/);
    });

    it("update throws for unauthenticated users", async () => {
      await expect(
        client.mutation(api.tours.update, {
          id: testTourId,
          name: "Updated Tour",
        })
      ).rejects.toThrow(/[Aa]uthenticat/);
    });

    it("remove throws for unauthenticated users", async () => {
      await expect(
        client.mutation(api.tours.remove, {
          id: testTourId,
        })
      ).rejects.toThrow(/[Aa]uthenticat/);
    });
  });

  describe("workspaces", () => {
    it("create throws for unauthenticated users", async () => {
      await expect(
        client.mutation(api.workspaces.create, {
          name: "New Workspace",
        })
      ).rejects.toThrow("Not authenticated");
    });

    it("updateAllowedOrigins throws for unauthenticated users", async () => {
      await expect(
        client.mutation(api.workspaces.updateAllowedOrigins, {
          workspaceId: testWorkspaceId,
          allowedOrigins: ["https://example.com"],
        })
      ).rejects.toThrow("Not authenticated");
    });

    it("updateSignupSettings throws for unauthenticated users", async () => {
      await expect(
        client.mutation(api.workspaces.updateSignupSettings, {
          workspaceId: testWorkspaceId,
          signupMode: "invite-only",
        })
      ).rejects.toThrow("Not authenticated");
    });

    it("updateHelpCenterAccessPolicy throws for unauthenticated users", async () => {
      await expect(
        client.mutation(api.workspaces.updateHelpCenterAccessPolicy, {
          workspaceId: testWorkspaceId,
          policy: "restricted",
        })
      ).rejects.toThrow("Not authenticated");
    });
  });

  describe("role-based permissions", () => {
    it("owner has all permissions", () => {
      expect(roleHasPermission("owner", "conversations.read")).toBe(true);
      expect(roleHasPermission("owner", "settings.billing")).toBe(true);
      expect(roleHasPermission("owner", "data.delete")).toBe(true);
      expect(roleHasPermission("owner", "users.manage")).toBe(true);
    });

    it("admin has most permissions except billing", () => {
      expect(roleHasPermission("admin", "conversations.read")).toBe(true);
      expect(roleHasPermission("admin", "users.manage")).toBe(true);
      expect(roleHasPermission("admin", "settings.security")).toBe(true);
      expect(roleHasPermission("admin", "settings.billing")).toBe(false);
    });

    it("agent has limited permissions", () => {
      expect(roleHasPermission("agent", "conversations.read")).toBe(true);
      expect(roleHasPermission("agent", "conversations.reply")).toBe(true);
      expect(roleHasPermission("agent", "users.manage")).toBe(false);
      expect(roleHasPermission("agent", "settings.workspace")).toBe(false);
      expect(roleHasPermission("agent", "articles.create")).toBe(false);
    });

    it("viewer has read-only permissions", () => {
      expect(roleHasPermission("viewer", "conversations.read")).toBe(true);
      expect(roleHasPermission("viewer", "articles.read")).toBe(true);
      expect(roleHasPermission("viewer", "conversations.reply")).toBe(false);
      expect(roleHasPermission("viewer", "articles.create")).toBe(false);
    });

    it("custom permissions override role permissions", () => {
      const member = {
        role: "agent" as const,
        permissions: ["conversations.read", "articles.create"],
      };

      expect(memberHasPermission(member, "conversations.read")).toBe(true);
      expect(memberHasPermission(member, "articles.create")).toBe(true);
      // Custom permissions override - agent normally has conversations.reply but not in custom set
      expect(memberHasPermission(member, "conversations.reply")).toBe(false);
    });
  });
});
