import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";

describe("tooltips", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testTooltipId: Id<"tooltips">;

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

  it("should create a tooltip", async () => {
    testTooltipId = await client.mutation(api.tooltips.create, {
      workspaceId: testWorkspaceId,
      name: "Help Button Tooltip",
      elementSelector: "#help-button",
      content: "Click here for help",
      triggerType: "hover",
    });

    expect(testTooltipId).toBeDefined();
  });

  it("should list tooltips for workspace", async () => {
    const tooltips = await client.query(api.tooltips.list, {
      workspaceId: testWorkspaceId,
    });

    expect(tooltips).toBeDefined();
    expect(tooltips.length).toBeGreaterThan(0);
    expect(tooltips.some((t: { _id: Id<"tooltips"> }) => t._id === testTooltipId)).toBe(true);
  });

  it("should update a tooltip", async () => {
    await client.mutation(api.tooltips.update, {
      id: testTooltipId,
      content: "Updated help content",
      triggerType: "click",
    });

    const tooltips = await client.query(api.tooltips.list, {
      workspaceId: testWorkspaceId,
    });
    const updated = tooltips.find((t: { _id: Id<"tooltips"> }) => t._id === testTooltipId);

    expect(updated?.content).toBe("Updated help content");
    expect(updated?.triggerType).toBe("click");
  });

  it("should delete a tooltip", async () => {
    const result = await client.mutation(api.tooltips.remove, { id: testTooltipId });

    expect(result.success).toBe(true);

    const tooltips = await client.query(api.tooltips.list, {
      workspaceId: testWorkspaceId,
    });

    expect(tooltips.some((t: { _id: Id<"tooltips"> }) => t._id === testTooltipId)).toBe(false);
  });
});
