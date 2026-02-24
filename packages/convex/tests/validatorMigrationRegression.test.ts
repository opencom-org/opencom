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
    hasPermission: vi.fn(),
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
import { hasPermission, requirePermission } from "../convex/permissions";
import { resolveVisitorFromSession } from "../convex/widgetSessions";
import * as events from "../convex/events";
import * as outboundMessages from "../convex/outboundMessages";
import * as surveys from "../convex/surveys";

const mockGetAuthenticatedUserFromSession = vi.mocked(getAuthenticatedUserFromSession);
const mockRequirePermission = vi.mocked(requirePermission);
const mockHasPermission = vi.mocked(hasPermission);
const mockResolveVisitorFromSession = vi.mocked(resolveVisitorFromSession);

function fakeId(prefix: string): Id<any> {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}` as Id<any>;
}

describe("validator migration regression", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetAuthenticatedUserFromSession.mockResolvedValue({ _id: fakeId("user") } as any);
    mockRequirePermission.mockResolvedValue({} as any);
    mockHasPermission.mockResolvedValue(true);
  });

  it("rejects malformed survey audience rules", async () => {
    await expect(
      surveys.create._handler({} as any, {
        workspaceId: fakeId("workspace"),
        name: "CSAT",
        format: "small",
        audienceRules: { invalid: true },
      })
    ).rejects.toThrow("Invalid audience rules");
  });

  it("rejects malformed outbound targeting rules", async () => {
    await expect(
      outboundMessages.create._handler({} as any, {
        workspaceId: fakeId("workspace"),
        type: "chat",
        name: "Launch message",
        content: { text: "Hello" },
        targeting: { invalid: true },
      })
    ).rejects.toThrow("Invalid targeting rules");
  });

  it("accepts structured event properties for track mutation", async () => {
    const workspaceId = fakeId("workspace");
    const visitorId = fakeId("visitor");
    const insert = vi.fn(async () => fakeId("event"));

    mockResolveVisitorFromSession.mockResolvedValue({
      visitorId,
      workspaceId,
      sessionId: "session-1",
    } as any);

    const result = await events.track._handler(
      {
        db: { insert },
        scheduler: { runAfter: vi.fn(async () => undefined) },
      } as any,
      {
        workspaceId,
        sessionToken: "session-1",
        name: "checkout_started",
        properties: {
          page: "/pricing",
          retries: 1,
          premium: false,
          tags: ["billing", "checkout"],
        },
      }
    );

    expect(result).toBeDefined();
    expect(insert).toHaveBeenCalledWith(
      "events",
      expect.objectContaining({
        workspaceId,
        visitorId,
        name: "checkout_started",
      })
    );
  });
});
