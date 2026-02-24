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
    hasPermission: vi.fn(),
  };
});

import { getAuthenticatedUserFromSession } from "../convex/auth";
import { hasPermission } from "../convex/permissions";
import { listForInbox, normalizeInboxAIWorkflowState } from "../convex/conversations";
import { buildInboxFixture } from "./helpers/inboxFixtures";

const mockGetAuthenticatedUserFromSession = vi.mocked(getAuthenticatedUserFromSession);
const mockHasPermission = vi.mocked(hasPermission);

type InboxConversationRecord = {
  _id: Id<"conversations">;
  workspaceId: Id<"workspaces">;
  visitorId?: Id<"visitors">;
  status: "open" | "closed" | "snoozed";
  createdAt: number;
  updatedAt: number;
  lastMessageAt?: number;
  unreadByAgent?: number;
  unreadByVisitor?: number;
  aiWorkflowState?: "none" | "ai_handled" | "handoff";
  aiHandoffReason?: string;
  aiLastConfidence?: number;
  aiLastResponseAt?: number;
};

function makeMessageQuery(messageByConversationId: Map<string, { _id: string; content: string }>) {
  return {
    withIndex: (
      _index: string,
      builder: (q: { eq: (field: string, value: unknown) => unknown }) => unknown
    ) => {
      let conversationId: string | null = null;
      const queryBuilder = {
        eq: (_field: string, value: unknown) => {
          conversationId = String(value);
          return queryBuilder;
        },
      };
      builder(queryBuilder);
      return {
        order: () => ({
          first: async () => {
            if (!conversationId) {
              return null;
            }
            return messageByConversationId.get(conversationId) ?? null;
          },
        }),
      };
    },
  };
}

function makeListForInboxContext(conversations: InboxConversationRecord[]) {
  const calledIndexes: string[] = [];
  const visitors = new Map(
    conversations
      .filter((conversation) => conversation.visitorId)
      .map((conversation) => [
        conversation.visitorId!.toString(),
        {
          _id: conversation.visitorId,
          workspaceId: conversation.workspaceId,
          name: `Visitor ${conversation._id.slice(-4)}`,
        },
      ])
  );

  const messageByConversationId = new Map(
    conversations.map((conversation) => [
      conversation._id.toString(),
      {
        _id: `msg_${conversation._id}`,
        content: `Latest ${conversation._id}`,
      },
    ])
  );

  const context = {
    db: {
      query: (table: string) => {
        if (table === "conversations") {
          return {
            withIndex: (
              indexName: string,
              builder: (q: { eq: (field: string, value: unknown) => unknown }) => unknown
            ) => {
              calledIndexes.push(indexName);
              const q = {
                eq: () => q,
              };
              builder(q);
              return {
                order: () => ({
                  take: async () => conversations,
                }),
              };
            },
          };
        }

        if (table === "messages") {
          return makeMessageQuery(messageByConversationId);
        }

        throw new Error(`Unexpected table: ${table}`);
      },
      get: async (id: Id<"visitors">) => visitors.get(id.toString()) ?? null,
    },
  };

  return { context, calledIndexes };
}

describe("inbox AI workflow semantics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetAuthenticatedUserFromSession.mockResolvedValue({
      _id: "user_ai_workflow_tester" as Id<"users">,
    } as any);
    mockHasPermission.mockResolvedValue(true);
  });

  it("normalizes missing AI workflow fields to safe defaults", () => {
    expect(normalizeInboxAIWorkflowState({})).toEqual({
      state: "none",
      handoffReason: null,
      confidence: null,
      lastResponseAt: null,
    });
  });

  it("uses workspace+state+status index for handoff filters and returns normalized workflow metadata", async () => {
    const fixture = buildInboxFixture({
      workspaceId: "workspace_ai_filter" as Id<"workspaces">,
      conversationCount: 8,
    });
    const conversations = fixture.conversations.map((conversation, index) => {
      if (index % 2 === 0) {
        return {
          ...conversation,
          status: "open" as const,
          aiWorkflowState: "handoff" as const,
          aiHandoffReason: `Reason ${index}`,
          aiLastConfidence: 0.35,
          aiLastResponseAt: conversation.lastMessageAt,
        };
      }
      return {
        ...conversation,
        status: "open" as const,
        aiWorkflowState: "ai_handled" as const,
        aiLastConfidence: 0.9,
        aiLastResponseAt: conversation.lastMessageAt,
      };
    });
    const { context, calledIndexes } = makeListForInboxContext(conversations);

    const result = await listForInbox._handler(context as any, {
      workspaceId: fixture.workspaceId,
      status: "open",
      aiWorkflowState: "handoff",
      limit: 20,
    });

    expect(calledIndexes).toContain("by_workspace_ai_state_status");
    expect(result.conversations.length).toBeGreaterThan(0);
    expect(
      result.conversations.every(
        (conversation) =>
          conversation.aiWorkflow.state === "handoff" &&
          conversation.aiWorkflow.handoffReason !== null
      )
    ).toBe(true);
  });

  it("uses workspace+state index when filtering only by AI workflow state", async () => {
    const fixture = buildInboxFixture({
      workspaceId: "workspace_ai_state_only" as Id<"workspaces">,
      conversationCount: 6,
    });
    const conversations = fixture.conversations.map((conversation, index) => ({
      ...conversation,
      aiWorkflowState: index % 2 === 0 ? ("ai_handled" as const) : ("none" as const),
      aiLastConfidence: index % 2 === 0 ? 0.82 : undefined,
      aiLastResponseAt: index % 2 === 0 ? conversation.lastMessageAt : undefined,
    }));

    const { context, calledIndexes } = makeListForInboxContext(conversations);

    const result = await listForInbox._handler(context as any, {
      workspaceId: fixture.workspaceId,
      aiWorkflowState: "ai_handled",
      limit: 20,
    });

    expect(calledIndexes).toContain("by_workspace_ai_state");
    expect(result.conversations.length).toBeGreaterThan(0);
    expect(
      result.conversations.every((conversation) => conversation.aiWorkflow.state === "ai_handled")
    ).toBe(true);
    expect(
      result.conversations.every((conversation) => conversation.aiWorkflow.confidence !== null)
    ).toBe(true);
  });
});
