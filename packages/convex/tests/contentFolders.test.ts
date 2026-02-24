import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";

describe("contentFolders", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testFolderId: Id<"contentFolders">;
  let childFolderId: Id<"contentFolders">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);
    testWorkspaceId = (await authenticateClientForWorkspace(client)).workspaceId;
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

  it("should create a folder", async () => {
    testFolderId = await client.mutation(api.contentFolders.create, {
      workspaceId: testWorkspaceId,
      name: "Test Folder",
    });

    expect(testFolderId).toBeDefined();
  });

  it("should get a folder by id", async () => {
    const folder = await client.query(api.contentFolders.get, { id: testFolderId });

    expect(folder).toBeDefined();
    expect(folder?.name).toBe("Test Folder");
    expect(folder?.workspaceId).toBe(testWorkspaceId);
  });

  it("should list folders for workspace", async () => {
    const folders = await client.query(api.contentFolders.list, {
      workspaceId: testWorkspaceId,
    });

    expect(folders).toBeDefined();
    expect(folders.length).toBeGreaterThan(0);
    expect(folders.some((f: { _id: Id<"contentFolders"> }) => f._id === testFolderId)).toBe(true);
  });

  it("should create a child folder", async () => {
    childFolderId = await client.mutation(api.contentFolders.create, {
      workspaceId: testWorkspaceId,
      name: "Child Folder",
      parentId: testFolderId,
    });

    expect(childFolderId).toBeDefined();

    const childFolder = await client.query(api.contentFolders.get, { id: childFolderId });
    expect(childFolder?.parentId).toBe(testFolderId);
  });

  it("should list tree structure", async () => {
    const tree = await client.query(api.contentFolders.listTree, {
      workspaceId: testWorkspaceId,
    });

    expect(tree).toBeDefined();
    const parentFolder = tree.find((f: { _id: Id<"contentFolders"> }) => f._id === testFolderId);
    expect(parentFolder).toBeDefined();
    expect(parentFolder?.children.length).toBeGreaterThan(0);
    expect(
      parentFolder?.children.some((c: { _id: Id<"contentFolders"> }) => c._id === childFolderId)
    ).toBe(true);
  });

  it("should get breadcrumbs", async () => {
    const breadcrumbs = await client.query(api.contentFolders.getBreadcrumbs, {
      id: childFolderId,
    });

    expect(breadcrumbs).toBeDefined();
    expect(breadcrumbs.length).toBe(2);
    expect(breadcrumbs[0].name).toBe("Test Folder");
    expect(breadcrumbs[1].name).toBe("Child Folder");
  });

  it("should update a folder name", async () => {
    await client.mutation(api.contentFolders.update, {
      id: testFolderId,
      name: "Updated Folder",
    });

    const folder = await client.query(api.contentFolders.get, { id: testFolderId });
    expect(folder?.name).toBe("Updated Folder");
  });

  it("should reorder folders", async () => {
    // Create another folder to test reordering
    const secondFolderId = await client.mutation(api.contentFolders.create, {
      workspaceId: testWorkspaceId,
      name: "Second Folder",
    });

    await client.mutation(api.contentFolders.reorder, {
      id: secondFolderId,
      newOrder: 1,
    });

    const folders = await client.query(api.contentFolders.list, {
      workspaceId: testWorkspaceId,
    });

    const reorderedFolder = folders.find(
      (f: { _id: Id<"contentFolders"> }) => f._id === secondFolderId
    );
    expect(reorderedFolder?.order).toBe(1);
  });

  it("should prevent circular reference when moving folder", async () => {
    await expect(
      client.mutation(api.contentFolders.update, {
        id: testFolderId,
        parentId: childFolderId,
      })
    ).rejects.toThrow();
  });

  it("should delete a folder and move contents", async () => {
    const result = await client.mutation(api.contentFolders.remove, {
      id: childFolderId,
    });

    expect(result.success).toBe(true);

    const folder = await client.query(api.contentFolders.get, { id: childFolderId });
    expect(folder).toBeNull();
  });
});
