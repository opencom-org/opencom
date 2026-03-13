import { beforeEach, describe, expect, it, vi } from "vitest";

const clientMocks = vi.hoisted(() => {
  const query = vi.fn();
  const mutation = vi.fn();
  const action = vi.fn();
  const constructor = vi.fn().mockImplementation(function MockConvexReactClient() {
    return { query, mutation, action };
  });
  return { query, mutation, action, constructor };
});

vi.mock("convex/react", () => ({
  ConvexReactClient: clientMocks.constructor,
}));

import { initializeClient, resetClient } from "../src/api/client";
import {
  getAISettings,
  getConversationAIResponses,
  getRelevantKnowledge,
  handoffToHuman,
  shouldAIRespond,
  submitAIFeedback,
} from "../src/api/aiAgent";
import { getArticle, listArticles, searchArticles } from "../src/api/articles";
import {
  getCarousel,
  listActiveCarousels,
  recordCarouselImpression,
} from "../src/api/carousels";
import { completeChecklistItem, getChecklistProgress, getEligibleChecklists } from "../src/api/checklists";
import { getCommonIssueButtons } from "../src/api/commonIssues";
import {
  createConversation,
  getConversations,
  getOrCreateConversation,
  sendMessage,
} from "../src/api/conversations";
import { trackAutoEvent, trackEvent } from "../src/api/events";
import { getExpectedReplyTime, getOfficeHours, getOfficeHoursStatus } from "../src/api/officeHours";
import {
  getActiveOutboundMessages,
  markOutboundAsSeen,
  trackOutboundImpression,
} from "../src/api/outbound";
import { bootSession, refreshSession, revokeSession } from "../src/api/sessions";
import {
  addTicketComment,
  createTicket,
  getTicket,
  getTicketComments,
  listTickets,
} from "../src/api/tickets";
import { heartbeat, identifyVisitor, updateLocation } from "../src/api/visitors";
import {
  resetVisitorState,
  setSessionId,
  setSessionToken,
  setVisitorId,
} from "../src/state/visitor";

const WORKSPACE_ID = "workspace_contract";
const VISITOR_ID = "visitor_contract";
const SESSION_TOKEN = "wst_contract_token";

function resolveFunctionPath(ref: unknown): string {
  if (typeof ref === "string") {
    return ref;
  }

  if (!ref || typeof ref !== "object") {
    return "";
  }

  const maybeRef = ref as {
    functionName?: string;
    reference?: { functionName?: string; name?: string };
    name?: string;
    referencePath?: string;
    function?: { name?: string };
  };

  const symbolFunctionName = Object.getOwnPropertySymbols(ref).find((symbol) =>
    String(symbol).includes("functionName")
  );

  const symbolValue = symbolFunctionName
    ? (ref as Record<symbol, unknown>)[symbolFunctionName]
    : undefined;

  return (
    (typeof symbolValue === "string" ? symbolValue : undefined) ??
    maybeRef.functionName ??
    maybeRef.reference?.functionName ??
    maybeRef.reference?.name ??
    maybeRef.name ??
    maybeRef.referencePath ??
    maybeRef.function?.name ??
    ""
  );
}

async function expectLatestMutationCall(
  expectedPath: string,
  invoke: () => Promise<unknown>,
  expectedArgs: unknown,
  resolvedValue?: unknown
): Promise<void> {
  clientMocks.mutation.mockResolvedValueOnce(resolvedValue);
  await invoke();

  const [mutationRef, mutationArgs] = clientMocks.mutation.mock.calls.at(-1) ?? [];
  expect(resolveFunctionPath(mutationRef)).toBe(expectedPath);
  expect(mutationArgs).toEqual(expectedArgs);
}

async function expectLatestActionCall(
  expectedPath: string,
  invoke: () => Promise<unknown>,
  expectedArgs: unknown,
  resolvedValue: unknown
): Promise<void> {
  clientMocks.action.mockResolvedValueOnce(resolvedValue);
  await invoke();

  const [actionRef, actionArgs] = clientMocks.action.mock.calls.at(-1) ?? [];
  expect(resolveFunctionPath(actionRef)).toBe(expectedPath);
  expect(actionArgs).toEqual(expectedArgs);
}

