import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@opencom/convex";

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
import { getActiveOutboundMessages } from "../src/api/outbound";
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

    expect(clientMocks.mutation).toHaveBeenCalledWith(
      api.widgetSessions.boot,
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
    expect(clientMocks.mutation).toHaveBeenLastCalledWith(api.conversations.createForVisitor, {
      workspaceId: WORKSPACE_ID,
      visitorId: VISITOR_ID,
      sessionToken: SESSION_TOKEN,
    });

    await getOrCreateConversation(VISITOR_ID as never);
    expect(clientMocks.mutation).toHaveBeenLastCalledWith(api.conversations.getOrCreateForVisitor, {
      workspaceId: WORKSPACE_ID,
      visitorId: VISITOR_ID,
      sessionToken: SESSION_TOKEN,
    });

    await getConversations(VISITOR_ID as never);
    expect(clientMocks.query).toHaveBeenLastCalledWith(api.conversations.listByVisitor, {
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
    expect(clientMocks.mutation).toHaveBeenLastCalledWith(api.messages.send, {
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
    expect(clientMocks.mutation).toHaveBeenLastCalledWith(
      api.tickets.create,
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
    expect(clientMocks.query).toHaveBeenLastCalledWith(
      api.outboundMessages.getEligible,
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        visitorId: VISITOR_ID,
        sessionToken: SESSION_TOKEN,
        currentUrl: "https://app.opencom.dev/account",
      })
    );

    await getEligibleChecklists(VISITOR_ID as never);
    expect(clientMocks.query).toHaveBeenLastCalledWith(
      api.checklists.getEligible,
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        visitorId: VISITOR_ID,
        sessionToken: SESSION_TOKEN,
      })
    );
  });
});
