import { beforeEach, describe, expect, it, vi } from "vitest";
import { Id } from "../convex/_generated/dataModel";

vi.mock("../convex/auth", () => ({
  getAuthenticatedUserFromSession: vi.fn(),
}));

vi.mock("../convex/widgetSessions", async () => {
  const actual = await vi.importActual<typeof import("../convex/widgetSessions")>(
    "../convex/widgetSessions"
  );
  return {
    ...actual,
    resolveVisitorFromSession: vi.fn(),
  };
});

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
import { resolveVisitorFromSession } from "../convex/widgetSessions";
import * as tickets from "../convex/tickets";
import * as tours from "../convex/tours";
import * as aiAgent from "../convex/aiAgent";

const mockGetAuthenticatedUserFromSession = vi.mocked(getAuthenticatedUserFromSession);
const mockRequirePermission = vi.mocked(requirePermission);
const mockResolveVisitorFromSession = vi.mocked(resolveVisitorFromSession);

function fakeId<T extends string>(prefix: T): Id<any> {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}` as Id<any>;
}

describe("auth wrapper migration regression coverage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects unauthenticated ticket creation when session guard fails", async () => {
    mockGetAuthenticatedUserFromSession.mockResolvedValue(null);
    mockResolveVisitorFromSession.mockRejectedValue(new Error("Session token required"));

    await expect(
      tickets.create._handler({} as any, {
        workspaceId: fakeId("workspace"),
        subject: "Need help",
      })
    ).rejects.toThrow("Session token required");

    expect(mockRequirePermission).not.toHaveBeenCalled();
  });

  it("rejects cross-workspace visitor listing for tickets", async () => {
    const workspaceId = fakeId("workspace");
    const visitorId = fakeId("visitor");

    mockGetAuthenticatedUserFromSession.mockResolvedValue(null);
    mockResolveVisitorFromSession.mockResolvedValue({
      visitorId,
      workspaceId,
      sessionId: "session-1",
    } as any);

    const ctx = {
      db: {
        get: vi.fn(async () => ({ _id: visitorId, workspaceId: fakeId("workspace") })),
      },
    };

    await expect(
      tickets.listByVisitor._handler(ctx as any, {
        workspaceId,
        visitorId,
        sessionToken: "valid-session",
      })
    ).rejects.toThrow("Visitor not found in workspace");
  });

  it("rejects ticket creation when authenticated caller lacks permission", async () => {
    const workspaceId = fakeId("workspace");

    mockGetAuthenticatedUserFromSession.mockResolvedValue({
      _id: fakeId("user"),
    } as any);
    mockRequirePermission.mockRejectedValue(new Error("Permission denied: conversations.reply"));

    await expect(
      tickets.create._handler({} as any, {
        workspaceId,
        subject: "Need help",
      })
    ).rejects.toThrow("Permission denied: conversations.reply");
  });

  it("accepts authorized visitor ticket comments and normalizes author metadata", async () => {
    const workspaceId = fakeId("workspace");
    const visitorId = fakeId("visitor");
    const ticketId = fakeId("ticket");

    mockGetAuthenticatedUserFromSession.mockResolvedValue(null);
    mockResolveVisitorFromSession.mockResolvedValue({
      visitorId,
      workspaceId,
      sessionId: "session-1",
    } as any);

    const insert = vi.fn(async () => fakeId("comment"));
    const patch = vi.fn(async () => undefined);

    const ctx = {
      db: {
        get: vi.fn(async (id: Id<any>) => {
          if (id === ticketId) {
            return { _id: ticketId, workspaceId, visitorId, assigneeId: undefined };
          }
          return null;
        }),
        insert,
        patch,
      },
      scheduler: {
        runAfter: vi.fn(async () => undefined),
      },
    };

    const commentId = await tickets.addComment._handler(ctx as any, {
      ticketId,
      visitorId,
      sessionToken: "valid-session",
      content: "Customer follow-up",
      authorId: fakeId("user"),
      authorType: "agent",
      isInternal: true,
    });

    expect(commentId).toBeDefined();
    expect(insert).toHaveBeenCalledWith(
      "ticketComments",
      expect.objectContaining({
        authorId: visitorId,
        authorType: "visitor",
        isInternal: false,
      })
    );
  });

  it("rejects tour list access when authenticated user lacks tours permission", async () => {
    const workspaceId = fakeId("workspace");

    mockGetAuthenticatedUserFromSession.mockResolvedValue({
      _id: fakeId("user"),
    } as any);
    mockRequirePermission.mockRejectedValue(new Error("Permission denied: tours.manage"));

    await expect(
      tours.listAll._handler({} as any, {
        workspaceId,
      })
    ).rejects.toThrow("Permission denied: tours.manage");
  });

  it("rejects AI conversation reads for mismatched visitor session ownership", async () => {
    const workspaceId = fakeId("workspace");
    const conversationId = fakeId("conversation");
    const ownerVisitorId = fakeId("visitor");

    mockGetAuthenticatedUserFromSession.mockResolvedValue(null);
    mockResolveVisitorFromSession.mockResolvedValue({
      visitorId: fakeId("visitor"),
      workspaceId,
      sessionId: "session-2",
    } as any);

    const ctx = {
      db: {
        get: vi.fn(async () => ({
          _id: conversationId,
          workspaceId,
          visitorId: ownerVisitorId,
        })),
      },
    };

    await expect(
      aiAgent.getConversationResponses._handler(ctx as any, {
        conversationId,
        visitorId: ownerVisitorId,
        sessionToken: "session-2",
      })
    ).rejects.toThrow("Not authorized");
  });
});
