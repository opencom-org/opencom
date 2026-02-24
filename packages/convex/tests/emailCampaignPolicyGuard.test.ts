import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

import { getAuthenticatedUserFromSession } from "../convex/auth";
import { requirePermission } from "../convex/permissions";
import { send } from "../convex/emailCampaigns";

const mockGetAuthenticatedUserFromSession = vi.mocked(getAuthenticatedUserFromSession);
const mockRequirePermission = vi.mocked(requirePermission);

const POLICY_ENV = "OPENCOM_DEMO_BLOCKED_EMAIL_CAMPAIGN_WORKSPACE_IDS";
const originalPolicyEnv = process.env[POLICY_ENV];

function createWorkspaceId(value: string): Id<"workspaces"> {
  return value as Id<"workspaces">;
}

describe("email campaign send policy guard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetAuthenticatedUserFromSession.mockResolvedValue({
      _id: "user_policy_guard" as Id<"users">,
      workspaceId: createWorkspaceId("workspace_policy_guard_user"),
      email: "agent@opencom.dev",
      role: "admin",
    } as any);
    mockRequirePermission.mockResolvedValue({} as never);
  });

  afterEach(() => {
    if (originalPolicyEnv === undefined) {
      delete process.env[POLICY_ENV];
      return;
    }
    process.env[POLICY_ENV] = originalPolicyEnv;
  });

  it("rejects sends for configured demo workspaces with explicit policy errors", async () => {
    const blockedWorkspaceId = createWorkspaceId("workspace_demo_blocked");
    const campaignId = "campaign_blocked" as Id<"emailCampaigns">;
    process.env[POLICY_ENV] = `${blockedWorkspaceId},workspace_other`;

    const query = vi.fn();
    const insert = vi.fn();
    const patch = vi.fn();

    const context = {
      db: {
        get: vi.fn(async () => ({
          _id: campaignId,
          workspaceId: blockedWorkspaceId,
          status: "draft",
        })),
        query,
        insert,
        patch,
      },
    };

    await expect(
      send._handler(context as any, {
        id: campaignId,
      })
    ).rejects.toThrow("EMAIL_CAMPAIGN_SEND_BLOCKED_BY_POLICY");

    expect(query).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it("allows sends for workspaces not listed in the demo guard config", async () => {
    const allowedWorkspaceId = createWorkspaceId("workspace_demo_allowed");
    const campaignId = "campaign_allowed" as Id<"emailCampaigns">;
    process.env[POLICY_ENV] = "workspace_demo_blocked";

    const insert = vi.fn(async () => "recipient_1");
    const patch = vi.fn(async () => undefined);

    const visitors = [
      {
        _id: "visitor_1" as Id<"visitors">,
        email: "visitor@opencom.dev",
      },
    ];

    const context = {
      db: {
        get: vi.fn(async () => ({
          _id: campaignId,
          workspaceId: allowedWorkspaceId,
          status: "draft",
        })),
        query: vi.fn((table: string) => {
          if (table !== "visitors") {
            throw new Error(`Unexpected table: ${table}`);
          }
          return {
            withIndex: (
              _index: string,
              builder: (q: { eq: (field: string, value: unknown) => unknown }) => unknown
            ) => {
              const q = {
                eq: () => q,
              };
              builder(q);
              return {
                take: async () => visitors,
              };
            },
          };
        }),
        insert,
        patch,
      },
    };

    const result = await send._handler(context as any, {
      id: campaignId,
    });

    expect(result.recipientCount).toBe(1);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith(
      campaignId,
      expect.objectContaining({
        status: "sending",
        recipientCount: 1,
      })
    );
  });
});
