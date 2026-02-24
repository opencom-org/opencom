import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import { getClient, getConfig } from "./client";
import type { VisitorId, ConversationId } from "../types";
import { getVisitorState } from "../state/visitor";

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

  const result = await client.mutation(api.conversations.createForVisitor, {
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

  const result = await client.mutation(api.conversations.getOrCreateForVisitor, {
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

  const result = await client.query(api.messages.list, {
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

  const result = await client.query(api.conversations.listByVisitor, {
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
  await client.mutation(api.conversations.markAsRead, {
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

  await client.mutation(api.messages.send, {
    conversationId: params.conversationId,
    senderId: params.visitorId,
    senderType: "visitor",
    content: params.content,
    visitorId: params.visitorId,
    sessionToken: resolvedSessionToken,
  });
}
