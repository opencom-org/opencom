import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";

describe("help center markdown imports", () => {
  let client: ConvexClient;
  let workspaceId: Id<"workspaces">;
  let sourceId: Id<"helpCenterImportSources">;
  let rootCollectionId: Id<"collections">;
  let deletedRunId: string;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }

    client = new ConvexClient(convexUrl);
    const authContext = await authenticateClientForWorkspace(client);
    workspaceId = authContext.workspaceId;

    rootCollectionId = await client.mutation(api.collections.create, {
      workspaceId,
      name: "Imported Docs Root",
      description: "Parent collection for markdown imports",
    });
  });

  afterAll(async () => {
    await client.close();
  });

  it("syncs markdown files into nested collections under a target root", async () => {
    const result = await client.mutation(api.helpCenterImports.syncMarkdownFolder, {
      workspaceId,
      sourceName: "docs",
      rootCollectionId,
      files: [
        {
          relativePath: "docs/getting-started.md",
          content: "# Getting Started\n\nInitial setup guide.",
        },
        {
          relativePath: "docs/guides/install.md",
          content: "# Install\n\nInstall instructions.",
        },
      ],
      publishByDefault: true,
    });

    sourceId = result.sourceId;

    expect(result.createdCollections).toBe(1);
    expect(result.createdArticles).toBe(2);
    expect(result.deletedArticles).toBe(0);
    expect(result.strippedRootFolder).toBe("docs");

    const collections = await client.query(api.collections.listHierarchy, {
      workspaceId,
    });
    const docsCollection = collections.find((collection) => collection.importPath === "docs");
    const guidesCollection = collections.find((collection) => collection.importPath === "guides");

    expect(docsCollection).toBeUndefined();
    expect(guidesCollection).toBeDefined();
    expect(guidesCollection?.parentId).toBe(rootCollectionId);

    const articles = await client.query(api.articles.list, {
      workspaceId,
      status: "published",
    });
    const gettingStartedArticle = articles.find((article) => article.title === "Getting Started");
    expect(gettingStartedArticle).toBeDefined();
    expect(gettingStartedArticle?.collectionId).toBe(rootCollectionId);
    const installArticle = articles.find((article) => article.title === "Install");
    expect(installArticle).toBeDefined();
    expect(installArticle?.collectionId).toBe(guidesCollection?._id);
  });

  it("overwrites duplicates, adds new files, and archives deletions on reupload", async () => {
    const before = await client.query(api.articles.search, {
      workspaceId,
      query: "Install instructions",
    });
    const previousInstallId = before.find((article) => article.title === "Install")?._id;
    expect(previousInstallId).toBeDefined();

    const result = await client.mutation(api.helpCenterImports.syncMarkdownFolder, {
      workspaceId,
      sourceName: "docs",
      rootCollectionId,
      files: [
        {
          relativePath: "docs/getting-started.md",
          content: "# Getting Started\n\nUpdated setup guide.",
        },
        {
          relativePath: "docs/guides/advanced.md",
          content: "# Advanced\n\nAdvanced guide.",
        },
      ],
      publishByDefault: true,
    });

    deletedRunId = result.importRunId;

    expect(result.updatedArticles).toBeGreaterThanOrEqual(1);
    expect(result.createdArticles).toBe(1);
    expect(result.deletedArticles).toBe(1);
    expect(result.strippedRootFolder).toBe("docs");

    const removedArticle = await client.query(api.articles.get, {
      id: previousInstallId!,
      workspaceId,
    });
    expect(removedArticle).toBeNull();

    const history = await client.query(api.helpCenterImports.listHistory, {
      workspaceId,
      sourceId,
      limit: 5,
    });
    expect(history.length).toBeGreaterThan(0);
    expect(history[0]?.importRunId).toBe(deletedRunId);
    expect(history[0]?.deletedArticles).toBeGreaterThanOrEqual(1);
    expect(history[0]?.restorableEntries).toBeGreaterThanOrEqual(1);
  });

  it("supports dry-run previews without persisting changes", async () => {
    const beforeArticles = await client.query(api.articles.list, {
      workspaceId,
      status: "published",
    });

    const preview = await client.mutation(api.helpCenterImports.syncMarkdownFolder, {
      workspaceId,
      sourceName: "preview-only-import-source",
      rootCollectionId,
      files: [
        {
          relativePath: "preview/new-file.md",
          content: "# Preview File\n\nPreview only content.",
        },
      ],
      publishByDefault: true,
      dryRun: true,
    });

    expect(preview.dryRun).toBe(true);
    expect(preview.createdArticles).toBe(1);
    expect(preview.createdCollections).toBe(0);
    expect(preview.preview.articles.create).toContain("new-file.md");
    expect(preview.preview.collections.create).toHaveLength(0);
    expect(preview.strippedRootFolder).toBe("preview");

    const afterArticles = await client.query(api.articles.list, {
      workspaceId,
      status: "published",
    });
    expect(afterArticles.length).toBe(beforeArticles.length);
    expect(afterArticles.some((article) => article.title === "Preview File")).toBe(false);

    const sources = await client.query(api.helpCenterImports.listSources, {
      workspaceId,
    });
    expect(sources.some((source) => source.sourceName === "preview-only-import-source")).toBe(
      false
    );
  });

  it("adopts manually created articles by matching collection and article names", async () => {
    const manualCollectionId = await client.mutation(api.collections.create, {
      workspaceId,
      name: "Manual Guides",
      parentId: rootCollectionId,
    });
    const manualArticleId = await client.mutation(api.articles.create, {
      workspaceId,
      collectionId: manualCollectionId,
      title: "Hosted Quick Start",
      content: "Old manual content",
    });

    const result = await client.mutation(api.helpCenterImports.syncMarkdownFolder, {
      workspaceId,
      sourceName: "manual-adoption-source",
      rootCollectionId,
      files: [
        {
          relativePath: "manual-guides/hosted-quick-start.md",
          content: "# Hosted Quick Start\n\nUpdated from markdown import.",
        },
        {
          relativePath: "root-index.md",
          content: "# Root Index\n\nKeeps top-level folder matching explicit.",
        },
      ],
      publishByDefault: true,
    });

    expect(result.createdCollections).toBe(0);
    expect(result.updatedCollections).toBe(1);
    expect(result.createdArticles).toBe(1);
    expect(result.updatedArticles).toBe(1);

    const article = await client.query(api.articles.get, {
      id: manualArticleId,
      workspaceId,
    });
    expect(article).not.toBeNull();
    expect(article?._id).toBe(manualArticleId);
    expect(article?.title).toBe("Hosted Quick Start");
    expect(article?.content).toContain("Updated from markdown import.");
    expect(article?.importPath).toBe("manual-guides/hosted-quick-start.md");
    expect(article?.collectionId).toBe(manualCollectionId);

    const collections = await client.query(api.collections.listHierarchy, {
      workspaceId,
    });
    const manualCollection = collections.find(
      (collection) => collection._id === manualCollectionId
    );
    expect(manualCollection?.importPath).toBe("manual-guides");
  });

  it("migrates legacy root-prefixed paths without creating duplicate docs", async () => {
    const sourceName = "legacy-docs";

    const legacyImport = await client.mutation(api.helpCenterImports.syncMarkdownFolder, {
      workspaceId,
      sourceName,
      rootCollectionId,
      files: [
        {
          relativePath: "legacy/intro.md",
          content: "# Legacy Intro\n\nLegacy intro content.",
        },
        {
          relativePath: "legacy/guides/install.md",
          content: "# Legacy Install\n\nLegacy install content.",
        },
        {
          relativePath: "seed.md",
          content: "# Legacy Seed\n\nTemporary file to mimic old import path format.",
        },
      ],
      publishByDefault: true,
    });
    expect(legacyImport.strippedRootFolder).toBeUndefined();

    const migratedImport = await client.mutation(api.helpCenterImports.syncMarkdownFolder, {
      workspaceId,
      sourceName,
      rootCollectionId,
      files: [
        {
          relativePath: "legacy/intro.md",
          content: "# Legacy Intro\n\nLegacy intro content.",
        },
        {
          relativePath: "legacy/guides/install.md",
          content: "# Legacy Install\n\nLegacy install content.",
        },
      ],
      publishByDefault: true,
    });

    expect(migratedImport.strippedRootFolder).toBe("legacy");
    expect(migratedImport.createdArticles).toBe(0);
    expect(migratedImport.deletedArticles).toBe(1);

    const articles = await client.query(api.articles.list, {
      workspaceId,
      status: "published",
    });
    expect(articles.filter((article) => article.title === "Legacy Intro")).toHaveLength(1);
    expect(articles.filter((article) => article.title === "Legacy Install")).toHaveLength(1);
    expect(articles.some((article) => article.title === "Legacy Seed")).toBe(false);

    const collections = await client.query(api.collections.listHierarchy, {
      workspaceId,
    });
    expect(collections.some((collection) => collection.importPath === "legacy")).toBe(false);
    const guidesCollection = collections.find((collection) => collection.importPath === "guides");
    expect(guidesCollection?.parentId).toBe(rootCollectionId);
  });

  it("exports markdown files with frontmatter and folder structure", async () => {
    const exportBundle = await client.query(api.helpCenterImports.exportMarkdown, {
      workspaceId,
      sourceId,
      includeDrafts: true,
    });

    expect(exportBundle.count).toBeGreaterThanOrEqual(2);
    expect(exportBundle.fileName).toMatch(/help-center-markdown/);

    const gettingStarted = exportBundle.files.find((file) => file.path === "getting-started.md");
    expect(gettingStarted).toBeDefined();
    expect(gettingStarted?.content).toContain('title: "Getting Started"');
    expect(gettingStarted?.content).toContain("status: published");
    expect(gettingStarted?.content).toContain('source: "docs"');
    expect(gettingStarted?.content).toContain("Updated setup guide.");
  });

  it("restores deleted content from import history", async () => {
    const restore = await client.mutation(api.helpCenterImports.restoreRun, {
      workspaceId,
      sourceId,
      importRunId: deletedRunId,
    });

    expect(restore.restoredArticles).toBeGreaterThanOrEqual(1);

    const search = await client.query(api.articles.search, {
      workspaceId,
      query: "Install instructions",
    });
    expect(search.some((article) => article.title === "Install")).toBe(true);
  });
});
