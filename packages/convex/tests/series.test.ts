import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import {
  cleanupTestData,
  createTestSeries,
  createTestVisitor,
  createTestWorkspace,
} from "./helpers/testHelpers";

describe("series authorization", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testVisitorId: Id<"visitors">;
  let testSeriesId: Id<"series">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    const workspace = await createTestWorkspace(client);
    testWorkspaceId = workspace.workspaceId;

    const visitor = await createTestVisitor(client, {
      workspaceId: testWorkspaceId,
    });
    testVisitorId = visitor.visitorId;

    const series = await createTestSeries(client, {
      workspaceId: testWorkspaceId,
      status: "active",
    });
    testSeriesId = series.seriesId;
  });

  afterAll(async () => {
    if (testWorkspaceId) {
      try {
        await cleanupTestData(client, { workspaceId: testWorkspaceId });
      } catch (e) {
        console.warn("Cleanup failed:", e);
      }
    }
    await client.close();
  });

  it("read endpoints are blocked for unauthenticated callers", async () => {
    const series = await client.query(api.series.get, { id: testSeriesId });
    expect(series).toBeNull();

    const seriesList = await client.query(api.series.list, {
      workspaceId: testWorkspaceId,
    });
    expect(seriesList).toEqual([]);

    const withBlocks = await client.query(api.series.getWithBlocks, {
      id: testSeriesId,
    });
    expect(withBlocks).toBeNull();

    await expect(client.query(api.series.getStats, { id: testSeriesId })).rejects.toThrow(
      "Permission denied: settings.workspace"
    );
  });

  it("write endpoints require authentication", async () => {
    await expect(
      client.mutation(api.series.create, {
        workspaceId: testWorkspaceId,
        name: "Unauthorized series",
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.mutation(api.series.update, {
        id: testSeriesId,
        name: "Unauthorized update",
      })
    ).rejects.toThrow("Not authenticated");

    await expect(client.mutation(api.series.activate, { id: testSeriesId })).rejects.toThrow(
      "Not authenticated"
    );

    await expect(client.mutation(api.series.pause, { id: testSeriesId })).rejects.toThrow(
      "Not authenticated"
    );
  });

  it("block and connection mutations require authentication", async () => {
    await expect(
      client.mutation(api.series.addBlock, {
        seriesId: testSeriesId,
        type: "wait",
        position: { x: 10, y: 10 },
        config: {
          waitType: "duration",
          waitDuration: 1,
          waitUnit: "minutes",
        },
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("visitor progression mutation is internal-only", async () => {
    await expect(
      client.mutation("series:evaluateEntry" as never, {
        seriesId: testSeriesId,
        visitorId: testVisitorId,
      })
    ).rejects.toThrow("Could not find public function");
  });
});
