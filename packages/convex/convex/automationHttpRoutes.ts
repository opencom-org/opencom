import { makeFunctionReference } from "convex/server";
import { httpAction } from "./_generated/server";
import { withAutomationAuth } from "./lib/automationAuth";
import { jsonResponse, errorResponse, parsePaginationParams, isPlausibleConvexId } from "./lib/apiHelpers";

function catchToResponse(error: unknown): Response {
  const msg = String(error);
  if (msg.includes("is not a valid ID") || msg.includes("Unable to parse")) {
    return errorResponse("Invalid resource ID", 400);
  }
  // Convex validator errors (bad enum values, wrong types, missing fields)
  if (
    msg.includes("is not a valid value") ||
    msg.includes("Validator error") ||
    msg.includes("did not match any variant")
  ) {
    return errorResponse(msg, 400);
  }
  // Business logic errors from helpers (not found, guards, cycles)
  if (
    msg.includes("not found") ||
    msg.includes("Cannot delete") ||
    msg.includes("cannot be") ||
    msg.includes("Collection not found") ||
    msg.includes("Parent collection not found")
  ) {
    return errorResponse(msg, 400);
  }
  return errorResponse(msg, 500);
}

// Use makeFunctionReference for cross-module references (no codegen dependency).
// Args/return types are untyped since codegen hasn't run; runtime validation
// is handled by each internal function's Convex validators.
const fn = (name: string) => makeFunctionReference(name) as any;

const listConversationsRef = fn("automationApiInternals:listConversationsForAutomation");
const getConversationRef = fn("automationApiInternals:getConversationForAutomation");
const updateConversationRef = fn("automationApiInternals:updateConversationForAutomation");
const listMessagesRef = fn("automationApiInternals:listMessagesForAutomation");
const listVisitorsRef = fn("automationApiInternals:listVisitorsForAutomation");
const getVisitorRef = fn("automationApiInternals:getVisitorForAutomation");
const createVisitorRef = fn("automationApiInternals:createVisitorForAutomation");
const updateVisitorRef = fn("automationApiInternals:updateVisitorForAutomation");
const listTicketsRef = fn("automationApiInternals:listTicketsForAutomation");
const getTicketRef = fn("automationApiInternals:getTicketForAutomation");
const createTicketRef = fn("automationApiInternals:createTicketForAutomation");
const updateTicketRef = fn("automationApiInternals:updateTicketForAutomation");
const sendMessageIdempotentRef = fn("automationApiInternals:sendMessageIdempotent");
const claimConversationRef = fn("automationConversationClaims:claimConversation");
const releaseConversationRef = fn("automationConversationClaims:releaseConversation");
const escalateConversationRef = fn("automationConversationClaims:escalateConversation");
const listArticlesRef = fn("automationApiInternals:listArticlesForAutomation");
const getArticleRef = fn("automationApiInternals:getArticleForAutomation");
const createArticleRef = fn("automationApiInternals:createArticleForAutomation");
const updateArticleRef = fn("automationApiInternals:updateArticleForAutomation");
const deleteArticleRef = fn("automationApiInternals:deleteArticleForAutomation");
const listCollectionsRef = fn("automationApiInternals:listCollectionsForAutomation");
const getCollectionRef = fn("automationApiInternals:getCollectionForAutomation");
const createCollectionRef = fn("automationApiInternals:createCollectionForAutomation");
const updateCollectionRef = fn("automationApiInternals:updateCollectionForAutomation");
const deleteCollectionRef = fn("automationApiInternals:deleteCollectionForAutomation");
const listEventsRef = fn("automationEvents:listEvents");
const replayDeliveryRef = fn("automationWebhookWorker:replayDelivery");

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
    const channel = url.searchParams.get("channel");
    const email = url.searchParams.get("email");
    const externalUserId = url.searchParams.get("externalUserId");
    const customAttributeKey = url.searchParams.get("customAttribute.key");
    const customAttributeValue = url.searchParams.get("customAttribute.value");

    const result = await ctx.runQuery(listConversationsRef, {
      workspaceId: authResult.workspaceId,
      cursor: cursor ?? undefined,
      limit,
      updatedSince: updatedSince ?? undefined,
      status: status ?? undefined,
      assigneeId: assignee ?? undefined,
      channel: channel ?? undefined,
      email: email ?? undefined,
      externalUserId: externalUserId ?? undefined,
      customAttributeKey: customAttributeKey ?? undefined,
      customAttributeValue: customAttributeValue ?? undefined,
    });
    return jsonResponse(result);
  } catch (error) {
    return catchToResponse(error);
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
    if (!isPlausibleConvexId(id)) return errorResponse("Invalid id format", 400);

    const result = await ctx.runQuery(getConversationRef, {
      workspaceId: authResult.workspaceId,
      conversationId: id,
    });
    if (!result) return errorResponse("Conversation not found", 404);
    return jsonResponse(result);
  } catch (error) {
    return catchToResponse(error);
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
      credentialId: authResult.credentialId,
      status,
      assignedAgentId,
    });
    return jsonResponse(result);
  } catch (error) {
    return catchToResponse(error);
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
    return catchToResponse(error);
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

    const idempotencyKey = request.headers.get("Idempotency-Key");

    const result = await ctx.runMutation(sendMessageIdempotentRef, {
      workspaceId: authResult.workspaceId,
      conversationId,
      credentialId: authResult.credentialId,
      actorName: authResult.actorName,
      content,
      idempotencyKey: idempotencyKey ?? undefined,
    }) as { cached: boolean; result: unknown };

    if (result.cached) {
      return jsonResponse(result.result, 200);
    }
    return jsonResponse(result.result, 201);
  } catch (error) {
    return catchToResponse(error);
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
    return catchToResponse(error);
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
    return catchToResponse(error);
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
    return catchToResponse(error);
  }
});