async function expectLatestQueryCall(
  expectedPath: string,
  invoke: () => Promise<unknown>,
  expectedArgs: unknown,
  resolvedValue: unknown
): Promise<void> {
  clientMocks.query.mockResolvedValueOnce(resolvedValue);
  await invoke();

  const [queryRef, queryArgs] = clientMocks.query.mock.calls.at(-1) ?? [];
  expect(resolveFunctionPath(queryRef)).toBe(expectedPath);
  expect(queryArgs).toEqual(expectedArgs);
}

describe("sdk-core backend contract conformance", () => {
  beforeEach(() => {
    clientMocks.mutation.mockReset();
    clientMocks.query.mockReset();
    clientMocks.action.mockReset();
    resetClient();
    resetVisitorState();

    initializeClient({
      workspaceId: WORKSPACE_ID,
      convexUrl: "https://contract-tests.convex.cloud",
    });

    setVisitorId(VISITOR_ID as never);
    setSessionId("session_contract");
    setSessionToken(SESSION_TOKEN);
  });

  it("uses existing Convex function references for the session lifecycle", async () => {
    await expectLatestMutationCall(
      "widgetSessions:boot",
      () => bootSession({ sessionId: "session_contract" }),
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        sessionId: "session_contract",
      }),
      {
        visitor: { _id: VISITOR_ID },
        sessionToken: SESSION_TOKEN,
        expiresAt: Date.now() + 60_000,
      }
    );

    await expectLatestMutationCall(
      "widgetSessions:refresh",
      () => refreshSession({ sessionToken: SESSION_TOKEN }),
      { sessionToken: SESSION_TOKEN },
      {
        sessionToken: SESSION_TOKEN,
        expiresAt: Date.now() + 60_000,
      }
    );

    await expectLatestMutationCall(
      "widgetSessions:revoke",
      () => revokeSession({ sessionToken: SESSION_TOKEN }),
      { sessionToken: SESSION_TOKEN }
    );
  });

  it("enforces required visitor conversation args and references", async () => {
    clientMocks.mutation.mockResolvedValue({ _id: "conversation_1" });
    clientMocks.query.mockResolvedValue([]);

    await createConversation(VISITOR_ID as never);
    let [mutationRef, mutationArgs] = clientMocks.mutation.mock.calls.at(-1) ?? [];
    expect(resolveFunctionPath(mutationRef)).toBe("conversations:createForVisitor");
    expect(mutationArgs).toEqual({
      workspaceId: WORKSPACE_ID,
      visitorId: VISITOR_ID,
      sessionToken: SESSION_TOKEN,
    });

    await getOrCreateConversation(VISITOR_ID as never);
    [mutationRef, mutationArgs] = clientMocks.mutation.mock.calls.at(-1) ?? [];
    expect(resolveFunctionPath(mutationRef)).toBe("conversations:getOrCreateForVisitor");
    expect(mutationArgs).toEqual({
      workspaceId: WORKSPACE_ID,
      visitorId: VISITOR_ID,
      sessionToken: SESSION_TOKEN,
    });

    await getConversations(VISITOR_ID as never);
    const [queryRef, queryArgs] = clientMocks.query.mock.calls.at(-1) ?? [];
    expect(resolveFunctionPath(queryRef)).toBe("conversations:listByVisitor");
    expect(queryArgs).toEqual({
      workspaceId: WORKSPACE_ID,
      visitorId: VISITOR_ID,
      sessionToken: SESSION_TOKEN,
    });

    resetVisitorState();
    setVisitorId(VISITOR_ID as never);
    setSessionId("session_contract_missing_token");
    await expect(getOrCreateConversation(VISITOR_ID as never)).rejects.toThrow(
      "sessionToken is required for visitor conversation APIs"
    );
  });

  it("matches key visitor-path contracts for messages, tickets, outbound, and checklists", async () => {
    clientMocks.mutation.mockResolvedValue(undefined);
    clientMocks.query.mockResolvedValue([]);

    await sendMessage({
      conversationId: "conversation_1" as never,
      visitorId: VISITOR_ID as never,
      content: "Hello from contract test",
    });
    let [mutationRef, mutationArgs] = clientMocks.mutation.mock.calls.at(-1) ?? [];
    expect(resolveFunctionPath(mutationRef)).toBe("messages:send");
    expect(mutationArgs).toEqual({
      conversationId: "conversation_1",
      senderId: VISITOR_ID,
      senderType: "visitor",
      content: "Hello from contract test",
      visitorId: VISITOR_ID,
      sessionToken: SESSION_TOKEN,
    });

    await createTicket({
      visitorId: VISITOR_ID as never,
      subject: "Need help",
      sessionToken: SESSION_TOKEN,
      priority: "normal",
    });
    [mutationRef, mutationArgs] = clientMocks.mutation.mock.calls.at(-1) ?? [];
    expect(resolveFunctionPath(mutationRef)).toBe("tickets:create");
    expect(mutationArgs).toEqual(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        visitorId: VISITOR_ID,
        sessionToken: SESSION_TOKEN,
        subject: "Need help",
      })
    );

    await getActiveOutboundMessages({
      visitorId: VISITOR_ID as never,
      currentUrl: "https://app.opencom.dev/account",
      sessionId: "session_contract",
    });
    let [queryRef, queryArgs] = clientMocks.query.mock.calls.at(-1) ?? [];
    expect(resolveFunctionPath(queryRef)).toBe("outboundMessages:getEligible");
    expect(queryArgs).toEqual(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        visitorId: VISITOR_ID,
        sessionToken: SESSION_TOKEN,
        currentUrl: "https://app.opencom.dev/account",
      })
    );

    await getEligibleChecklists(VISITOR_ID as never);
    [queryRef, queryArgs] = clientMocks.query.mock.calls.at(-1) ?? [];
    expect(resolveFunctionPath(queryRef)).toBe("checklists:getEligible");
    expect(queryArgs).toEqual(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        visitorId: VISITOR_ID,
        sessionToken: SESSION_TOKEN,
      })
    );
  });

  it("keeps outbound impression mutation contracts stable", async () => {
    clientMocks.mutation.mockResolvedValue(undefined);

    await trackOutboundImpression({
      messageId: "outbound_message_1" as never,
      visitorId: VISITOR_ID as never,
      sessionId: "session_contract",
      action: "clicked",
      buttonIndex: 2,
    });

    let [mutationRef, mutationArgs] = clientMocks.mutation.mock.calls.at(-1) ?? [];
    expect(resolveFunctionPath(mutationRef)).toBe("outboundMessages:trackImpression");
    expect(mutationArgs).toEqual(
      expect.objectContaining({
        messageId: "outbound_message_1",
        visitorId: VISITOR_ID,
        sessionToken: SESSION_TOKEN,
        sessionId: "session_contract",
        action: "clicked",
        buttonIndex: 2,
      })
    );

    await markOutboundAsSeen({
      messageId: "outbound_message_2" as never,
      visitorId: VISITOR_ID as never,
      sessionId: "session_contract",
    });

    [mutationRef, mutationArgs] = clientMocks.mutation.mock.calls.at(-1) ?? [];
    expect(resolveFunctionPath(mutationRef)).toBe("outboundMessages:trackImpression");
    expect(mutationArgs).toEqual(
      expect.objectContaining({
        messageId: "outbound_message_2",
        visitorId: VISITOR_ID,
        sessionToken: SESSION_TOKEN,
        sessionId: "session_contract",
        action: "shown",
      })
    );
  });

  it("keeps visitor, ticket, and checklist contracts stable", async () => {
    await expectLatestMutationCall(
      "visitors:identify",
      () =>
        identifyVisitor({
          visitorId: VISITOR_ID as never,
          user: {
            email: "visitor@example.com",
            name: "Visitor Contract",
          },
        }),
      {
        visitorId: VISITOR_ID,
        sessionToken: undefined,
        email: "visitor@example.com",
        name: "Visitor Contract",
        externalUserId: undefined,
        userHash: undefined,
        location: undefined,
        device: undefined,
        currentUrl: undefined,
        customAttributes: {},
      }
    );

    await expectLatestMutationCall(
      "visitors:heartbeat",
      () => heartbeat(VISITOR_ID as never),
      { visitorId: VISITOR_ID, sessionToken: undefined }
    );

    await expectLatestMutationCall(
      "visitors:updateLocation",
      () =>
        updateLocation(
          VISITOR_ID as never,
          {
            country: "GB",
            city: "London",
          },
          undefined
        ),
      {
        visitorId: VISITOR_ID,
        sessionToken: SESSION_TOKEN,
        location: {
          country: "GB",
          city: "London",
        },
      }
    );

    await expectLatestQueryCall(
      "tickets:listByVisitor",
      () => listTickets(VISITOR_ID as never),
      {
        visitorId: VISITOR_ID,
        sessionToken: undefined,
        workspaceId: WORKSPACE_ID,
      },
      []
    );

    await expectLatestQueryCall(
      "tickets:get",
      () => getTicket("ticket_1" as never),
      {
        id: "ticket_1",
        visitorId: VISITOR_ID,
        sessionToken: SESSION_TOKEN,
      },
      null
    );

    await expectLatestMutationCall(
      "tickets:addComment",
      () =>
        addTicketComment({
          ticketId: "ticket_1" as never,
          visitorId: VISITOR_ID as never,
          content: "Need another update",
        }),
      {
        ticketId: "ticket_1",
        content: "Need another update",
        visitorId: VISITOR_ID,
        sessionToken: undefined,
      },
      "comment_1"
    );

    await expectLatestQueryCall(
      "tickets:getComments",
      () => getTicketComments("ticket_1" as never),
      {
        ticketId: "ticket_1",
        includeInternal: false,
        visitorId: VISITOR_ID,
        sessionToken: SESSION_TOKEN,
      },
      []
    );

    await expectLatestQueryCall(
      "checklists:getProgress",
      () => getChecklistProgress(VISITOR_ID as never, "checklist_1" as never),
      {
        visitorId: VISITOR_ID,
        checklistId: "checklist_1",
        workspaceId: WORKSPACE_ID,
        sessionToken: SESSION_TOKEN,
      },
      {
        completedTaskIds: ["task_1"],
        startedAt: 123,
        completedAt: null,
      }
    );

    await expectLatestMutationCall(
      "checklists:completeTask",
      () => completeChecklistItem(VISITOR_ID as never, "checklist_1" as never, "task_2"),
      {
        visitorId: VISITOR_ID,
        checklistId: "checklist_1",
        taskId: "task_2",
        workspaceId: WORKSPACE_ID,
        sessionToken: SESSION_TOKEN,
      }
    );
  });

  it("keeps AI, article, and carousel contracts stable", async () => {
    await expectLatestQueryCall(
      "aiAgent:getPublicSettings",
      () => getAISettings(),
      { workspaceId: WORKSPACE_ID },
      {
        enabled: true,
        knowledgeSources: ["articles"],
        confidenceThreshold: 0.8,
        personality: null,
        handoffMessage: "Escalating",
        workingHours: null,
        model: "gpt-4.1",
        suggestionsEnabled: true,
      }
    );

    await expectLatestActionCall(
      "aiAgent:getRelevantKnowledge",
      () => getRelevantKnowledge("refund policy", 5),
      {
        workspaceId: WORKSPACE_ID,
        query: "refund policy",
        limit: 5,
      },
      []
    );

    await expectLatestQueryCall(
      "aiAgent:getConversationResponses",
      () => getConversationAIResponses("conversation_1" as never),
      {
        conversationId: "conversation_1",
        visitorId: VISITOR_ID,
        sessionToken: SESSION_TOKEN,
      },
      []
    );

    await expectLatestMutationCall(
      "aiAgent:submitFeedback",
      () => submitAIFeedback("response_1" as never, "helpful"),
      {
        responseId: "response_1",
        feedback: "helpful",
        visitorId: VISITOR_ID,
        sessionToken: SESSION_TOKEN,
      }
    );

    await expectLatestMutationCall(
      "aiAgent:handoffToHuman",
      () => handoffToHuman("conversation_1" as never, "Need an agent"),
      {
        conversationId: "conversation_1",
        visitorId: VISITOR_ID,
        sessionToken: SESSION_TOKEN,
        reason: "Need an agent",
      },
      {
        messageId: "message_1",
        handoffMessage: "Connecting you to a human",
      }
    );

    await expectLatestQueryCall(
      "aiAgent:shouldRespond",
      () => shouldAIRespond(),
      { workspaceId: WORKSPACE_ID },
      { shouldRespond: true, reason: null }
    );

    await expectLatestQueryCall(
      "articles:searchForVisitor",
      () =>
        searchArticles({
          visitorId: VISITOR_ID as never,
          query: "billing",
        }),
      {
        workspaceId: WORKSPACE_ID,
        visitorId: VISITOR_ID,
        sessionToken: SESSION_TOKEN,
        query: "billing",
      },
      []
    );

    await expectLatestQueryCall(
      "articles:listForVisitor",
      () => listArticles(VISITOR_ID as never),
      {
        workspaceId: WORKSPACE_ID,
        visitorId: VISITOR_ID,
        sessionToken: SESSION_TOKEN,
      },
      []
    );

    await expectLatestQueryCall(
      "articles:get",
      () => getArticle("article_1" as never),
      { id: "article_1" },
      null
    );

    await expectLatestQueryCall(
      "carousels:get",
      () => getCarousel("carousel_1" as never),
      { id: "carousel_1" },
      null
    );

    await expectLatestMutationCall(
      "carousels:recordImpression",
      () =>
        recordCarouselImpression({
          carouselId: "carousel_1" as never,
          visitorId: VISITOR_ID as never,
          action: "shown",
        }),
      {
        carouselId: "carousel_1",
        visitorId: VISITOR_ID,
        sessionToken: SESSION_TOKEN,
        action: "shown",
        screenIndex: undefined,
      }
    );

    await expectLatestQueryCall(
      "carousels:listActive",
      () => listActiveCarousels(VISITOR_ID as never),
      {
        workspaceId: WORKSPACE_ID,
        visitorId: VISITOR_ID,
        sessionToken: SESSION_TOKEN,
      },
      []
    );
  });

  it("keeps event, common issue, and office hour contracts stable", async () => {
    await expectLatestMutationCall(
      "events:track",
      () =>
        trackEvent({
          visitorId: VISITOR_ID as never,
          name: "plan_viewed",
          properties: {
            seats: 3,
            source: "pricing",
            nested: { ignored: true },
          },
          url: "https://app.opencom.dev/pricing",
          sessionId: "session_contract",
        }),
      {
        workspaceId: WORKSPACE_ID,
        visitorId: VISITOR_ID,
        sessionToken: undefined,
        name: "plan_viewed",
        properties: {
          seats: 3,
          source: "pricing",
        },
        url: "https://app.opencom.dev/pricing",
        sessionId: "session_contract",
      }
    );

    await expectLatestMutationCall(
      "events:trackAutoEvent",
      () =>
        trackAutoEvent({
          visitorId: VISITOR_ID as never,
          eventType: "page_view",
          properties: {
            path: "/pricing",
            count: 1,
          },
        }),
      {
        workspaceId: WORKSPACE_ID,
        visitorId: VISITOR_ID,
        sessionToken: undefined,
        eventType: "page_view",
        properties: {
          path: "/pricing",
          count: 1,
        },
        url: undefined,
        sessionId: undefined,
      },
      "event_1"
    );

    await expectLatestQueryCall(
      "commonIssueButtons:list",
      () => getCommonIssueButtons(),
      { workspaceId: WORKSPACE_ID },
      []
    );

    await expectLatestQueryCall(
      "officeHours:isCurrentlyOpen",
      () => getOfficeHoursStatus(),
      { workspaceId: WORKSPACE_ID },
      {
        isOpen: true,
        offlineMessage: null,
        expectedReplyTimeMinutes: 5,
      }
    );

    await expectLatestQueryCall(
      "officeHours:getExpectedReplyTime",
      () => getExpectedReplyTime(),
      { workspaceId: WORKSPACE_ID },
      "within the hour"
    );

    await expectLatestQueryCall(
      "officeHours:getOrDefault",
      () => getOfficeHours(),
      { workspaceId: WORKSPACE_ID },
      {
        workspaceId: WORKSPACE_ID,
        timezone: "Europe/London",
        schedule: [],
        expectedReplyTimeMinutes: 30,
      }
    );
  });
});
