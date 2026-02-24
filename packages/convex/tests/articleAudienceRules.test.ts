import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("articleAudienceRules", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testVisitorId: Id<"visitors">;
  let testSessionToken: string;
  let testVisitorIdNoEmail: Id<"visitors">;
  let testSessionTokenNoEmail: string;
  let testArticleId: Id<"articles">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;

    // Create visitor with email
    const visitor1 = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
      email: "test@example.com",
      name: "Test User",
      customAttributes: {
        plan: "pro",
        tier: "premium",
      },
    });
    testVisitorId = visitor1.visitorId;

    const session1 = await client.mutation(api.testing.helpers.createTestSessionToken, {
      visitorId: testVisitorId,
      workspaceId: testWorkspaceId,
    });
    testSessionToken = session1.sessionToken;

    // Create visitor without email
    const visitor2 = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
    });
    testVisitorIdNoEmail = visitor2.visitorId;

    const session2 = await client.mutation(api.testing.helpers.createTestSessionToken, {
      visitorId: testVisitorIdNoEmail,
      workspaceId: testWorkspaceId,
    });
    testSessionTokenNoEmail = session2.sessionToken;
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

  describe("listForVisitor with audience rules", () => {
    it("should return article when no audience rules defined", async () => {
      testArticleId = await client.mutation(api.testing.helpers.createTestArticle, {
        workspaceId: testWorkspaceId,
        title: "Public Article",
        content: "This article is for everyone",
      });

      await client.mutation(api.testing.helpers.publishTestArticle, { id: testArticleId });

      const articles = await client.query(api.articles.listForVisitor, {
        workspaceId: testWorkspaceId,
        visitorId: testVisitorId,
        sessionToken: testSessionToken,
      });

      expect(articles.some((a) => a._id === testArticleId)).toBe(true);

      await client.mutation(api.testing.helpers.removeTestArticle, { id: testArticleId });
    });

    it("should return article when visitor matches audience rules", async () => {
      testArticleId = await client.mutation(api.testing.helpers.createTestArticle, {
        workspaceId: testWorkspaceId,
        title: "Pro Users Article",
        content: "This article is for pro users only",
      });

      await client.mutation(api.testing.helpers.updateTestArticle, {
        id: testArticleId,
        audienceRules: {
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
      });

      await client.mutation(api.testing.helpers.publishTestArticle, { id: testArticleId });

      const articles = await client.query(api.articles.listForVisitor, {
        workspaceId: testWorkspaceId,
        visitorId: testVisitorId,
        sessionToken: testSessionToken,
      });

      expect(articles.some((a) => a._id === testArticleId)).toBe(true);

      await client.mutation(api.testing.helpers.removeTestArticle, { id: testArticleId });
    });

    it("should not return article when visitor does not match audience rules", async () => {
      testArticleId = await client.mutation(api.testing.helpers.createTestArticle, {
        workspaceId: testWorkspaceId,
        title: "Enterprise Article",
        content: "This article is for enterprise users only",
      });

      await client.mutation(api.testing.helpers.updateTestArticle, {
        id: testArticleId,
        audienceRules: {
          type: "group",
          operator: "and",
          conditions: [
            {
              type: "condition",
              property: { source: "custom", key: "plan" },
              operator: "equals",
              value: "enterprise",
            },
          ],
        },
      });

      await client.mutation(api.testing.helpers.publishTestArticle, { id: testArticleId });

      const articles = await client.query(api.articles.listForVisitor, {
        workspaceId: testWorkspaceId,
        visitorId: testVisitorId,
        sessionToken: testSessionToken,
      });

      expect(articles.some((a) => a._id === testArticleId)).toBe(false);

      await client.mutation(api.testing.helpers.removeTestArticle, { id: testArticleId });
    });

    it("should filter by email is_set rule", async () => {
      testArticleId = await client.mutation(api.testing.helpers.createTestArticle, {
        workspaceId: testWorkspaceId,
        title: "Identified Users Article",
        content: "This article requires email",
      });

      await client.mutation(api.testing.helpers.updateTestArticle, {
        id: testArticleId,
        audienceRules: {
          type: "group",
          operator: "and",
          conditions: [
            {
              type: "condition",
              property: { source: "system", key: "email" },
              operator: "is_set",
            },
          ],
        },
      });

      await client.mutation(api.testing.helpers.publishTestArticle, { id: testArticleId });

      // Visitor with email should see it
      const articlesWithEmail = await client.query(api.articles.listForVisitor, {
        workspaceId: testWorkspaceId,
        visitorId: testVisitorId,
        sessionToken: testSessionToken,
      });
      expect(articlesWithEmail.some((a) => a._id === testArticleId)).toBe(true);

      // Visitor without email should not see it
      const articlesNoEmail = await client.query(api.articles.listForVisitor, {
        workspaceId: testWorkspaceId,
        visitorId: testVisitorIdNoEmail,
        sessionToken: testSessionTokenNoEmail,
      });
      expect(articlesNoEmail.some((a) => a._id === testArticleId)).toBe(false);

      await client.mutation(api.testing.helpers.removeTestArticle, { id: testArticleId });
    });
  });

  describe("searchForVisitor with audience rules", () => {
    it("should return matching article in search when visitor matches rules", async () => {
      testArticleId = await client.mutation(api.testing.helpers.createTestArticle, {
        workspaceId: testWorkspaceId,
        title: "Premium Features Guide",
        content: "Learn about premium features for pro users",
      });

      await client.mutation(api.testing.helpers.updateTestArticle, {
        id: testArticleId,
        audienceRules: {
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
      });

      await client.mutation(api.testing.helpers.publishTestArticle, { id: testArticleId });

      const results = await client.query(api.articles.searchForVisitor, {
        workspaceId: testWorkspaceId,
        visitorId: testVisitorId,
        sessionToken: testSessionToken,
        query: "premium",
      });

      expect(results.some((a) => a._id === testArticleId)).toBe(true);

      await client.mutation(api.testing.helpers.removeTestArticle, { id: testArticleId });
    });

    it("should not return article in search when visitor does not match rules", async () => {
      testArticleId = await client.mutation(api.testing.helpers.createTestArticle, {
        workspaceId: testWorkspaceId,
        title: "Enterprise Admin Guide",
        content: "Admin features for enterprise customers",
      });

      await client.mutation(api.testing.helpers.updateTestArticle, {
        id: testArticleId,
        audienceRules: {
          type: "group",
          operator: "and",
          conditions: [
            {
              type: "condition",
              property: { source: "custom", key: "plan" },
              operator: "equals",
              value: "enterprise",
            },
          ],
        },
      });

      await client.mutation(api.testing.helpers.publishTestArticle, { id: testArticleId });

      const results = await client.query(api.articles.searchForVisitor, {
        workspaceId: testWorkspaceId,
        visitorId: testVisitorId,
        sessionToken: testSessionToken,
        query: "enterprise",
      });

      expect(results.some((a) => a._id === testArticleId)).toBe(false);

      await client.mutation(api.testing.helpers.removeTestArticle, { id: testArticleId });
    });
  });

  describe("previewAudience", () => {
    it("should return all visitors when no rules", async () => {
      const preview = await client.query(api.articles.previewAudience, {
        workspaceId: testWorkspaceId,
      });

      expect(preview.total).toBeGreaterThanOrEqual(2);
      expect(preview.matching).toBe(preview.total);
    });

    it("should return matching count for specific rules", async () => {
      const preview = await client.query(api.articles.previewAudience, {
        workspaceId: testWorkspaceId,
        audienceRules: {
          type: "group",
          operator: "and",
          conditions: [
            {
              type: "condition",
              property: { source: "system", key: "email" },
              operator: "is_set",
            },
          ],
        },
      });

      expect(preview.total).toBeGreaterThanOrEqual(2);
      expect(preview.matching).toBeGreaterThanOrEqual(1);
      expect(preview.matching).toBeLessThan(preview.total);
    });
  });

  describe("article with OR conditions", () => {
    it("should match when any condition is true", async () => {
      testArticleId = await client.mutation(api.testing.helpers.createTestArticle, {
        workspaceId: testWorkspaceId,
        title: "Pro or Premium Article",
        content: "For pro or premium tier users",
      });

      await client.mutation(api.testing.helpers.updateTestArticle, {
        id: testArticleId,
        audienceRules: {
          type: "group",
          operator: "or",
          conditions: [
            {
              type: "condition",
              property: { source: "custom", key: "plan" },
              operator: "equals",
              value: "enterprise",
            },
            {
              type: "condition",
              property: { source: "custom", key: "tier" },
              operator: "equals",
              value: "premium",
            },
          ],
        },
      });

      await client.mutation(api.testing.helpers.publishTestArticle, { id: testArticleId });

      const articles = await client.query(api.articles.listForVisitor, {
        workspaceId: testWorkspaceId,
        visitorId: testVisitorId,
        sessionToken: testSessionToken,
      });

      expect(articles.some((a) => a._id === testArticleId)).toBe(true);

      await client.mutation(api.testing.helpers.removeTestArticle, { id: testArticleId });
    });
  });
});
