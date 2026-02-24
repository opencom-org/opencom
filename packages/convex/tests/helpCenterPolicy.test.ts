import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";

describe("help center policy enforcement", () => {
  let authedClient: ConvexClient;
  let unauthClient: ConvexClient;
  let workspaceId: Id<"workspaces">;
  let collectionId: Id<"collections">;
  let publishedArticleId: Id<"articles">;
  let publishedSlug: string;
  let draftArticleId: Id<"articles">;
  let draftSlug: string;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }

    authedClient = new ConvexClient(convexUrl);
    unauthClient = new ConvexClient(convexUrl);

    const authContext = await authenticateClientForWorkspace(authedClient);
    workspaceId = authContext.workspaceId;

    collectionId = await authedClient.mutation(api.testing.helpers.createTestCollection, {
      workspaceId,
      name: "Public Docs",
      description: "Public-facing docs",
    });

    publishedArticleId = await authedClient.mutation(api.testing.helpers.createTestArticle, {
      workspaceId,
      collectionId,
      title: "Published Help Article",
      content: "Published guidance for visitors",
      status: "published",
    });

    draftArticleId = await authedClient.mutation(api.testing.helpers.createTestArticle, {
      workspaceId,
      title: "Draft Help Article",
      content: "Draft-only guidance",
      status: "draft",
    });

    const publishedArticle = await authedClient.query(api.articles.get, {
      id: publishedArticleId,
      workspaceId,
    });
    const draftArticle = await authedClient.query(api.articles.get, {
      id: draftArticleId,
      workspaceId,
    });

    if (!publishedArticle?.slug || !draftArticle?.slug) {
      throw new Error("Failed to resolve seeded article slugs for policy tests");
    }

    publishedSlug = publishedArticle.slug;
    draftSlug = draftArticle.slug;
  });

  afterAll(async () => {
    if (workspaceId) {
      await authedClient.mutation(api.testing.helpers.cleanupTestData, {
        workspaceId,
      });
    }

    await authedClient.close();
    await unauthClient.close();
  });

  it("allows unauthenticated published reads when policy is public", async () => {
    await authedClient.mutation(api.testing.helpers.updateTestHelpCenterAccessPolicy, {
      workspaceId,
      policy: "public",
    });

    const collections = await unauthClient.query(api.collections.listHierarchy, {
      workspaceId,
    });
    expect(collections.some((collection) => collection._id === collectionId)).toBe(true);

    const listedArticles = await unauthClient.query(api.articles.list, {
      workspaceId,
    });
    expect(listedArticles.some((article) => article._id === publishedArticleId)).toBe(true);

    const bySlug = await unauthClient.query(api.articles.get, {
      workspaceId,
      slug: publishedSlug,
    });
    expect(bySlug?._id).toBe(publishedArticleId);

    const searchResults = await unauthClient.query(api.articles.search, {
      workspaceId,
      query: "published guidance",
    });
    expect(searchResults.some((article) => article._id === publishedArticleId)).toBe(true);
  });

  it("blocks unauthenticated reads when policy is restricted", async () => {
    await authedClient.mutation(api.testing.helpers.updateTestHelpCenterAccessPolicy, {
      workspaceId,
      policy: "restricted",
    });

    const collections = await unauthClient.query(api.collections.listHierarchy, {
      workspaceId,
    });
    expect(collections).toEqual([]);

    const listedArticles = await unauthClient.query(api.articles.list, {
      workspaceId,
    });
    expect(listedArticles).toEqual([]);

    const bySlug = await unauthClient.query(api.articles.get, {
      workspaceId,
      slug: publishedSlug,
    });
    expect(bySlug).toBeNull();

    const searchResults = await unauthClient.query(api.articles.search, {
      workspaceId,
      query: "published guidance",
    });
    expect(searchResults).toEqual([]);
  });

  it("preserves authenticated member access when policy is restricted", async () => {
    await authedClient.mutation(api.testing.helpers.updateTestHelpCenterAccessPolicy, {
      workspaceId,
      policy: "restricted",
    });

    const collections = await authedClient.query(api.collections.listHierarchy, {
      workspaceId,
    });
    expect(collections.some((collection) => collection._id === collectionId)).toBe(true);

    const listedArticles = await authedClient.query(api.articles.list, {
      workspaceId,
    });
    expect(listedArticles.some((article) => article._id === publishedArticleId)).toBe(true);

    const draftBySlug = await authedClient.query(api.articles.get, {
      workspaceId,
      slug: draftSlug,
    });
    expect(draftBySlug?._id).toBe(draftArticleId);
  });

  it("never exposes unpublished articles to unauthenticated callers", async () => {
    await authedClient.mutation(api.testing.helpers.updateTestHelpCenterAccessPolicy, {
      workspaceId,
      policy: "public",
    });

    const draftBySlug = await unauthClient.query(api.articles.get, {
      workspaceId,
      slug: draftSlug,
    });
    expect(draftBySlug).toBeNull();

    const listedArticles = await unauthClient.query(api.articles.list, {
      workspaceId,
    });
    expect(listedArticles.some((article) => article._id === draftArticleId)).toBe(false);

    const searchResults = await unauthClient.query(api.articles.search, {
      workspaceId,
      query: "draft-only guidance",
    });
    expect(searchResults.some((article) => article._id === draftArticleId)).toBe(false);
  });
});
