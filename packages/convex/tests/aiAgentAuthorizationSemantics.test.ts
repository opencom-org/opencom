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
    getWorkspaceMembership: vi.fn(),
  };
});

vi.mock("../convex/widgetSessions", () => ({
  resolveVisitorFromSession: vi.fn(),
}));

import { getAuthenticatedUserFromSession } from "../convex/auth";
import { requirePermission } from "../convex/permissions";
import { resolveVisitorFromSession } from "../convex/widgetSessions";
import { getConversationResponses } from "../convex/aiAgent";

const mockGetAuthenticatedUserFromSession = vi.mocked(getAuthenticatedUserFromSession);
const mockRequirePermission = vi.mocked(requirePermission);
const mockResolveVisitorFromSession = vi.mocked(resolveVisitorFromSession);

describe("aiAgent authorization semantics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects agent access when conversation read permission is missing", async () => {
    const workspaceId = "workspace_agent_auth" as Id<"workspaces">;
    const conversationId = "conversation_auth_1" as Id<"conversations">;

    mockGetAuthenticatedUserFromSession.mockResolvedValue({
      _id: "user_without_permission" as Id<"users">,
    } as any);
    mockRequirePermission.mockRejectedValue(new Error("Permission denied: conversations.read"));

    const context = {
      db: {
        get: vi.fn(async () => ({
          _id: conversationId,
          workspaceId,
          visitorId: "visitor_auth_1" as Id<"visitors">,
        })),
        query: vi.fn(),
      },
    };

    await expect(
      getConversationResponses._handler(context as any, {
        conversationId,
      })
    ).rejects.toThrow("Permission denied: conversations.read");
  });

  it("returns AI responses for authorized agents", async () => {
    const workspaceId = "workspace_agent_allowed" as Id<"workspaces">;
    const conversationId = "conversation_auth_2" as Id<"conversations">;
    const responses = [
      {
        _id: "ai_response_1",
        conversationId,
        response: "Response 1",
        confidence: 0.8,
      },
      {
        _id: "ai_response_2",
        conversationId,
        response: "Response 2",
        confidence: 0.7,
      },
    ];

    mockGetAuthenticatedUserFromSession.mockResolvedValue({
      _id: "user_with_permission" as Id<"users">,
    } as any);
    mockRequirePermission.mockResolvedValue(undefined as never);

    const context = {
      db: {
        get: vi.fn(async () => ({
          _id: conversationId,
          workspaceId,
          visitorId: "visitor_auth_2" as Id<"visitors">,
        })),
        query: vi.fn((table: string) => {
          if (table !== "aiResponses") {
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
                collect: async () => responses,
              };
            },
          };
        }),
      },
    };

    const result = await getConversationResponses._handler(context as any, {
      conversationId,
    });

    expect(result).toHaveLength(2);
    expect(result[0].conversationId).toBe(conversationId);
  });

  it("rejects visitor requests when session ownership does not match conversation visitor", async () => {
    const workspaceId = "workspace_visitor_auth" as Id<"workspaces">;
    const conversationId = "conversation_auth_3" as Id<"conversations">;

    mockGetAuthenticatedUserFromSession.mockResolvedValue(null);
    mockResolveVisitorFromSession.mockResolvedValue({
      visitorId: "visitor_other" as Id<"visitors">,
      workspaceId,
      sessionId: "session_other",
    } as any);

    const context = {
      db: {
        get: vi.fn(async () => ({
          _id: conversationId,
          workspaceId,
          visitorId: "visitor_owner" as Id<"visitors">,
        })),
        query: vi.fn(),
      },
    };

    await expect(
      getConversationResponses._handler(context as any, {
        conversationId,
        visitorId: "visitor_owner" as Id<"visitors">,
        sessionToken: "session_other",
      })
    ).rejects.toThrow("Not authorized");
  });
});
