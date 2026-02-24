import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";

describe("internalArticles", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testArticleId: Id<"internalArticles">;
  let testFolderId: Id<"contentFolders">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);
    testWorkspaceId = (await authenticateClientForWorkspace(client)).workspaceId;

    // Create a test folder
    testFolderId = await client.mutation(api.contentFolders.create, {
      workspaceId: testWorkspaceId,
      name: "Test Folder",
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

  it("should create an internal article", async () => {
    testArticleId = await client.mutation(api.internalArticles.create, {
      workspaceId: testWorkspaceId,
      title: "Test Internal Article",
      content: "This is test content for the internal article.",
      tags: ["test", "documentation"],
    });

    expect(testArticleId).toBeDefined();
  });

  it("should get an internal article by id", async () => {
    const article = await client.query(api.internalArticles.get, { id: testArticleId });

    expect(article).toBeDefined();
    expect(article?.title).toBe("Test Internal Article");
    expect(article?.status).toBe("draft");
    expect(article?.tags).toContain("test");
  });

  it("should list internal articles for workspace", async () => {
    const articles = await client.query(api.internalArticles.list, {
      workspaceId: testWorkspaceId,
    });

    expect(articles).toBeDefined();
    expect(articles.length).toBeGreaterThan(0);
    expect(articles.some((a: { _id: Id<"internalArticles"> }) => a._id === testArticleId)).toBe(
      true
    );
  });

  it("should update an internal article", async () => {
    await client.mutation(api.internalArticles.update, {
      id: testArticleId,
      title: "Updated Internal Article",
      content: "Updated content",
      folderId: testFolderId,
    });

    const article = await client.query(api.internalArticles.get, { id: testArticleId });

    expect(article?.title).toBe("Updated Internal Article");
    expect(article?.content).toBe("Updated content");
    expect(article?.folderId).toBe(testFolderId);
  });

  it("should publish an internal article", async () => {
    await client.mutation(api.internalArticles.publish, { id: testArticleId });

    const article = await client.query(api.internalArticles.get, { id: testArticleId });

    expect(article?.status).toBe("published");
    expect(article?.publishedAt).toBeDefined();
  });

  it("should filter articles by status", async () => {
    const publishedArticles = await client.query(api.internalArticles.list, {
      workspaceId: testWorkspaceId,
      status: "published",
    });

    expect(
      publishedArticles.some((a: { _id: Id<"internalArticles"> }) => a._id === testArticleId)
    ).toBe(true);

    const draftArticles = await client.query(api.internalArticles.list, {
      workspaceId: testWorkspaceId,
      status: "draft",
    });

    expect(
      draftArticles.some((a: { _id: Id<"internalArticles"> }) => a._id === testArticleId)
    ).toBe(false);
  });

  it("should filter articles by folder", async () => {
    const folderArticles = await client.query(api.internalArticles.list, {
      workspaceId: testWorkspaceId,
      folderId: testFolderId,
    });

    expect(
      folderArticles.some((a: { _id: Id<"internalArticles"> }) => a._id === testArticleId)
    ).toBe(true);
  });

  it("should filter articles by tags", async () => {
    const taggedArticles = await client.query(api.internalArticles.list, {
      workspaceId: testWorkspaceId,
      tags: ["test"],
    });

    expect(
      taggedArticles.some((a: { _id: Id<"internalArticles"> }) => a._id === testArticleId)
    ).toBe(true);
  });

  it("should unpublish an internal article", async () => {
    await client.mutation(api.internalArticles.unpublish, { id: testArticleId });

    const article = await client.query(api.internalArticles.get, { id: testArticleId });

    expect(article?.status).toBe("draft");
  });

  it("should search internal articles", async () => {
    // Re-publish for search
    await client.mutation(api.internalArticles.publish, { id: testArticleId });

    const results = await client.query(api.internalArticles.search, {
      workspaceId: testWorkspaceId,
      query: "Updated",
    });

    expect(results.some((a: { _id: Id<"internalArticles"> }) => a._id === testArticleId)).toBe(
      true
    );
  });

  it("should get all tags", async () => {
    const tags = await client.query(api.internalArticles.getAllTags, {
      workspaceId: testWorkspaceId,
    });

    expect(tags).toContain("test");
    expect(tags).toContain("documentation");
  });

  it("should archive an internal article", async () => {
    await client.mutation(api.internalArticles.archive, { id: testArticleId });

    const article = await client.query(api.internalArticles.get, { id: testArticleId });

    expect(article?.status).toBe("archived");
  });

  it("should delete an internal article", async () => {
    const result = await client.mutation(api.internalArticles.remove, { id: testArticleId });

    expect(result.success).toBe(true);

    const article = await client.query(api.internalArticles.get, { id: testArticleId });

    expect(article).toBeNull();
  });
});
