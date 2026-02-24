import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";
import {
  cleanupTestData,
  createTestAuditLog,
  updateTestMemberPermissions,
} from "./helpers/testHelpers";

describe("audit logs (real Convex backend)", () => {
  let client: ConvexClient;
  let workspaceId: Id<"workspaces">;
  let userEmail: string;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }

    client = new ConvexClient(convexUrl);
    const auth = await authenticateClientForWorkspace(client);
    workspaceId = auth.workspaceId;
    userEmail = auth.email;
  });

  beforeEach(async () => {
    await updateTestMemberPermissions(client, {
      workspaceId,
      userEmail,
      permissions: [],
    });
  });

  afterAll(async () => {
    if (workspaceId) {
      try {
        await cleanupTestData(client, { workspaceId });
      } catch (error) {
        console.warn("Cleanup failed:", error);
      }
    }
    await client.close();
  });

  it("lists audit logs with action/resource filters and metadata", async () => {
    const timestamp = Date.now();
    await createTestAuditLog({
      workspaceId,
      action: "workspace.security.changed",
      resourceType: "workspace",
      resourceId: workspaceId,
      metadata: {
        setting: "allowedOrigins",
        valueCount: 2,
      },
      timestamp,
    });

    const logs = await client.query(api.auditLogs.list, {
      workspaceId,
      action: "workspace.security.changed",
      resourceType: "workspace",
      resourceId: workspaceId,
      startTime: timestamp - 1000,
      endTime: timestamp + 1000,
      limit: 20,
    });

    expect(logs.length).toBeGreaterThan(0);
    const match = logs.find((entry) => entry.timestamp === timestamp);
    expect(match).toBeDefined();
    expect(match?.action).toBe("workspace.security.changed");
    expect(match?.resourceType).toBe("workspace");
    expect(match?.metadata).toMatchObject({ setting: "allowedOrigins", valueCount: 2 });
  });

  it("rejects list queries when audit.read permission is missing", async () => {
    await updateTestMemberPermissions(client, {
      workspaceId,
      userEmail,
      permissions: ["settings.workspace"],
    });

    await expect(
      client.query(api.auditLogs.list, {
        workspaceId,
      })
    ).rejects.toThrow("Permission denied: audit.read");
  });

  it("rejects export when data.export permission is missing", async () => {
    await updateTestMemberPermissions(client, {
      workspaceId,
      userEmail,
      permissions: ["audit.read"],
    });

    await expect(
      client.query(api.auditLogs.exportLogs, {
        workspaceId,
        format: "json",
      })
    ).rejects.toThrow("Permission denied: data.export");
  });

  it("exports only matching audit entries when authorized", async () => {
    const taggedResourceId = `audit-export-${Date.now()}`;
    await createTestAuditLog({
      workspaceId,
      action: "user.role.changed",
      resourceType: "workspaceMember",
      resourceId: taggedResourceId,
      metadata: { previousRole: "agent", newRole: "admin" },
    });

    const exported = await client.query(api.auditLogs.exportLogs, {
      workspaceId,
      action: "user.role.changed",
      resourceType: "workspaceMember",
      resourceId: taggedResourceId,
      format: "json",
    });

    expect(exported.format).toBe("json");
    expect(exported.count).toBeGreaterThan(0);
    const data = exported.data as Array<{ action: string; resourceId?: string }>;
    expect(data.every((entry) => entry.action === "user.role.changed")).toBe(true);
    expect(data.some((entry) => entry.resourceId === taggedResourceId)).toBe(true);
  });

  it("records canonical export action metadata", async () => {
    const markerCount = 7;
    const startTime = Date.now() - 1000;

    await client.mutation(api.auditLogs.logExport, {
      workspaceId,
      exportType: "auditLogs",
      recordCount: markerCount,
    });

    const logs = await client.query(api.auditLogs.list, {
      workspaceId,
      action: "data.exported",
      resourceType: "auditLogs",
      startTime,
      endTime: Date.now() + 1000,
      limit: 25,
    });

    expect(logs.length).toBeGreaterThan(0);
    const entry = logs.find(
      (log) => (log.metadata as { recordCount?: number } | undefined)?.recordCount === markerCount
    );
    expect(entry).toBeDefined();
    expect(entry?.action).toBe("data.exported");
    expect(entry?.resourceType).toBe("auditLogs");
    expect((entry?.metadata as { recordCount?: number } | undefined)?.recordCount).toBe(
      markerCount
    );
  });
});
