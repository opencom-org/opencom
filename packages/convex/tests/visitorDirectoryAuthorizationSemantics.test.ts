import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../convex/_generated/dataModel";

vi.mock("../convex/auth", () => ({
  getAuthenticatedUserFromSession: vi.fn(),
}));

vi.mock("../convex/permissions", async () => {
  const actual =
    await vi.importActual<typeof import("../convex/permissions")>("../convex/permissions");
  return {
    ...actual,
    hasPermission: vi.fn(),
    getWorkspaceMembership: vi.fn(),
  };
});

import { getAuthenticatedUserFromSession } from "../convex/auth";
import { hasPermission } from "../convex/permissions";
import { getDirectoryDetail, listDirectory } from "../convex/visitors";

const mockGetAuthenticatedUserFromSession = vi.mocked(getAuthenticatedUserFromSession);
const mockHasPermission = vi.mocked(hasPermission);

function buildVisitorsListContext(visitors: Array<Record<string, unknown>>) {
  return {
    db: {
      query: vi.fn((table: string) => {
        if (table !== "visitors") {
          throw new Error(`Unexpected table ${table}`);
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
              order: () => ({
                take: async () => visitors,
              }),
            };
          },
        };
      }),
    },
  };
}

describe("visitor directory authorization semantics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns unauthenticated status for directory list requests without auth", async () => {
    const workspaceId = "workspace_visitors_unauth" as Id<"workspaces">;
    mockGetAuthenticatedUserFromSession.mockResolvedValue(null);

    const result = await listDirectory._handler(buildVisitorsListContext([]) as any, {
      workspaceId,
    });

    expect(result.status).toBe("unauthenticated");
    expect(result.visitors).toHaveLength(0);
  });

  it("returns forbidden status when users.read permission is missing", async () => {
    const workspaceId = "workspace_visitors_forbidden" as Id<"workspaces">;
    mockGetAuthenticatedUserFromSession.mockResolvedValue({
      _id: "user_no_users_read" as Id<"users">,
    } as any);
    mockHasPermission.mockResolvedValue(false);

    const result = await listDirectory._handler(buildVisitorsListContext([]) as any, {
      workspaceId,
    });

    expect(result.status).toBe("forbidden");
    expect(result.visitors).toHaveLength(0);
  });

  it("matches anonymous visitors when searching by internal visitor id", async () => {
    const workspaceId = "workspace_visitors_lookup" as Id<"workspaces">;
    const targetVisitorId = "visitor_internal_target" as Id<"visitors">;

    mockGetAuthenticatedUserFromSession.mockResolvedValue({
      _id: "user_with_users_read" as Id<"users">,
    } as any);
    mockHasPermission.mockResolvedValue(true);

    const result = await listDirectory._handler(
      buildVisitorsListContext([
        {
          _id: targetVisitorId,
          workspaceId,
          name: undefined,
          email: undefined,
          externalUserId: undefined,
          createdAt: Date.now(),
          firstSeenAt: Date.now(),
          lastSeenAt: Date.now(),
        },
        {
          _id: "visitor_internal_other" as Id<"visitors">,
          workspaceId,
          name: "Other Visitor",
          email: "other@test.opencom.dev",
          externalUserId: "ext_other",
          createdAt: Date.now(),
          firstSeenAt: Date.now(),
          lastSeenAt: Date.now(),
        },
      ]) as any,
      {
        workspaceId,
        search: String(targetVisitorId),
      }
    );

    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      throw new Error("Expected successful directory response");
    }
    expect(result.visitors).toHaveLength(1);
    expect(result.visitors[0]?._id).toBe(targetVisitorId);
  });

  it("matches visitors when searching by readable visitor id", async () => {
    const workspaceId = "workspace_visitors_lookup_readable" as Id<"workspaces">;
    const targetVisitorId = "visitor_readable_target" as Id<"visitors">;
    const readableId = "bright-badgers-42";

    mockGetAuthenticatedUserFromSession.mockResolvedValue({
      _id: "user_with_users_read" as Id<"users">,
    } as any);
    mockHasPermission.mockResolvedValue(true);

    const result = await listDirectory._handler(
      buildVisitorsListContext([
        {
          _id: targetVisitorId,
          workspaceId,
          readableId,
          name: undefined,
          email: undefined,
          externalUserId: undefined,
          createdAt: Date.now(),
          firstSeenAt: Date.now(),
          lastSeenAt: Date.now(),
        },
        {
          _id: "visitor_readable_other" as Id<"visitors">,
          workspaceId,
          readableId: "silent-otters-17",
          name: "Other Visitor",
          email: "other@test.opencom.dev",
          externalUserId: "ext_other",
          createdAt: Date.now(),
          firstSeenAt: Date.now(),
          lastSeenAt: Date.now(),
        },
      ]) as any,
      {
        workspaceId,
        search: readableId,
      }
    );

    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      throw new Error("Expected successful directory response");
    }
    expect(result.visitors).toHaveLength(1);
    expect(result.visitors[0]?._id).toBe(targetVisitorId);
  });

  it("denies cross-workspace visitor detail access", async () => {
    const workspaceId = "workspace_primary" as Id<"workspaces">;
    const foreignWorkspaceId = "workspace_foreign" as Id<"workspaces">;
    const visitorId = "visitor_foreign" as Id<"visitors">;

    mockGetAuthenticatedUserFromSession.mockResolvedValue({
      _id: "user_admin" as Id<"users">,
    } as any);
    mockHasPermission.mockResolvedValue(true);

    const context = {
      db: {
        get: vi.fn(async () => ({
          _id: visitorId,
          workspaceId: foreignWorkspaceId,
        })),
        query: vi.fn(),
      },
    };

    const result = await getDirectoryDetail._handler(context as any, {
      workspaceId,
      visitorId,
    });

    expect(result.status).toBe("forbidden");
    expect(result.visitor).toBeNull();
  });

  it("suppresses linked resources when conversations.read permission is missing", async () => {
    const workspaceId = "workspace_detail" as Id<"workspaces">;
    const visitorId = "visitor_detail" as Id<"visitors">;

    mockGetAuthenticatedUserFromSession.mockResolvedValue({
      _id: "user_limited" as Id<"users">,
    } as any);
    mockHasPermission.mockImplementation(async (_ctx, _userId, _workspaceId, permission) => {
      return permission === "users.read";
    });

    const querySpy = vi.fn();
    const context = {
      db: {
        get: vi.fn(async () => ({
          _id: visitorId,
          workspaceId,
          sessionId: "session_limited",
          createdAt: Date.now(),
        })),
        query: querySpy,
      },
    };

    const result = await getDirectoryDetail._handler(context as any, {
      workspaceId,
      visitorId,
    });

    expect(result.status).toBe("ok");
    expect(result.resourceAccess.conversations).toBe(false);
    expect(result.resourceAccess.tickets).toBe(false);
    expect(result.linkedConversations).toHaveLength(0);
    expect(result.linkedTickets).toHaveLength(0);
    expect(querySpy).not.toHaveBeenCalled();
  });

  it("returns linked conversation and ticket summaries when permitted", async () => {
    const workspaceId = "workspace_detail_allowed" as Id<"workspaces">;
    const visitorId = "visitor_detail_allowed" as Id<"visitors">;
    const conversationId = "conversation_allowed" as Id<"conversations">;
    const ticketId = "ticket_allowed" as Id<"tickets">;

    mockGetAuthenticatedUserFromSession.mockResolvedValue({
      _id: "user_full_access" as Id<"users">,
    } as any);
    mockHasPermission.mockResolvedValue(true);

    const context = {
      db: {
        get: vi.fn(async () => ({
          _id: visitorId,
          workspaceId,
          sessionId: "session_allowed",
          createdAt: Date.now(),
          lastSeenAt: Date.now(),
        })),
        query: vi.fn((table: string) => {
          if (table === "conversations") {
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
                  order: () => ({
                    take: async () => [
                      {
                        _id: conversationId,
                        workspaceId,
                        status: "open",
                        channel: "chat",
                        subject: "Conversation subject",
                        updatedAt: Date.now(),
                        lastMessageAt: Date.now(),
                      },
                    ],
                  }),
                };
              },
            };
          }

          if (table === "messages") {
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
                  order: () => ({
                    first: async () => ({ content: "Most recent visitor message" }),
                  }),
                };
              },
            };
          }

          if (table === "tickets") {
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
                  order: () => ({
                    take: async () => [
                      {
                        _id: ticketId,
                        workspaceId,
                        subject: "Ticket subject",
                        status: "submitted",
                        priority: "normal",
                        updatedAt: Date.now(),
                      },
                    ],
                  }),
                };
              },
            };
          }

          throw new Error(`Unexpected table ${table}`);
        }),
      },
    };

    const result = await getDirectoryDetail._handler(context as any, {
      workspaceId,
      visitorId,
    });

    expect(result.status).toBe("ok");
    expect(result.resourceAccess.conversations).toBe(true);
    expect(result.resourceAccess.tickets).toBe(true);
    expect(result.linkedConversations).toHaveLength(1);
    expect(result.linkedTickets).toHaveLength(1);
  });
});
