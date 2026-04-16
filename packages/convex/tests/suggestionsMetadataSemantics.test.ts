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
    requirePermission: vi.fn(),
  };
});

import { getAuthenticatedUserFromSession } from "../convex/auth";
import { requirePermission } from "../convex/permissions";
import {
  trackDismissal as trackDismissalDefinition,
  trackUsage as trackUsageDefinition,
} from "../convex/suggestions";

const mockGetAuthenticatedUserFromSession = vi.mocked(getAuthenticatedUserFromSession);
const mockRequirePermission = vi.mocked(requirePermission);
const trackUsage = trackUsageDefinition as unknown as {
  _handler: (ctx: unknown, args: Record<string, unknown>) => Promise<string>;
};
const trackDismissal = trackDismissalDefinition as unknown as {
  _handler: (ctx: unknown, args: Record<string, unknown>) => Promise<string>;
};

function workspaceId(value: string): Id<"workspaces"> {
  return value as Id<"workspaces">;
}

function conversationId(value: string): Id<"conversations"> {
  return value as Id<"conversations">;
}

describe("suggestions metadata semantics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetAuthenticatedUserFromSession.mockResolvedValue({
      _id: "user_meta" as Id<"users">,
    } as never);
    mockRequirePermission.mockResolvedValue(undefined as never);
  });

  it("persists embeddingModel on suggestion usage feedback", async () => {
    const insert = vi.fn(async () => "feedback_usage_1");
    const ctx = {
      db: {
        get: vi.fn(async () => ({
          _id: conversationId("conversation_usage"),
          workspaceId: workspaceId("workspace_usage"),
        })),
        insert,
      },
    };

    const result = await trackUsage._handler(ctx as never, {
      workspaceId: workspaceId("workspace_usage"),
      conversationId: conversationId("conversation_usage"),
      contentType: "article",
      contentId: "article_1",
      embeddingModel: "text-embedding-3-small",
    });

    expect(result).toBe("feedback_usage_1");
    expect(insert).toHaveBeenCalledWith(
      "suggestionFeedback",
      expect.objectContaining({
        workspaceId: workspaceId("workspace_usage"),
        conversationId: conversationId("conversation_usage"),
        contentType: "article",
        contentId: "article_1",
        action: "used",
        embeddingModel: "text-embedding-3-small",
      })
    );
  });

  it("persists embeddingModel on suggestion dismissal feedback", async () => {
    const insert = vi.fn(async () => "feedback_dismissal_1");
    const ctx = {
      db: {
        get: vi.fn(async () => ({
          _id: conversationId("conversation_dismissal"),
          workspaceId: workspaceId("workspace_dismissal"),
        })),
        insert,
      },
    };

    const result = await trackDismissal._handler(ctx as never, {
      workspaceId: workspaceId("workspace_dismissal"),
      conversationId: conversationId("conversation_dismissal"),
      contentType: "snippet",
      contentId: "snippet_1",
      embeddingModel: "text-embedding-3-small",
    });

    expect(result).toBe("feedback_dismissal_1");
    expect(insert).toHaveBeenCalledWith(
      "suggestionFeedback",
      expect.objectContaining({
        workspaceId: workspaceId("workspace_dismissal"),
        conversationId: conversationId("conversation_dismissal"),
        contentType: "snippet",
        contentId: "snippet_1",
        action: "dismissed",
        embeddingModel: "text-embedding-3-small",
      })
    );
  });
});
