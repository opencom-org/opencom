import { makeFunctionReference, type FunctionReference } from "convex/server";
import type { Id } from "@opencom/convex/dataModel";
import { getClient, getConfig } from "./client";
import type { VisitorId, ConversationId } from "../types";
import { getVisitorState } from "../state/visitor";

const CREATE_CONVERSATION_REF =
  makeFunctionReference("conversations:createForVisitor") as FunctionReference<"mutation">;
const GET_OR_CREATE_CONVERSATION_REF =
  makeFunctionReference("conversations:getOrCreateForVisitor") as FunctionReference<"mutation">;
const LIST_MESSAGES_REF =
  makeFunctionReference("messages:list") as FunctionReference<"query">;
const LIST_CONVERSATIONS_BY_VISITOR_REF =
  makeFunctionReference("conversations:listByVisitor") as FunctionReference<"query">;
const MARK_AS_READ_REF =
  makeFunctionReference("conversations:markAsRead") as FunctionReference<"mutation">;
const SEND_MESSAGE_REF =
  makeFunctionReference("messages:send") as FunctionReference<"mutation">;

function requireVisitorSessionToken(sessionToken?: string): string {
  const resolvedSessionToken = sessionToken ?? getVisitorState().sessionToken ?? undefined;
  if (!resolvedSessionToken) {
    throw new Error("[OpencomSDK] sessionToken is required for visitor conversation APIs.");
  }
  return resolvedSessionToken;
}

export async function createConversation(
  visitorId: VisitorId,
  sessionToken?: string
): Promise<{ _id: ConversationId } | null> {
  const client = getClient();
  const config = getConfig();
  const resolvedSessionToken = requireVisitorSessionToken(sessionToken);

  const result = await client.mutation(CREATE_CONVERSATION_REF, {
    workspaceId: config.workspaceId as Id<"workspaces">,
    visitorId,
    sessionToken: resolvedSessionToken,
  });

  return result;
}

export async function getOrCreateConversation(
  visitorId: VisitorId,
  sessionToken?: string
): Promise<{ _id: ConversationId } | null> {
  const client = getClient();
  const config = getConfig();
  const resolvedSessionToken = requireVisitorSessionToken(sessionToken);

  const result = await client.mutation(GET_OR_CREATE_CONVERSATION_REF, {
    workspaceId: config.workspaceId as Id<"workspaces">,
    visitorId,
    sessionToken: resolvedSessionToken,
  });

  return result;
}

export async function getMessages(
  conversationId: ConversationId,
  visitorId?: VisitorId,
  sessionToken?: string
): Promise<
  Array<{
    _id: string;
    conversationId: ConversationId;
    senderId: string;
    senderType: "user" | "visitor" | "agent" | "bot";
    content: string;
    createdAt: number;
  }>
> {
  const client = getClient();

  const result = await client.query(LIST_MESSAGES_REF, {
    conversationId,
    visitorId,
    sessionToken,
  });

  return result;
}

export async function getConversations(visitorId: VisitorId, sessionToken?: string) {
  const client = getClient();
  const config = getConfig();
  const resolvedSessionToken = requireVisitorSessionToken(sessionToken);

  const result = await client.query(LIST_CONVERSATIONS_BY_VISITOR_REF, {
    visitorId,
    sessionToken: resolvedSessionToken,
    workspaceId: config.workspaceId as Id<"workspaces">,
  });

  return result;
}

export async function markAsRead(
  conversationId: ConversationId,
  visitorId?: VisitorId,
  sessionToken?: string
): Promise<void> {
  const client = getClient();
  const resolvedSessionToken = requireVisitorSessionToken(sessionToken);
  await client.mutation(MARK_AS_READ_REF, {
    id: conversationId,
    readerType: "visitor",
    visitorId,
    sessionToken: resolvedSessionToken,
  });
}

export async function sendMessage(params: {
  conversationId: ConversationId;
  visitorId: VisitorId;
  sessionToken?: string;
  content: string;
}): Promise<void> {
  const client = getClient();
  const resolvedSessionToken = params.sessionToken ?? getVisitorState().sessionToken ?? undefined;

  await client.mutation(SEND_MESSAGE_REF, {
    conversationId: params.conversationId,
    senderId: params.visitorId,
    senderType: "visitor",
    content: params.content,
    visitorId: params.visitorId,
    sessionToken: resolvedSessionToken,
  });
}
