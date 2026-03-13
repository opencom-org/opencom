import { makeFunctionReference } from "convex/server";
import { httpAction } from "./_generated/server";
import { withAutomationAuth } from "./lib/automationAuth";
import { jsonResponse, errorResponse, parsePaginationParams } from "./lib/apiHelpers";

// Use makeFunctionReference for cross-module references (no codegen dependency).
// Args/return types are untyped since codegen hasn't run; runtime validation
// is handled by each internal function's Convex validators.
const fn = (name: string) => makeFunctionReference(name) as any;

const listConversationsRef = fn("automationApiInternals:listConversationsForAutomation");
const getConversationRef = fn("automationApiInternals:getConversationForAutomation");
const updateConversationRef = fn("automationApiInternals:updateConversationForAutomation");
const listMessagesRef = fn("automationApiInternals:listMessagesForAutomation");
const sendMessageRef = fn("automationApiInternals:sendMessageForAutomation");
const listVisitorsRef = fn("automationApiInternals:listVisitorsForAutomation");
const getVisitorRef = fn("automationApiInternals:getVisitorForAutomation");
const createVisitorRef = fn("automationApiInternals:createVisitorForAutomation");
const updateVisitorRef = fn("automationApiInternals:updateVisitorForAutomation");
const listTicketsRef = fn("automationApiInternals:listTicketsForAutomation");
const getTicketRef = fn("automationApiInternals:getTicketForAutomation");
const createTicketRef = fn("automationApiInternals:createTicketForAutomation");
const updateTicketRef = fn("automationApiInternals:updateTicketForAutomation");
const claimConversationRef = fn("automationConversationClaims:claimConversation");
const releaseConversationRef = fn("automationConversationClaims:releaseConversation");
const escalateConversationRef = fn("automationConversationClaims:escalateConversation");
const listEventsRef = fn("automationEvents:listEvents");
const checkIdempotencyRef = fn("lib/idempotency:checkIdempotencyKey");
const storeIdempotencyRef = fn("lib/idempotency:storeIdempotencyKey");

// Shorthand to cast ctx for withAutomationAuth (httpAction ctx is compatible at runtime).
function asAuthCtx(ctx: { runQuery: unknown; runMutation: unknown }) {
  return ctx as {
    runQuery: (ref: unknown, args: Record<string, unknown>) => Promise<unknown>;
    runMutation: (ref: unknown, args: Record<string, unknown>) => Promise<unknown>;
  };
}

// ── Conversations: list ────────────────────────────────────────────
export const listConversations = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "conversations.read");
  if (authResult instanceof Response) return authResult;

  try {
    const url = new URL(request.url);
    const { cursor, limit, updatedSince } = parsePaginationParams(url);
    const status = url.searchParams.get("status");
    const assignee = url.searchParams.get("assignee");

    const result = await ctx.runQuery(listConversationsRef, {
      workspaceId: authResult.workspaceId,
      cursor: cursor ?? undefined,
      limit,
      updatedSince: updatedSince ?? undefined,
      status: status ?? undefined,
      assigneeId: assignee ?? undefined,
    });
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(String(error), 500);
  }
});

// ── Conversations: get ─────────────────────────────────────────────
export const getConversation = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "conversations.read");
  if (authResult instanceof Response) return authResult;

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return errorResponse("Missing id parameter", 400);

    const result = await ctx.runQuery(getConversationRef, {
      workspaceId: authResult.workspaceId,
      conversationId: id,
    });
    if (!result) return errorResponse("Conversation not found", 404);
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(String(error), 500);
  }
});

// ── Conversations: update ──────────────────────────────────────────
export const updateConversation = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "conversations.write");
  if (authResult instanceof Response) return authResult;

  try {
    const body = await request.json();
    const { conversationId, status, assignedAgentId } = body;
    if (!conversationId) return errorResponse("Missing conversationId", 400);

    const result = await ctx.runMutation(updateConversationRef, {
      workspaceId: authResult.workspaceId,
      conversationId,
      status,
      assignedAgentId,
    });
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(String(error), 500);
  }
});

