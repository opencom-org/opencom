import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Id } from "../convex/_generated/dataModel";

vi.mock("../convex/auth", () => ({
  getAuthenticatedUserFromSession: vi.fn(),
}));

vi.mock("../convex/permissions", async () => {
  const actual =
    await vi.importActual<typeof import("../convex/permissions")>("../convex/permissions");
  return {
    ...actual,
    requirePermission: vi.fn(),
  };
});

vi.mock("../convex/widgetSessions", async () => {
  const actual = await vi.importActual<typeof import("../convex/widgetSessions")>(
    "../convex/widgetSessions"
  );
  return {
    ...actual,
    resolveVisitorFromSession: vi.fn(),
  };
});

import { getAuthenticatedUserFromSession } from "../convex/auth";
import { requirePermission } from "../convex/permissions";
import * as emailChannel from "../convex/emailChannel";
import * as tickets from "../convex/tickets";
import * as tours from "../convex/tours";

const mockGetAuthenticatedUserFromSession = vi.mocked(getAuthenticatedUserFromSession);
const mockRequirePermission = vi.mocked(requirePermission);

function fakeId<T extends string>(prefix: T): Id<any> {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}` as Id<any>;
}

function readConvexSourceFile(fileName: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", "convex", fileName), "utf8");
}

describe("convex hotpath regression checks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("batches tickets list enrichment by unique related IDs", async () => {
    const workspaceId = fakeId("workspace");
    const visitorA = fakeId("visitor");
    const visitorB = fakeId("visitor");
    const assigneeA = fakeId("user");
    const assigneeB = fakeId("user");

    mockGetAuthenticatedUserFromSession.mockResolvedValue({ _id: fakeId("user") } as any);
    mockRequirePermission.mockResolvedValue(undefined as never);

    const ticketRows = [
      { _id: fakeId("ticket"), workspaceId, visitorId: visitorA, assigneeId: assigneeA },
      { _id: fakeId("ticket"), workspaceId, visitorId: visitorA, assigneeId: assigneeB },
      { _id: fakeId("ticket"), workspaceId, visitorId: visitorB, assigneeId: assigneeB },
      { _id: fakeId("ticket"), workspaceId, visitorId: visitorB, assigneeId: assigneeA },
    ];

    const dbGet = vi.fn(async (id: string) => {
      if (id === visitorA || id === visitorB) {
        return { _id: id, name: `Visitor ${id}` };
      }
      if (id === assigneeA || id === assigneeB) {
        return { _id: id, name: `Agent ${id}` };
      }
      return null;
    });

    const ctx = {
      db: {
        query: vi.fn((table: string) => {
          if (table !== "tickets") {
            throw new Error(`Unexpected table query: ${table}`);
          }
          return {
            withIndex: () => ({
              order: () => ({
                collect: async () => ticketRows,
              }),
            }),
          };
        }),
        get: dbGet,
      },
    };

    const ticketsList = tickets.list as unknown as {
      _handler: (ctx: unknown, args: { workspaceId: Id<"workspaces"> }) => Promise<unknown[]>;
    };

    const result = await ticketsList._handler(ctx as any, { workspaceId });

    expect(result).toHaveLength(ticketRows.length);
    expect(dbGet).toHaveBeenCalledTimes(4);
  });

  it("uses workspace-scoped step batch in tours.listAll when metadata exists", async () => {
    const workspaceId = fakeId("workspace");
    const tourA = fakeId("tour");
    const tourB = fakeId("tour");

    mockGetAuthenticatedUserFromSession.mockResolvedValue({ _id: fakeId("user") } as any);
    mockRequirePermission.mockResolvedValue(undefined as never);

    const indexCalls: string[] = [];

    const ctx = {
      db: {
        query: vi.fn((table: string) => {
          if (table === "tours") {
            return {
              withIndex: (indexName: string) => {
                indexCalls.push(`tours:${indexName}`);
                return {
                  collect: async () => [
                    { _id: tourA, workspaceId, status: "active", priority: 0 },
                    { _id: tourB, workspaceId, status: "active", priority: 1 },
                  ],
                };
              },
            };
          }

          if (table === "tourSteps") {
            return {
              withIndex: (indexName: string) => {
                indexCalls.push(`tourSteps:${indexName}`);
                if (indexName === "by_workspace") {
                  return {
                    collect: async () => [
                      {
                        _id: fakeId("step"),
                        workspaceId,
                        tourId: tourA,
                        order: 0,
                        type: "post",
                        content: "A0",
                      },
                      {
                        _id: fakeId("step"),
                        workspaceId,
                        tourId: tourB,
                        order: 0,
                        type: "post",
                        content: "B0",
                      },
                    ],
                  };
                }
                return {
                  collect: async () => [],
                };
              },
            };
          }

          throw new Error(`Unexpected table query: ${table}`);
        }),
      },
    };

    const toursListAll = tours.listAll as unknown as {
      _handler: (ctx: unknown, args: { workspaceId: Id<"workspaces"> }) => Promise<unknown[]>;
    };

    const result = await toursListAll._handler(ctx as any, { workspaceId });

    expect(result).toHaveLength(2);
    expect(indexCalls).toContain("tourSteps:by_workspace");
    expect(indexCalls).not.toContain("tourSteps:by_tour");
  });

  it("keeps webhook delivery-status lookup on indexed message IDs", async () => {
    const conversationId = fakeId("conversation");
    const indexCalls: string[] = [];
    const dbPatch = vi.fn(async () => undefined);

    const ctx = {
      db: {
        query: vi.fn((table: string) => {
          if (table === "emailThreads") {
            return {
              withIndex: (indexName: string) => {
                indexCalls.push(`emailThreads:${indexName}`);
                return {
                  first: async () => ({ conversationId }),
                };
              },
            };
          }

          if (table === "messages") {
            return {
              withIndex: (indexName: string) => {
                indexCalls.push(`messages:${indexName}`);
                if (indexName !== "by_email_message_id") {
                  throw new Error(`Unexpected messages index: ${indexName}`);
                }
                return {
                  first: async () => ({
                    _id: fakeId("message"),
                    conversationId,
                  }),
                };
              },
            };
          }

          throw new Error(`Unexpected table query: ${table}`);
        }),
        patch: dbPatch,
      },
    };

    const updateDeliveryStatusByExternalId =
      emailChannel.updateDeliveryStatusByExternalId as unknown as {
        _handler: (
          ctx: unknown,
          args: { externalEmailId: string; status: "delivered" | "bounced" }
        ) => Promise<{ updated: boolean }>;
      };

    const result = await updateDeliveryStatusByExternalId._handler(ctx as any, {
      externalEmailId: "resend-email-123",
      status: "delivered",
    });

    expect(result.updated).toBe(true);
    expect(indexCalls).toContain("messages:by_email_message_id");
    expect(indexCalls).not.toContain("messages:by_conversation");
    expect(dbPatch).toHaveBeenCalledTimes(1);
  });

  it("keeps tooltip list and availability handlers bounded", () => {
    const source = readConvexSourceFile("tooltips.ts");
    expect(source).toContain('withIndex("by_workspace_updated_at"');
    expect(source).toContain("take(limit)");
    expect(source).toContain("take(evaluationLimit)");
  });

  it("uses indexed date-range lookup for suggestion feedback stats", () => {
    const source = readConvexSourceFile("suggestions.ts");
    expect(source).toContain('withIndex("by_workspace_created_at"');
    expect(source).toContain(".take(limit + 1)");
    expect(source).not.toContain(
      '.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))\n      .collect()'
    );
  });

  it("uses deterministic index-backed workspace lookup for discovery metadata", () => {
    const source = readConvexSourceFile("discovery.ts");
    expect(source).toContain('withIndex("by_created_at")');
    expect(source).toContain(".take(1)");
  });
});
