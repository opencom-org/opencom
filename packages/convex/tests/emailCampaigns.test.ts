import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";

describe("emailCampaigns", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testVisitorId: Id<"visitors">;
  let testCampaignId: Id<"emailCampaigns">;
  let testTemplateId: Id<"emailTemplates">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);
    testWorkspaceId = (await authenticateClientForWorkspace(client)).workspaceId;

    // Create a test visitor with email
    const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
    });
    testVisitorId = visitor.visitorId;

    // Update visitor with email using identify
    await client.mutation(api.visitors.identify, {
      visitorId: testVisitorId,
      email: "test@example.com",
      name: "Test User",
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

  describe("email templates", () => {
    it("should create an email template", async () => {
      testTemplateId = await client.mutation(api.emailTemplates.create, {
        workspaceId: testWorkspaceId,
        name: "Welcome Template",
        subject: "Welcome to our platform!",
        html: "<h1>Welcome {{user.name}}!</h1><p>Thanks for joining us.</p>",
        variables: ["user.name"],
        category: "onboarding",
      });

      expect(testTemplateId).toBeDefined();
    });

    it("should get a template by id", async () => {
      const template = await client.query(api.emailTemplates.get, { id: testTemplateId });

      expect(template).toBeDefined();
      expect(template?.name).toBe("Welcome Template");
      expect(template?.subject).toBe("Welcome to our platform!");
      expect(template?.variables).toContain("user.name");
    });

    it("should list templates for workspace", async () => {
      const templates = await client.query(api.emailTemplates.list, {
        workspaceId: testWorkspaceId,
      });

      expect(templates).toBeDefined();
      expect(templates.length).toBeGreaterThan(0);
    });

    it("should update a template", async () => {
      await client.mutation(api.emailTemplates.update, {
        id: testTemplateId,
        name: "Updated Welcome Template",
        html: "<h1>Hello {{user.name}}!</h1>",
      });

      const template = await client.query(api.emailTemplates.get, { id: testTemplateId });

      expect(template?.name).toBe("Updated Welcome Template");
    });

    it("should extract variables from HTML", async () => {
      const variables = await client.query(api.emailTemplates.extractVariables, {
        html: "<p>Hello {{user.name}}, your email is {{user.email}}</p>",
      });

      expect(variables).toContain("user.name");
      expect(variables).toContain("user.email");
    });

    it("should duplicate a template", async () => {
      const duplicateId = await client.mutation(api.emailTemplates.duplicate, {
        id: testTemplateId,
      });

      const duplicate = await client.query(api.emailTemplates.get, { id: duplicateId });

      expect(duplicate?.name).toContain("(Copy)");
    });
  });

  describe("email campaigns CRUD", () => {
    it("should create an email campaign", async () => {
      testCampaignId = await client.mutation(api.emailCampaigns.create, {
        workspaceId: testWorkspaceId,
        name: "Welcome Campaign",
        subject: "Welcome to our platform!",
        content: "<h1>Welcome!</h1><p>Thanks for signing up.</p>",
        templateId: testTemplateId,
      });

      expect(testCampaignId).toBeDefined();
    });

    it("should get a campaign by id", async () => {
      const campaign = await client.query(api.emailCampaigns.get, { id: testCampaignId });

      expect(campaign).toBeDefined();
      expect(campaign?.name).toBe("Welcome Campaign");
      expect(campaign?.subject).toBe("Welcome to our platform!");
      expect(campaign?.status).toBe("draft");
    });

    it("should list campaigns for workspace", async () => {
      const campaigns = await client.query(api.emailCampaigns.list, {
        workspaceId: testWorkspaceId,
      });

      expect(campaigns).toBeDefined();
      expect(campaigns.length).toBeGreaterThan(0);
      expect(campaigns.some((c: { _id: Id<"emailCampaigns"> }) => c._id === testCampaignId)).toBe(
        true
      );
    });

    it("should update a campaign", async () => {
      await client.mutation(api.emailCampaigns.update, {
        id: testCampaignId,
        name: "Updated Welcome Campaign",
        previewText: "Check out what's new",
      });

      const campaign = await client.query(api.emailCampaigns.get, { id: testCampaignId });

      expect(campaign?.name).toBe("Updated Welcome Campaign");
      expect(campaign?.previewText).toBe("Check out what's new");
    });

    it("should filter campaigns by status", async () => {
      const draftCampaigns = await client.query(api.emailCampaigns.list, {
        workspaceId: testWorkspaceId,
        status: "draft",
      });

      expect(draftCampaigns.every((c: { status: string }) => c.status === "draft")).toBe(true);
    });
  });

  describe("campaign sending", () => {
    it("should send a campaign and create recipients", async () => {
      const result = await client.mutation(api.emailCampaigns.send, {
        id: testCampaignId,
      });

      expect(result.recipientCount).toBeGreaterThanOrEqual(0);

      const campaign = await client.query(api.emailCampaigns.get, { id: testCampaignId });
      expect(["sending", "scheduled"]).toContain(campaign?.status);
    });

    it("should get campaign stats", async () => {
      const stats = await client.query(api.emailCampaigns.getStats, {
        id: testCampaignId,
      });

      expect(stats).toBeDefined();
      expect(typeof stats.total).toBe("number");
      expect(typeof stats.openRate).toBe("number");
      expect(typeof stats.clickRate).toBe("number");
    });
  });

  describe("cleanup", () => {
    it("should delete a campaign", async () => {
      await client.mutation(api.emailCampaigns.remove, { id: testCampaignId });

      const campaign = await client.query(api.emailCampaigns.get, { id: testCampaignId });

      expect(campaign).toBeNull();
    });

    it("should delete a template", async () => {
      await client.mutation(api.emailTemplates.remove, { id: testTemplateId });

      const template = await client.query(api.emailTemplates.get, { id: testTemplateId });

      expect(template).toBeNull();
    });
  });
});
