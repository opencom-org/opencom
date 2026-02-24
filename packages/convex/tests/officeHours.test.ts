import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";

type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

const DAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function buildSchedule(
  overrides: Partial<Record<DayOfWeek, { enabled: boolean; startTime: string; endTime: string }>>
) {
  return DAYS.map((day) => {
    const override = overrides[day];
    return {
      day,
      enabled: override?.enabled ?? false,
      startTime: override?.startTime ?? "09:00",
      endTime: override?.endTime ?? "17:00",
    };
  });
}

describe("officeHours timezone-aware evaluation", () => {
  let client: ConvexClient;
  let workspaceId: Id<"workspaces">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL?.trim();
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);
    workspaceId = (await authenticateClientForWorkspace(client)).workspaceId;
  });

  afterAll(async () => {
    if (workspaceId) {
      try {
        await client.mutation(api.testing.helpers.cleanupTestData, { workspaceId });
      } catch (error) {
        console.warn("Cleanup failed:", error);
      }
    }
    await client.close();
  });

  it("evaluates office hours correctly for half-hour offsets", async () => {
    await client.mutation(api.officeHours.upsert, {
      workspaceId,
      timezone: "Asia/Kolkata",
      schedule: buildSchedule({
        wednesday: { enabled: true, startTime: "09:00", endTime: "10:00" },
      }),
      offlineMessage: "Offline",
      expectedReplyTimeMinutes: 30,
    });

    const duringOpenWindow = await client.query(api.officeHours.isCurrentlyOpen, {
      workspaceId,
      // 2025-01-01T04:00:00.000Z = Wednesday 09:30 in Asia/Kolkata
      nowMs: Date.UTC(2025, 0, 1, 4, 0, 0, 0),
    });
    expect(duringOpenWindow.isOpen).toBe(true);

    const afterCloseWindow = await client.query(api.officeHours.isCurrentlyOpen, {
      workspaceId,
      // 2025-01-01T05:00:00.000Z = Wednesday 10:30 in Asia/Kolkata
      nowMs: Date.UTC(2025, 0, 1, 5, 0, 0, 0),
    });
    expect(afterCloseWindow.isOpen).toBe(false);
  });

  it("uses effective DST offset at evaluation time", async () => {
    await client.mutation(api.officeHours.upsert, {
      workspaceId,
      timezone: "America/New_York",
      schedule: buildSchedule({
        sunday: { enabled: true, startTime: "03:00", endTime: "04:00" },
      }),
      offlineMessage: "Offline",
      expectedReplyTimeMinutes: 45,
    });

    const beforeDstJump = await client.query(api.officeHours.isCurrentlyOpen, {
      workspaceId,
      // 2025-03-09T06:30:00.000Z = Sunday 01:30 EST
      nowMs: Date.UTC(2025, 2, 9, 6, 30, 0, 0),
    });
    expect(beforeDstJump.isOpen).toBe(false);

    const afterDstJump = await client.query(api.officeHours.isCurrentlyOpen, {
      workspaceId,
      // 2025-03-09T07:30:00.000Z = Sunday 03:30 EDT
      nowMs: Date.UTC(2025, 2, 9, 7, 30, 0, 0),
    });
    expect(afterDstJump.isOpen).toBe(true);
  });
});
