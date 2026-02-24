import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("messengerSettings", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;
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

  it("admin settings reads are hidden for unauthenticated callers", async () => {
    const settings = await client.query(api.messengerSettings.get, {
      workspaceId: testWorkspaceId,
    });
    expect(settings).toBeNull();

    const settingsOrCreate = await client.query(api.messengerSettings.getOrCreate, {
      workspaceId: testWorkspaceId,
    });
    expect(settingsOrCreate).toBeNull();
  });

  it("public widget settings remain available", async () => {
    const settings = await client.query(api.messengerSettings.getPublicSettings, {
      workspaceId: testWorkspaceId,
    });

    expect(settings.primaryColor).toBe("#792cd4");
    expect(settings.themeMode).toBe("system");
    expect(settings.launcherPosition).toBe("right");
  });

  it("admin settings writes require authentication", async () => {
    await expect(
      client.mutation(api.messengerSettings.upsert, {
        workspaceId: testWorkspaceId,
        primaryColor: "#ff5500",
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("home config public reads remain available", async () => {
    const homeConfig = await client.query(api.messengerSettings.getHomeConfig, {
      workspaceId: testWorkspaceId,
    });
    expect(homeConfig.enabled).toBe(true);
    expect(homeConfig.cards.length).toBeGreaterThan(0);

    const publicHomeConfig = await client.query(api.messengerSettings.getPublicHomeConfig, {
      workspaceId: testWorkspaceId,
      isIdentified: false,
    });
    expect(publicHomeConfig.enabled).toBe(true);
    expect(publicHomeConfig.cards.length).toBeGreaterThan(0);
  });

  it("home config mutations require authentication", async () => {
    await expect(
      client.mutation(api.messengerSettings.updateHomeConfig, {
        workspaceId: testWorkspaceId,
        homeConfig: {
          enabled: true,
          cards: [{ id: "welcome-1", type: "welcome", visibleTo: "all" }],
          defaultSpace: "home",
        },
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.mutation(api.messengerSettings.toggleHomeEnabled, {
        workspaceId: testWorkspaceId,
        enabled: false,
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.mutation(api.messengerSettings.addHomeCard, {
        workspaceId: testWorkspaceId,
        card: { id: "search-1", type: "search", visibleTo: "all" },
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.mutation(api.messengerSettings.reorderHomeCards, {
        workspaceId: testWorkspaceId,
        cardIds: ["welcome-1"],
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.mutation(api.messengerSettings.updateHomeCard, {
        workspaceId: testWorkspaceId,
        cardId: "welcome-1",
        updates: { visibleTo: "users" },
      })
    ).rejects.toThrow("Not authenticated");
  });
});