// ── Visitors: list ─────────────────────────────────────────────────
export const listVisitors = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "visitors.read");
  if (authResult instanceof Response) return authResult;

  try {
    const url = new URL(request.url);
    const { cursor, limit, updatedSince } = parsePaginationParams(url);
    const email = url.searchParams.get("email");
    const externalUserId = url.searchParams.get("externalUserId");
    const customAttributeKey = url.searchParams.get("customAttribute.key");
    const customAttributeValue = url.searchParams.get("customAttribute.value");

    const result = await ctx.runQuery(listVisitorsRef, {
      workspaceId: authResult.workspaceId,
      cursor: cursor ?? undefined,
      limit,
      updatedSince: updatedSince ?? undefined,
      email: email ?? undefined,
      externalUserId: externalUserId ?? undefined,
      customAttributeKey: customAttributeKey ?? undefined,
      customAttributeValue: customAttributeValue ?? undefined,
    });
    return jsonResponse(result);
  } catch (error) {
    return catchToResponse(error);
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
    if (!isPlausibleConvexId(id)) return errorResponse("Invalid id format", 400);

    const result = await ctx.runQuery(getVisitorRef, {
      workspaceId: authResult.workspaceId,
      visitorId: id,
    });
    if (!result) return errorResponse("Visitor not found", 404);
    return jsonResponse(result);
  } catch (error) {
    return catchToResponse(error);
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
      credentialId: authResult.credentialId,
      email: body.email,
      name: body.name,
      externalUserId: body.externalUserId,
      customAttributes: body.customAttributes,
    });
    return jsonResponse(result, 201);
  } catch (error) {
    return catchToResponse(error);
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
      credentialId: authResult.credentialId,
      visitorId,
      email,
      name,
      externalUserId,
      customAttributes,
    });
    return jsonResponse(result);
  } catch (error) {
    return catchToResponse(error);
  }
});

