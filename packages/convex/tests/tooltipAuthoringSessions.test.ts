import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";
import { cleanupTestData, expireTooltipAuthoringSession } from "./helpers/testHelpers";

describe("tooltipAuthoringSessions", () => {
  let client: ConvexClient;
  let otherClient: ConvexClient;
  let workspaceId: Id<"workspaces">;
  let otherWorkspaceId: Id<"workspaces">;
  let tooltipId: Id<"tooltips">;

  async function createSession(tooltipForSession: Id<"tooltips"> | undefined = tooltipId) {
    return client.mutation(api.tooltipAuthoringSessions.create, {
      workspaceId,
      tooltipId: tooltipForSession,
    });
  }

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);
    otherClient = new ConvexClient(convexUrl);

    workspaceId = (await authenticateClientForWorkspace(client)).workspaceId;
    otherWorkspaceId = (await authenticateClientForWorkspace(otherClient)).workspaceId;

    tooltipId = await client.mutation(api.tooltips.create, {
      workspaceId,
      name: "Test Tooltip",
      elementSelector: "#test-element",
      content: "This is a test tooltip",
      triggerType: "hover",
    });
  });

  afterAll(async () => {
    if (workspaceId) {
      await cleanupTestData(client, { workspaceId }).catch((error) => {
        console.warn("Cleanup failed for primary workspace:", error);
      });
    }
    if (otherWorkspaceId) {
      await cleanupTestData(otherClient, { workspaceId: otherWorkspaceId }).catch((error) => {
        console.warn("Cleanup failed for secondary workspace:", error);
      });
    }
    await client.close();
    await otherClient.close();
  });

  it("creates and validates a workspace-bound authoring session", async () => {
    const session = await createSession();
    expect(session.sessionId).toBeDefined();
    expect(session.token).toHaveLength(32);

    const validation = await client.query(api.tooltipAuthoringSessions.validate, {
      token: session.token,
      workspaceId,
    });

    expect(validation.valid).toBe(true);
    expect(validation.session?.workspaceId).toBe(workspaceId);
    expect(validation.session?.tooltipId).toBe(tooltipId);
  });

  it("rejects invalid tokens", async () => {
    const validation = await client.query(api.tooltipAuthoringSessions.validate, {
      token: "invalid-token-12345",
      workspaceId,
    });

    expect(validation.valid).toBe(false);
    expect(validation.reason).toBe("Session not found");
  });

  it("rejects cross-workspace token usage", async () => {
    const session = await createSession();

    const validation = await client.query(api.tooltipAuthoringSessions.validate, {
      token: session.token,
      workspaceId: otherWorkspaceId,
    });
    expect(validation.valid).toBe(false);
    expect(validation.reason).toBe("Session workspace mismatch");

    await expect(
      client.mutation(api.tooltipAuthoringSessions.updateSelector, {
        token: session.token,
        workspaceId: otherWorkspaceId,
        elementSelector: "#cross-workspace",
      })
    ).rejects.toThrow("Session workspace mismatch");

    await expect(
      client.mutation(api.tooltipAuthoringSessions.end, {
        token: session.token,
        workspaceId: otherWorkspaceId,
      })
    ).rejects.toThrow("Session workspace mismatch");
  });

  it("updates selector and persists quality metadata", async () => {
    const session = await createSession();
    const selectorQuality = {
      score: 88,
      grade: "good" as const,
      warnings: [],
      signals: {
        matchCount: 1,
        depth: 2,
        usesNth: false,
        hasId: true,
        hasDataAttribute: false,
        classCount: 1,
        usesWildcard: false,
      },
    };

    const result = await client.mutation(api.tooltipAuthoringSessions.updateSelector, {
      token: session.token,
      workspaceId,
      elementSelector: "#updated-selector",
      selectorQuality,
    });

    expect(result.success).toBe(true);
    expect(result.selector).toBe("#updated-selector");
    expect(result.selectorQuality?.score).toBe(88);

    const validation = await client.query(api.tooltipAuthoringSessions.validate, {
      token: session.token,
      workspaceId,
    });
    expect(validation.session?.selectedSelector).toBe("#updated-selector");
    expect(validation.session?.selectedSelectorQuality?.score).toBe(88);

    const tooltips = await client.query(api.tooltips.list, { workspaceId });
    const updated = tooltips.find((tooltip) => tooltip._id === tooltipId);
    expect(updated?.elementSelector).toBe("#updated-selector");
    expect(updated?.selectorQuality?.score).toBe(88);
  });

  it("rejects updates after completion", async () => {
    const session = await createSession();
    await client.mutation(api.tooltipAuthoringSessions.end, {
      token: session.token,
      workspaceId,
    });

    await expect(
      client.mutation(api.tooltipAuthoringSessions.updateSelector, {
        token: session.token,
        workspaceId,
        elementSelector: "#should-fail",
      })
    ).rejects.toThrow("Session is completed");
  });

  it("rejects expired sessions for validate/update/complete operations", async () => {
    const session = await createSession();
    await expireTooltipAuthoringSession(client, { token: session.token, workspaceId });

    const validation = await client.query(api.tooltipAuthoringSessions.validate, {
      token: session.token,
      workspaceId,
    });
    expect(validation.valid).toBe(false);
    expect(validation.reason).toBe("Session expired");

    await expect(
      client.mutation(api.tooltipAuthoringSessions.updateSelector, {
        token: session.token,
        workspaceId,
        elementSelector: "#expired",
      })
    ).rejects.toThrow("Session expired");

    await expect(
      client.mutation(api.tooltipAuthoringSessions.end, {
        token: session.token,
        workspaceId,
      })
    ).rejects.toThrow("Session expired");
  });

  it("supports sessions without tooltip id for new tooltip creation flows", async () => {
    const session = await client.mutation(api.tooltipAuthoringSessions.create, {
      workspaceId,
    });
    const validation = await client.query(api.tooltipAuthoringSessions.validate, {
      token: session.token,
      workspaceId,
    });

    expect(validation.valid).toBe(true);
    expect(validation.session?.tooltipId).toBeUndefined();
    expect(validation.tooltip).toBeNull();
  });
});
