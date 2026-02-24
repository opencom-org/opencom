import { v } from "convex/values";
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
import { authMutation } from "../convex/lib/authWrappers";
import { requirePermission } from "../convex/permissions";

const mockGetAuthenticatedUserFromSession = vi.mocked(getAuthenticatedUserFromSession);
const mockRequirePermission = vi.mocked(requirePermission);

const testUser = {
  _id: "user_test_123" as Id<"users">,
  email: "auth-wrapper@test.opencom.dev",
  workspaceId: "workspace_test_123" as Id<"workspaces">,
  role: "admin" as const,
};

describe("auth wrappers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects unauthenticated callers before handler execution", async () => {
    mockGetAuthenticatedUserFromSession.mockResolvedValue(null);
    const handler = vi.fn(async () => ({ ok: true }));

    const wrapped = authMutation({
      args: {
        workspaceId: v.id("workspaces"),
        name: v.string(),
      },
      permission: "settings.workspace",
      handler,
    });

    await expect(
      wrapped._handler({} as any, {
        workspaceId: "workspace_test_123" as Id<"workspaces">,
        name: "Test",
      })
    ).rejects.toThrow("Not authenticated");

    expect(handler).not.toHaveBeenCalled();
    expect(mockRequirePermission).not.toHaveBeenCalled();
  });

  it("rejects non-membership via permission guard", async () => {
    mockGetAuthenticatedUserFromSession.mockResolvedValue(testUser);
    mockRequirePermission.mockRejectedValue(new Error("Not a member of this workspace"));
    const handler = vi.fn(async () => ({ ok: true }));

    const wrapped = authMutation({
      args: {
        workspaceId: v.id("workspaces"),
      },
      permission: "settings.workspace",
      handler,
    });

    await expect(
      wrapped._handler({} as any, {
        workspaceId: testUser.workspaceId,
      })
    ).rejects.toThrow("Not a member of this workspace");

    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects callers missing required permission", async () => {
    mockGetAuthenticatedUserFromSession.mockResolvedValue(testUser);
    mockRequirePermission.mockRejectedValue(new Error("Permission denied: settings.workspace"));
    const handler = vi.fn(async () => ({ ok: true }));

    const wrapped = authMutation({
      args: {
        workspaceId: v.id("workspaces"),
      },
      permission: "settings.workspace",
      handler,
    });

    await expect(
      wrapped._handler({} as any, {
        workspaceId: testUser.workspaceId,
      })
    ).rejects.toThrow("Permission denied: settings.workspace");

    expect(handler).not.toHaveBeenCalled();
  });

  it("injects authenticated user context and supports workspace resolver", async () => {
    mockGetAuthenticatedUserFromSession.mockResolvedValue(testUser);
    mockRequirePermission.mockResolvedValue({} as any);

    const workspaceId = testUser.workspaceId;
    const resolver = vi.fn(async () => workspaceId);

    const wrapped = authMutation({
      args: {
        campaignId: v.id("emailCampaigns"),
      },
      permission: "settings.workspace",
      resolveWorkspaceId: resolver,
      handler: async (ctx, args) => {
        return {
          userId: ctx.user._id,
          campaignId: args.campaignId,
        };
      },
    });

    const result = await wrapped._handler({} as any, {
      campaignId: "campaign_test_123" as Id<"emailCampaigns">,
    });

    expect(result).toEqual({
      userId: testUser._id,
      campaignId: "campaign_test_123",
    });
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      testUser._id,
      workspaceId,
      "settings.workspace"
    );
  });
});