// ── Tickets: list ──────────────────────────────────────────────────
export const listTickets = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "tickets.read");
  if (authResult instanceof Response) return authResult;

  try {
    const url = new URL(request.url);
    const { cursor, limit, updatedSince } = parsePaginationParams(url);
    const status = url.searchParams.get("status");
    const priority = url.searchParams.get("priority");
    const assignee = url.searchParams.get("assignee");

    const result = await ctx.runQuery(listTicketsRef, {
      workspaceId: authResult.workspaceId,
      cursor: cursor ?? undefined,
      limit,
      updatedSince: updatedSince ?? undefined,
      status: status ?? undefined,
      priority: priority ?? undefined,
      assigneeId: assignee ?? undefined,
    });
    return jsonResponse(result);
  } catch (error) {
    return catchToResponse(error);
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
    if (!isPlausibleConvexId(id)) return errorResponse("Invalid id format", 400);

    const result = await ctx.runQuery(getTicketRef, {
      workspaceId: authResult.workspaceId,
      ticketId: id,
    });
    if (!result) return errorResponse("Ticket not found", 404);
    return jsonResponse(result);
  } catch (error) {
    return catchToResponse(error);
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
      credentialId: authResult.credentialId,
      subject: body.subject,
      description: body.description,
      priority: body.priority,
      visitorId: body.visitorId,
      conversationId: body.conversationId,
      assigneeId: body.assigneeId,
    });
    return jsonResponse(result, 201);
  } catch (error) {
    return catchToResponse(error);
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
      credentialId: authResult.credentialId,
      ticketId,
      status,
      priority,
      assigneeId,
      resolutionSummary,
    });
    return jsonResponse(result);
  } catch (error) {
    return catchToResponse(error);
  }
});

// ── Webhooks: replay ──────────────────────────────────────────────
export const replayWebhookDelivery = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "webhooks.manage");
  if (authResult instanceof Response) return authResult;

  try {
    const body = await request.json();
    const { deliveryId } = body;
    if (!deliveryId) return errorResponse("Missing deliveryId", 400);

    const result = await ctx.runMutation(replayDeliveryRef, {
      deliveryId,
      workspaceId: authResult.workspaceId,
    });
    return jsonResponse(result, 201);
  } catch (error) {
    return catchToResponse(error);
  }
});

// ── Articles: list ─────────────────────────────────────────────────
export const listArticles = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "articles.read");
  if (authResult instanceof Response) return authResult;

  try {
    const url = new URL(request.url);
    const { cursor, limit, updatedSince } = parsePaginationParams(url);
    const status = url.searchParams.get("status");
    const collectionId = url.searchParams.get("collectionId");

    const result = await ctx.runQuery(listArticlesRef, {
      workspaceId: authResult.workspaceId,
      cursor: cursor ?? undefined,
      limit,
      updatedSince: updatedSince ?? undefined,
      status: status ?? undefined,
      collectionId: collectionId ?? undefined,
    });
    return jsonResponse(result);
  } catch (error) {
    return catchToResponse(error);
  }
});

// ── Articles: get ──────────────────────────────────────────────────
export const getArticle = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "articles.read");
  if (authResult instanceof Response) return authResult;

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return errorResponse("Missing id parameter", 400);
    if (!isPlausibleConvexId(id)) return errorResponse("Invalid id format", 400);

    const result = await ctx.runQuery(getArticleRef, {
      workspaceId: authResult.workspaceId,
      articleId: id,
    });
    if (!result) return errorResponse("Article not found", 404);
    return jsonResponse(result);
  } catch (error) {
    return catchToResponse(error);
  }
});

// ── Articles: create ───────────────────────────────────────────────
export const createArticle = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "articles.write");
  if (authResult instanceof Response) return authResult;

  try {
    const body = await request.json();
    if (!body.title) return errorResponse("Missing title", 400);
    if (!body.content) return errorResponse("Missing content", 400);

    const result = await ctx.runMutation(createArticleRef, {
      workspaceId: authResult.workspaceId,
      credentialId: authResult.credentialId,
      title: body.title,
      content: body.content,
      collectionId: body.collectionId,
      visibility: body.visibility,
      tags: body.tags,
    });
    return jsonResponse(result, 201);
  } catch (error) {
    return catchToResponse(error);
  }
});

