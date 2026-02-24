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

vi.mock("../convex/widgetSessions", () => ({
  resolveVisitorFromSession: vi.fn(),
}));

import { getAuthenticatedUserFromSession } from "../convex/auth";
import { requirePermission } from "../convex/permissions";
import { resolveVisitorFromSession } from "../convex/widgetSessions";
import { getCsatEligibility, submitCsatResponse } from "../convex/reporting";

const mockGetAuthenticatedUserFromSession = vi.mocked(getAuthenticatedUserFromSession);
const mockRequirePermission = vi.mocked(requirePermission);
const mockResolveVisitorFromSession = vi.mocked(resolveVisitorFromSession);

type ConversationRecord = {
  _id: Id<"conversations">;
  workspaceId: Id<"workspaces">;
  visitorId?: Id<"visitors">;
  assignedAgentId?: Id<"users">;
  status: "open" | "closed" | "snoozed";
  csatCompletedAt?: number;
  csatResponseId?: Id<"csatResponses">;
};

type BuildContextOptions = {
  conversation: ConversationRecord;
  askForRatingEnabled?: boolean;
  existingCsatResponse?: { _id: Id<"csatResponses"> } | null;
};

function buildReportingContext(options: BuildContextOptions) {
  const insert = vi.fn(async (table: string) => {
    if (table !== "csatResponses") {
      throw new Error(`Unexpected insert table: ${table}`);
    }
    return "csat_response_seeded" as Id<"csatResponses">;
  });

  const patch = vi.fn(async () => undefined);

  const query = vi.fn((table: string) => {
    if (table === "automationSettings") {
      return {
        withIndex: (
          _index: string,
          builder: (q: { eq: (field: string, value: unknown) => unknown }) => unknown
        ) => {
          const queryBuilder = {
            eq: () => queryBuilder,
          };
          builder(queryBuilder);
          return {
            first: async () =>
              options.askForRatingEnabled === undefined
                ? null
                : {
                    _id: "automation_settings_1",
                    workspaceId: options.conversation.workspaceId,
                    askForRatingEnabled: options.askForRatingEnabled,
                  },
          };
        },
      };
    }

    if (table === "csatResponses") {
      return {
        withIndex: (
          _index: string,
          builder: (q: { eq: (field: string, value: unknown) => unknown }) => unknown
        ) => {
          const queryBuilder = {
            eq: () => queryBuilder,
          };
          builder(queryBuilder);
          return {
            first: async () => options.existingCsatResponse ?? null,
          };
        },
      };
    }

    throw new Error(`Unexpected query table: ${table}`);
  });

  const context = {
    db: {
      get: vi.fn(async (id: Id<"conversations">) => {
        if (id === options.conversation._id) {
          return options.conversation;
        }
        return null;
      }),
      query,
      insert,
      patch,
    },
  };

  return { context, insert, patch };
}

