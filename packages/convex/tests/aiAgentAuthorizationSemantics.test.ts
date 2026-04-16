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
        messageId: "message_auth_1",
        response: "Response 1",
        confidence: 0.8,
      },
      {
        _id: "ai_response_2",
        conversationId,
        messageId: "message_auth_2",
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

  it("exposes delivered and generated contexts with legacy compatibility", async () => {
    const workspaceId = "workspace_agent_traceability" as Id<"workspaces">;
    const conversationId = "conversation_auth_traceability" as Id<"conversations">;
    const responses = [
      {
        _id: "ai_response_handoff_with_candidate",
        conversationId,
        messageId: "message_handoff_1",
        query: "Can you help with billing?",
        response: "Let me connect you with a human specialist.",
        sources: [],
        confidence: 0.22,
        handedOff: true,
        handoffReason: "Low confidence response",
        generatedCandidateResponse:
          "You can manage billing in Settings > Billing, but I should connect you with a specialist.",
        generatedCandidateSources: [
          {
            type: "article",
            id: "billing-guide",
            title: "Billing Guide",
          },
        ],
        generatedCandidateConfidence: 0.22,
      },
      {
        _id: "ai_response_handoff_legacy",
        conversationId,
        messageId: "message_handoff_legacy",
        query: "Can you help with shipping?",
        response: "Let me connect you with a human specialist.",
        sources: [],
        confidence: 0.19,
        handedOff: true,
        handoffReason: "Low confidence response",
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
          visitorId: "visitor_auth_traceability" as Id<"visitors">,
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

    expect(result[0].deliveredResponseContext).toEqual({
      response: "Let me connect you with a human specialist.",
      sources: [],
      confidence: null,
    });
    expect(result[0].generatedResponseContext).toEqual({
      response:
        "You can manage billing in Settings > Billing, but I should connect you with a specialist.",
      sources: [{ type: "article", id: "billing-guide", title: "Billing Guide" }],
      confidence: 0.22,
    });

    expect(result[1].deliveredResponseContext).toEqual({
      response: "Let me connect you with a human specialist.",
      sources: [],
      confidence: null,
    });
    expect(result[1].generatedResponseContext).toBeNull();
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