// ── Articles: update ───────────────────────────────────────────────
export const updateArticle = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "articles.write");
  if (authResult instanceof Response) return authResult;

  try {
    const body = await request.json();
    if (!body.articleId) return errorResponse("Missing articleId", 400);

    const result = await ctx.runMutation(updateArticleRef, {
      workspaceId: authResult.workspaceId,
      credentialId: authResult.credentialId,
      articleId: body.articleId,
      title: body.title,
      content: body.content,
      collectionId: body.collectionId,
      visibility: body.visibility,
      tags: body.tags,
      status: body.status,
    });
    return jsonResponse(result);
  } catch (error) {
    return catchToResponse(error);
  }
});

// ── Articles: delete ───────────────────────────────────────────────
export const deleteArticle = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "articles.write");
  if (authResult instanceof Response) return authResult;

  try {
    const body = await request.json();
    if (!body.articleId) return errorResponse("Missing articleId", 400);

    const result = await ctx.runMutation(deleteArticleRef, {
      workspaceId: authResult.workspaceId,
      credentialId: authResult.credentialId,
      articleId: body.articleId,
    });
    return jsonResponse(result);
  } catch (error) {
    return catchToResponse(error);
  }
});

// ── Collections: list ──────────────────────────────────────────────
export const listCollections = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "collections.read");
  if (authResult instanceof Response) return authResult;

  try {
    const url = new URL(request.url);
    const { cursor, limit, updatedSince } = parsePaginationParams(url);
    const parentId = url.searchParams.get("parentId");

    const result = await ctx.runQuery(listCollectionsRef, {
      workspaceId: authResult.workspaceId,
      cursor: cursor ?? undefined,
      limit,
      updatedSince: updatedSince ?? undefined,
      parentId: parentId ?? undefined,
    });
    return jsonResponse(result);
  } catch (error) {
    return catchToResponse(error);
  }
});

// ── Collections: get ───────────────────────────────────────────────
export const getCollection = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "collections.read");
  if (authResult instanceof Response) return authResult;

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return errorResponse("Missing id parameter", 400);
    if (!isPlausibleConvexId(id)) return errorResponse("Invalid id format", 400);

    const result = await ctx.runQuery(getCollectionRef, {
      workspaceId: authResult.workspaceId,
      collectionId: id,
    });
    if (!result) return errorResponse("Collection not found", 404);
    return jsonResponse(result);
  } catch (error) {
    return catchToResponse(error);
  }
});

// ── Collections: create ────────────────────────────────────────────
export const createCollection = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "collections.write");
  if (authResult instanceof Response) return authResult;

  try {
    const body = await request.json();
    if (!body.name) return errorResponse("Missing name", 400);

    const result = await ctx.runMutation(createCollectionRef, {
      workspaceId: authResult.workspaceId,
      credentialId: authResult.credentialId,
      name: body.name,
      description: body.description,
      icon: body.icon,
      parentId: body.parentId,
    });
    return jsonResponse(result, 201);
  } catch (error) {
    return catchToResponse(error);
  }
});

// ── Collections: update ────────────────────────────────────────────
export const updateCollection = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "collections.write");
  if (authResult instanceof Response) return authResult;

  try {
    const body = await request.json();
    if (!body.collectionId) return errorResponse("Missing collectionId", 400);

    const result = await ctx.runMutation(updateCollectionRef, {
      workspaceId: authResult.workspaceId,
      credentialId: authResult.credentialId,
      collectionId: body.collectionId,
      name: body.name,
      description: body.description,
      icon: body.icon,
      parentId: body.parentId,
    });
    return jsonResponse(result);
  } catch (error) {
    return catchToResponse(error);
  }
});

// ── Collections: delete ────────────────────────────────────────────
export const deleteCollection = httpAction(async (ctx, request) => {
  const authResult = await withAutomationAuth(asAuthCtx(ctx), request, "collections.write");
  if (authResult instanceof Response) return authResult;

  try {
    const body = await request.json();
    if (!body.collectionId) return errorResponse("Missing collectionId", 400);

    const result = await ctx.runMutation(deleteCollectionRef, {
      workspaceId: authResult.workspaceId,
      credentialId: authResult.credentialId,
      collectionId: body.collectionId,
    });
    return jsonResponse(result);
  } catch (error) {
    return catchToResponse(error);
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
    return catchToResponse(error);
  }
});
