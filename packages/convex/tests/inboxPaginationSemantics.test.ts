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
import { paginateInboxConversations, listForInbox } from "../convex/conversations";
import { buildCrossWorkspaceConversations, buildInboxFixture } from "./helpers/inboxFixtures";

const mockGetAuthenticatedUserFromSession = vi.mocked(getAuthenticatedUserFromSession);
const mockHasPermission = vi.mocked(hasPermission);

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

describe("inbox pagination semantics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetAuthenticatedUserFromSession.mockResolvedValue({
      _id: "user_inbox_tester" as Id<"users">,
    } as any);
    mockHasPermission.mockResolvedValue(true);
  });

  it("paginates deterministically without duplicates across pages", () => {
    const fixture = buildInboxFixture({ conversationCount: 25 });

    const page1 = paginateInboxConversations(fixture.conversations, 10);
    const page2 = paginateInboxConversations(
      fixture.conversations,
      10,
      page1.nextCursor ?? undefined
    );
    const page3 = paginateInboxConversations(
      fixture.conversations,
      10,
      page2.nextCursor ?? undefined
    );

    expect(page1.page).toHaveLength(10);
    expect(page2.page).toHaveLength(10);
    expect(page3.page.length).toBeGreaterThan(0);

    const seenIds = new Set<string>();
    for (const conversation of [...page1.page, ...page2.page, ...page3.page]) {
      const id = conversation._id.toString();
      expect(seenIds.has(id)).toBe(false);
      seenIds.add(id);
    }
  });

  it("falls back to first page when cursor is unknown", () => {
    const fixture = buildInboxFixture({ conversationCount: 8 });

    const page = paginateInboxConversations(fixture.conversations, 5, "missing_cursor");

    expect(page.page).toHaveLength(5);
    expect(page.page[0]._id.toString()).toBe(page.sortedIds[0]);
  });

  it("keeps listForInbox workspace-isolated even when backing query returns mixed workspaces", async () => {
    const primaryWorkspaceId = "workspace_primary" as Id<"workspaces">;
    const secondaryWorkspaceId = "workspace_secondary" as Id<"workspaces">;
    const mixedConversations = buildCrossWorkspaceConversations(
      primaryWorkspaceId,
      secondaryWorkspaceId
    );

    const visitors = new Map(
      mixedConversations.map((conversation) => [
        conversation.visitorId.toString(),
        {
          _id: conversation.visitorId,
          workspaceId: conversation.workspaceId,
          name: `Visitor ${conversation._id.slice(-4)}`,
        },
      ])
    );

    const messageByConversationId = new Map(
      mixedConversations.map((conversation) => [
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
                _index: string,
                builder: (q: { eq: (field: string, value: unknown) => unknown }) => unknown
              ) => {
                const q = {
                  eq: () => q,
                };
                builder(q);
                return {
                  order: () => ({
                    take: async () => mixedConversations,
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

    const result = await listForInbox._handler(context as any, {
      workspaceId: primaryWorkspaceId,
      limit: 20,
    });

    expect(result.conversations.length).toBeGreaterThan(0);
    expect(
      result.conversations.every((conversation) => conversation.workspaceId === primaryWorkspaceId)
    ).toBe(true);
  });
});