// ── Messages: list ─────────────────────────────────────────────────
export const listMessages = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "messages.read");
  if (authResult instanceof Response) return authResult;

  try {
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversationId");
    if (!conversationId) return errorResponse("Missing conversationId parameter", 400);

    const { cursor, limit } = parsePaginationParams(url);
    const result = await ctx.runQuery(listMessagesRef, {
      workspaceId: authResult.workspaceId,
      conversationId,
      cursor: cursor ?? undefined,
      limit,
    });
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(String(error), 500);
  }
});

// ── Messages: send ─────────────────────────────────────────────────
export const sendMessage = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "messages.write");
  if (authResult instanceof Response) return authResult;

  try {
    const body = await request.json();
    const { conversationId, content } = body;
    if (!conversationId) return errorResponse("Missing conversationId", 400);
    if (!content) return errorResponse("Missing content", 400);

    // Check idempotency key
    const idempotencyKey = request.headers.get("Idempotency-Key");
    if (idempotencyKey) {
      const cached = await ctx.runQuery(checkIdempotencyRef, {
        workspaceId: authResult.workspaceId,
        key: idempotencyKey,
      }) as { responseSnapshot?: unknown } | null;
      if (cached) {
        return jsonResponse(cached.responseSnapshot ?? cached);
      }
    }

    const result = await ctx.runMutation(sendMessageRef, {
      workspaceId: authResult.workspaceId,
      conversationId,
      credentialId: authResult.credentialId,
      actorName: authResult.actorName,
      content,
    }) as { id?: string };

    if (idempotencyKey) {
      await ctx.runMutation(storeIdempotencyRef, {
        workspaceId: authResult.workspaceId,
        key: idempotencyKey,
        credentialId: authResult.credentialId,
        resourceType: "message",
        resourceId: result.id,
        responseSnapshot: result,
      });
    }

    return jsonResponse(result, 201);
  } catch (error) {
    return errorResponse(String(error), 500);
  }
});

// ── Conversations: claim ───────────────────────────────────────────
export const claimConversation = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "claims.manage");
  if (authResult instanceof Response) return authResult;

  try {
    const body = await request.json();
    const { conversationId } = body;
    if (!conversationId) return errorResponse("Missing conversationId", 400);

    const result = await ctx.runMutation(claimConversationRef, {
      workspaceId: authResult.workspaceId,
      conversationId,
      credentialId: authResult.credentialId,
    });
    return jsonResponse(result, 201);
  } catch (error) {
    return errorResponse(String(error), 500);
  }
});

// ── Conversations: release ─────────────────────────────────────────
export const releaseConversation = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "claims.manage");
  if (authResult instanceof Response) return authResult;

  try {
    const body = await request.json();
    const { conversationId } = body;
    if (!conversationId) return errorResponse("Missing conversationId", 400);

    const result = await ctx.runMutation(releaseConversationRef, {
      workspaceId: authResult.workspaceId,
      conversationId,
      credentialId: authResult.credentialId,
    });
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(String(error), 500);
  }
});

// ── Conversations: escalate ────────────────────────────────────────
export const escalateConversation = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "claims.manage");
  if (authResult instanceof Response) return authResult;

  try {
    const body = await request.json();
    const { conversationId } = body;
    if (!conversationId) return errorResponse("Missing conversationId", 400);

    const result = await ctx.runMutation(escalateConversationRef, {
      workspaceId: authResult.workspaceId,
      conversationId,
      credentialId: authResult.credentialId,
    });
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(String(error), 500);
  }
});

// ── Visitors: list ─────────────────────────────────────────────────
export const listVisitors = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "visitors.read");
  if (authResult instanceof Response) return authResult;

  try {
    const url = new URL(request.url);
    const { cursor, limit, updatedSince } = parsePaginationParams(url);

    const result = await ctx.runQuery(listVisitorsRef, {
      workspaceId: authResult.workspaceId,
      cursor: cursor ?? undefined,
      limit,
      updatedSince: updatedSince ?? undefined,
    });
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(String(error), 500);
  }
});