describe("reporting CSAT eligibility and submission semantics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRequirePermission.mockResolvedValue(undefined as never);
    mockResolveVisitorFromSession.mockResolvedValue({
      visitorId: "visitor_csat_test" as Id<"visitors">,
      identityVerified: false,
    });
  });

  it("returns disabled eligibility when Ask for Rating is off", async () => {
    mockGetAuthenticatedUserFromSession.mockResolvedValue(null);

    const conversationId = "conversation_csat_eligibility_1" as Id<"conversations">;
    const { context } = buildReportingContext({
      conversation: {
        _id: conversationId,
        workspaceId: "workspace_csat_1" as Id<"workspaces">,
        visitorId: "visitor_csat_test" as Id<"visitors">,
        status: "closed",
      },
      askForRatingEnabled: false,
    });

    const result = await getCsatEligibility._handler(context as any, {
      conversationId,
      visitorId: "visitor_csat_test" as Id<"visitors">,
      sessionToken: "wst_test_token",
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("disabled");
    expect(result.askForRatingEnabled).toBe(false);
  });

  it("rejects eligibility query when visitor session does not match conversation owner", async () => {
    mockGetAuthenticatedUserFromSession.mockResolvedValue(null);
    mockResolveVisitorFromSession.mockResolvedValue({
      visitorId: "visitor_other" as Id<"visitors">,
      identityVerified: false,
    });

    const conversationId = "conversation_csat_eligibility_2" as Id<"conversations">;
    const { context } = buildReportingContext({
      conversation: {
        _id: conversationId,
        workspaceId: "workspace_csat_2" as Id<"workspaces">,
        visitorId: "visitor_csat_test" as Id<"visitors">,
        status: "closed",
      },
      askForRatingEnabled: true,
    });

    await expect(
      getCsatEligibility._handler(context as any, {
        conversationId,
        visitorId: "visitor_csat_test" as Id<"visitors">,
        sessionToken: "wst_test_token",
      })
    ).rejects.toThrow("Not authorized to submit CSAT response");
  });

  it("blocks CSAT submission for non-closed conversations", async () => {
    mockGetAuthenticatedUserFromSession.mockResolvedValue(null);

    const conversationId = "conversation_csat_submission_1" as Id<"conversations">;
    const { context } = buildReportingContext({
      conversation: {
        _id: conversationId,
        workspaceId: "workspace_csat_3" as Id<"workspaces">,
        visitorId: "visitor_csat_test" as Id<"visitors">,
        status: "open",
      },
      askForRatingEnabled: true,
    });

    await expect(
      submitCsatResponse._handler(context as any, {
        conversationId,
        rating: 5,
        visitorId: "visitor_csat_test" as Id<"visitors">,
        sessionToken: "wst_test_token",
      })
    ).rejects.toThrow("CSAT can only be submitted for closed conversations");
  });

  it("blocks CSAT submission when Ask for Rating is disabled", async () => {
    mockGetAuthenticatedUserFromSession.mockResolvedValue(null);

    const conversationId = "conversation_csat_submission_2" as Id<"conversations">;
    const { context } = buildReportingContext({
      conversation: {
        _id: conversationId,
        workspaceId: "workspace_csat_4" as Id<"workspaces">,
        visitorId: "visitor_csat_test" as Id<"visitors">,
        status: "closed",
      },
      askForRatingEnabled: false,
    });

    await expect(
      submitCsatResponse._handler(context as any, {
        conversationId,
        rating: 4,
        visitorId: "visitor_csat_test" as Id<"visitors">,
        sessionToken: "wst_test_token",
      })
    ).rejects.toThrow("CSAT collection is disabled for this workspace");
  });

  it("persists response and conversation marker for eligible submissions", async () => {
    mockGetAuthenticatedUserFromSession.mockResolvedValue(null);

    const conversationId = "conversation_csat_submission_3" as Id<"conversations">;
    const { context, insert, patch } = buildReportingContext({
      conversation: {
        _id: conversationId,
        workspaceId: "workspace_csat_5" as Id<"workspaces">,
        visitorId: "visitor_csat_test" as Id<"visitors">,
        assignedAgentId: "agent_csat_test" as Id<"users">,
        status: "closed",
      },
      askForRatingEnabled: true,
      existingCsatResponse: null,
    });

    const responseId = await submitCsatResponse._handler(context as any, {
      conversationId,
      rating: 5,
      feedback: "Great support",
      visitorId: "visitor_csat_test" as Id<"visitors">,
      sessionToken: "wst_test_token",
    });

    expect(responseId).toBe("csat_response_seeded");
    expect(insert).toHaveBeenCalledWith(
      "csatResponses",
      expect.objectContaining({
        conversationId,
        rating: 5,
        feedback: "Great support",
      })
    );
    expect(patch).toHaveBeenCalledWith(
      conversationId,
      expect.objectContaining({
        csatResponseId: "csat_response_seeded",
      })
    );
  });

  it("rejects duplicate CSAT submissions using conversation completion marker", async () => {
    mockGetAuthenticatedUserFromSession.mockResolvedValue(null);

    const conversationId = "conversation_csat_submission_4" as Id<"conversations">;
    const { context } = buildReportingContext({
      conversation: {
        _id: conversationId,
        workspaceId: "workspace_csat_6" as Id<"workspaces">,
        visitorId: "visitor_csat_test" as Id<"visitors">,
        status: "closed",
        csatCompletedAt: Date.now() - 1000,
      },
      askForRatingEnabled: true,
      existingCsatResponse: null,
    });

    await expect(
      submitCsatResponse._handler(context as any, {
        conversationId,
        rating: 2,
        visitorId: "visitor_csat_test" as Id<"visitors">,
        sessionToken: "wst_test_token",
      })
    ).rejects.toThrow("CSAT response already submitted for this conversation");
  });
});
