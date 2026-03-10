import { beforeEach, describe, expect, it, vi } from "vitest";

const clientMocks = vi.hoisted(() => {
  const query = vi.fn();
  const mutation = vi.fn();
  const constructor = vi.fn().mockImplementation(function MockConvexReactClient() {
    return { query, mutation };
  });
  return { query, mutation, constructor };
});

vi.mock("convex/react", () => ({
  ConvexReactClient: clientMocks.constructor,
}));

import { initializeClient, resetClient } from "../src/api/client";
import {
  createConversation,
  getConversations,
  getOrCreateConversation,
  sendMessage,
} from "../src/api/conversations";
import { bootSession } from "../src/api/sessions";
import { createTicket } from "../src/api/tickets";
import { getActiveOutboundMessages, markOutboundAsSeen, trackOutboundImpression } from "../src/api/outbound";
import { getEligibleChecklists } from "../src/api/checklists";
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

describe("sdk-core backend contract conformance", () => {
  beforeEach(() => {
    clientMocks.mutation.mockReset();
    clientMocks.query.mockReset();
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

  it("uses existing Convex function references for session bootstrap", async () => {
    clientMocks.mutation.mockResolvedValueOnce({
      visitor: { _id: VISITOR_ID },
      sessionToken: SESSION_TOKEN,
      expiresAt: Date.now() + 60_000,
    });

    await bootSession({ sessionId: "session_contract" });

    const [mutationRef, mutationArgs] = clientMocks.mutation.mock.calls.at(-1) ?? [];
    expect(resolveFunctionPath(mutationRef)).toBe("widgetSessions:boot");
    expect(mutationArgs).toEqual(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        sessionId: "session_contract",
      })
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
});
