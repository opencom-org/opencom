import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";

describe("unified knowledge flows", () => {
  let authedClient: ConvexClient;
  let unauthClient: ConvexClient;
  let workspaceId: Id<"workspaces">;
  let userId: Id<"users">;
  let visitorId: Id<"visitors">;
  let sessionToken: string;
  let collectionId: Id<"collections">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }

    authedClient = new ConvexClient(convexUrl);
    unauthClient = new ConvexClient(convexUrl);

    const authContext = await authenticateClientForWorkspace(authedClient);
    workspaceId = authContext.workspaceId;
    userId = authContext.userId;

    collectionId = await authedClient.mutation(api.collections.create, {
      workspaceId,
      name: "Unified Knowledge Tests",
      description: "Knowledge lifecycle verification",
    });

    const visitor = await authedClient.mutation(api.testing_helpers.createTestVisitor, {
      workspaceId,
      email: "visitor@example.com",
      name: "Visitor Knowledge",
    });
    visitorId = visitor.visitorId;

    const session = await authedClient.mutation(api.testing_helpers.createTestSessionToken, {
      visitorId,
      workspaceId,
    });
    sessionToken = session.sessionToken;
  });

  afterAll(async () => {
    if (workspaceId) {
      try {
        await authedClient.mutation(api.testing_helpers.cleanupTestData, {
          workspaceId,
        });
      } catch (error) {
        console.warn("Cleanup failed:", error);
      }
    }

    await authedClient.close();
    await unauthClient.close();
  });

  it("creates and saves internal articles through the unified articles editor flow", async () => {
    const articleId = await authedClient.mutation(api.articles.create, {
      workspaceId,
      collectionId,
      title: "Agent onboarding draft",
      content: "Draft onboarding steps",
      visibility: "internal",
    });

    await authedClient.mutation(api.articles.update, {
      id: articleId,
      title: "Agent onboarding checklist",
      content: "Final onboarding checklist for agents",
      visibility: "internal",
      tags: ["ops", "enablement"],
    });

    const savedArticle = await authedClient.query(api.articles.get, {
      id: articleId,
      workspaceId,
    });
    expect(savedArticle?._id).toBe(articleId);
    expect(savedArticle?.visibility).toBe("internal");
    expect(savedArticle?.collectionId).toBe(collectionId);
    expect(savedArticle?.title).toBe("Agent onboarding checklist");
    expect(savedArticle?.tags).toEqual(["ops", "enablement"]);

    const compatibilityArticle = await authedClient.query(api.internalArticles.get, {
      id: articleId,
    });
    expect(compatibilityArticle?._id).toBe(articleId);
    expect(compatibilityArticle?.title).toBe("Agent onboarding checklist");
    expect(compatibilityArticle?.content).toContain("Final onboarding checklist");
    expect(compatibilityArticle?.tags).toEqual(["ops", "enablement"]);
    expect(compatibilityArticle?.folderId).toBeUndefined();

    await authedClient.mutation(api.articles.publish, { id: articleId });

    const searchResults = await authedClient.query(api.knowledge.search, {
      workspaceId,
      query: "onboarding checklist",
      contentTypes: ["internalArticle"],
    });

    expect(
      searchResults.some(
        (result) => result.id === articleId && result.type === "internalArticle"
      )
    ).toBe(true);
  });

  it("keeps published internal articles off visitor-facing browse and search surfaces", async () => {
    const publicArticleId = await authedClient.mutation(api.articles.create, {
      workspaceId,
      collectionId,
      title: "Cancellation guide",
      content: "Visitors can use this cancellation guide.",
      visibility: "public",
    });
    const internalArticleId = await authedClient.mutation(api.articles.create, {
      workspaceId,
      collectionId,
      title: "Cancellation exception playbook",
      content: "Internal-only refund and exception handling steps.",
      visibility: "internal",
      tags: ["refunds"],
    });

    await authedClient.mutation(api.articles.publish, { id: publicArticleId });
    await authedClient.mutation(api.articles.publish, { id: internalArticleId });

    const visitorBrowse = await unauthClient.query(api.articles.listForVisitor, {
      workspaceId,
      visitorId,
      sessionToken,
      collectionId,
    });

    expect(visitorBrowse.some((article) => article._id === publicArticleId)).toBe(true);
    expect(visitorBrowse.some((article) => article._id === internalArticleId)).toBe(false);

    const visitorSearch = await unauthClient.query(api.articles.searchForVisitor, {
      workspaceId,
      visitorId,
      sessionToken,
      query: "cancellation",
    });

    expect(visitorSearch.some((article) => article._id === publicArticleId)).toBe(true);
    expect(visitorSearch.some((article) => article._id === internalArticleId)).toBe(false);
  });

  it("migrates legacy internal articles and keeps recent-content references usable", async () => {
    const folderId = await authedClient.mutation(api.testing_helpers.createTestContentFolder, {
      workspaceId,
      name: "Legacy Internal Folder",
    });

    const legacyInternalArticleId = await authedClient.mutation(
      api.testing_helpers.createTestInternalArticle,
      {
        workspaceId,
        title: "Legacy escalation notes",
        content: "Legacy-only escalation instructions for billing issues.",
        tags: ["legacy", "billing"],
        folderId,
      }
    );

    await authedClient.mutation(api.testing_helpers.publishTestInternalArticle, {
      id: legacyInternalArticleId,
    });

    await authedClient.mutation(api.knowledge.trackAccess, {
      userId,
      workspaceId,
      contentType: "internalArticle",
      contentId: legacyInternalArticleId,
    });

    const recentContentBeforeMigration = await authedClient.query(api.knowledge.getRecentlyUsed, {
      userId,
      workspaceId,
      limit: 10,
    });
    expect(recentContentBeforeMigration).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: legacyInternalArticleId,
          type: "internalArticle",
          title: "Legacy escalation notes",
        }),
      ])
    );

    const migration = await authedClient.mutation(api.articles.migrateLegacyInternalArticles, {
      workspaceId,
    });
    const migratedRecord = migration.migrated.find(
      (record) => record.legacyId === legacyInternalArticleId
    );

    expect(migratedRecord).toBeDefined();

    const unifiedArticle = await authedClient.query(api.articles.get, {
      id: migratedRecord!.articleId,
      workspaceId,
    });
    expect(unifiedArticle?._id).toBe(migratedRecord?.articleId);
    expect(unifiedArticle?.visibility).toBe("internal");
    expect(unifiedArticle?.legacyInternalArticleId).toBe(legacyInternalArticleId);
    expect(unifiedArticle?.legacyFolderId).toBe(folderId);

    const compatibilityArticle = await authedClient.query(api.internalArticles.get, {
      id: migratedRecord!.articleId,
    });
    expect(compatibilityArticle?._id).toBe(migratedRecord?.articleId);
    expect(compatibilityArticle?.folderId).toBe(folderId);
    expect(compatibilityArticle?.tags).toEqual(["legacy", "billing"]);

    const listedCompatibilityArticles = await authedClient.query(api.internalArticles.list, {
      workspaceId,
      folderId,
    });
    expect(
      listedCompatibilityArticles.some((article) => article._id === migratedRecord?.articleId)
    ).toBe(true);

    const recentContent = await authedClient.query(api.knowledge.getRecentlyUsed, {
      userId,
      workspaceId,
      limit: 10,
    });
    const migratedRecentItem = recentContent.find(
      (item) => item.title === "Legacy escalation notes"
    );

    expect(migratedRecentItem).toMatchObject({
      id: migratedRecord?.articleId,
      type: "internalArticle",
      title: "Legacy escalation notes",
    });
  });
});