// ── Visitors: get ──────────────────────────────────────────────────
export const getVisitor = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "visitors.read");
  if (authResult instanceof Response) return authResult;

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return errorResponse("Missing id parameter", 400);

    const result = await ctx.runQuery(getVisitorRef, {
      workspaceId: authResult.workspaceId,
      visitorId: id,
    });
    if (!result) return errorResponse("Visitor not found", 404);
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(String(error), 500);
  }
});

// ── Visitors: create ───────────────────────────────────────────────
export const createVisitor = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "visitors.write");
  if (authResult instanceof Response) return authResult;

  try {
    const body = await request.json();
    const result = await ctx.runMutation(createVisitorRef, {
      workspaceId: authResult.workspaceId,
      email: body.email,
      name: body.name,
      externalUserId: body.externalUserId,
      customAttributes: body.customAttributes,
    });
    return jsonResponse(result, 201);
  } catch (error) {
    return errorResponse(String(error), 500);
  }
});

// ── Visitors: update ───────────────────────────────────────────────
export const updateVisitor = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "visitors.write");
  if (authResult instanceof Response) return authResult;

  try {
    const body = await request.json();
    const { visitorId, email, name, externalUserId, customAttributes } = body;
    if (!visitorId) return errorResponse("Missing visitorId", 400);

    const result = await ctx.runMutation(updateVisitorRef, {
      workspaceId: authResult.workspaceId,
      visitorId,
      email,
      name,
      externalUserId,
      customAttributes,
    });
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(String(error), 500);
  }
});

// ── Tickets: list ──────────────────────────────────────────────────
export const listTickets = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "tickets.read");
  if (authResult instanceof Response) return authResult;

  try {
    const url = new URL(request.url);
    const { cursor, limit } = parsePaginationParams(url);
    const status = url.searchParams.get("status");

    const result = await ctx.runQuery(listTicketsRef, {
      workspaceId: authResult.workspaceId,
      cursor: cursor ?? undefined,
      limit,
      status: status ?? undefined,
    });
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(String(error), 500);
  }
});

// ── Tickets: get ───────────────────────────────────────────────────
export const getTicket = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "tickets.read");
  if (authResult instanceof Response) return authResult;

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return errorResponse("Missing id parameter", 400);

    const result = await ctx.runQuery(getTicketRef, {
      workspaceId: authResult.workspaceId,
      ticketId: id,
    });
    if (!result) return errorResponse("Ticket not found", 404);
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(String(error), 500);
  }
});

// ── Tickets: create ────────────────────────────────────────────────
export const createTicket = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "tickets.write");
  if (authResult instanceof Response) return authResult;

  try {
    const body = await request.json();
    if (!body.subject) return errorResponse("Missing subject", 400);

    const result = await ctx.runMutation(createTicketRef, {
      workspaceId: authResult.workspaceId,
      subject: body.subject,
      description: body.description,
      priority: body.priority,
      visitorId: body.visitorId,
      conversationId: body.conversationId,
      assigneeId: body.assigneeId,
    });
    return jsonResponse(result, 201);
  } catch (error) {
    return errorResponse(String(error), 500);
  }
});

// ── Tickets: update ────────────────────────────────────────────────
export const updateTicket = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "tickets.write");
  if (authResult instanceof Response) return authResult;

  try {
    const body = await request.json();
    const { ticketId, status, priority, assigneeId, resolutionSummary } = body;
    if (!ticketId) return errorResponse("Missing ticketId", 400);

    const result = await ctx.runMutation(updateTicketRef, {
      workspaceId: authResult.workspaceId,
      ticketId,
      status,
      priority,
      assigneeId,
      resolutionSummary,
    });
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(String(error), 500);
  }
});

// ── Events: feed ───────────────────────────────────────────────────
export const eventsFeed = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "events.read");
  if (authResult instanceof Response) return authResult;

  try {
    const url = new URL(request.url);
    const { cursor, limit } = parsePaginationParams(url);

    const result = await ctx.runQuery(listEventsRef, {
      workspaceId: authResult.workspaceId,
      cursor: cursor ?? undefined,
      limit,
    });
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(String(error), 500);
  }
});
