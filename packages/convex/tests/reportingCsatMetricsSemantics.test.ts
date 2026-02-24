import { beforeEach, describe, expect, it, vi } from "vitest";
import { Id } from "../convex/_generated/dataModel";

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

import { getAuthenticatedUserFromSession } from "../convex/auth";
import { requirePermission } from "../convex/permissions";
import { getCsatMetrics } from "../convex/reporting";

const mockGetAuthenticatedUserFromSession = vi.mocked(getAuthenticatedUserFromSession);
const mockRequirePermission = vi.mocked(requirePermission);

type CsatResponseRecord = {
  _id: Id<"csatResponses">;
  workspaceId: Id<"workspaces">;
  conversationId: Id<"conversations">;
  rating: number;
  createdAt: number;
};

function makeCsatMetricsContext(responses: CsatResponseRecord[]) {
  return {
    db: {
      query: (table: string) => {
        if (table !== "csatResponses") {
          throw new Error(`Unexpected table: ${table}`);
        }

        return {
          withIndex: (
            _indexName: string,
            builder: (q: { eq: (field: string, value: unknown) => unknown }) => unknown
          ) => {
            const queryBuilder = {
              eq: () => queryBuilder,
            };
            builder(queryBuilder);

            return {
              order: () => ({
                take: async () => responses,
              }),
            };
          },
        };
      },
    },
  };
}

describe("reporting CSAT metrics semantics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetAuthenticatedUserFromSession.mockResolvedValue({
      _id: "user_reporting_metrics" as Id<"users">,
    } as any);
    mockRequirePermission.mockResolvedValue(undefined as never);
  });

  it("updates totals, average, and distribution after an additional CSAT submission", async () => {
    const workspaceId = "workspace_reporting_metrics" as Id<"workspaces">;
    const now = Date.now();
    const args = {
      workspaceId,
      startDate: now - 60_000,
      endDate: now + 60_000,
      granularity: "day" as const,
    };

    const beforeContext = makeCsatMetricsContext([
      {
        _id: "csat_before_1" as Id<"csatResponses">,
        workspaceId,
        conversationId: "conversation_metrics_1" as Id<"conversations">,
        rating: 3,
        createdAt: now - 5_000,
      },
    ]);
    const before = await getCsatMetrics._handler(beforeContext as any, args);

    expect(before.totalResponses).toBe(1);
    expect(before.averageRating).toBe(3);
    expect(before.ratingDistribution[3]).toBe(1);
    expect(before.satisfactionRate).toBe(0);

    const afterContext = makeCsatMetricsContext([
      {
        _id: "csat_before_1" as Id<"csatResponses">,
        workspaceId,
        conversationId: "conversation_metrics_1" as Id<"conversations">,
        rating: 3,
        createdAt: now - 5_000,
      },
      {
        _id: "csat_after_2" as Id<"csatResponses">,
        workspaceId,
        conversationId: "conversation_metrics_2" as Id<"conversations">,
        rating: 5,
        createdAt: now - 1_000,
      },
    ]);
    const after = await getCsatMetrics._handler(afterContext as any, args);

    expect(after.totalResponses).toBe(2);
    expect(after.averageRating).toBe(4);
    expect(after.ratingDistribution[3]).toBe(1);
    expect(after.ratingDistribution[5]).toBe(1);
    expect(after.satisfactionRate).toBe(0.5);
    expect(after.trendByPeriod.length).toBeGreaterThan(0);
  });
});
