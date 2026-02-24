import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { getVisitorState, getConfig } from "@opencom/sdk-core";
import type { Id } from "@opencom/convex/dataModel";

export function useConversations() {
  const { visitorId, sessionToken } = getVisitorState();
  let workspaceId: string | undefined;
  try {
    workspaceId = getConfig().workspaceId;
  } catch {
    /* not yet initialized */
  }

  const conversations = useQuery(
    api.conversations.listByVisitor,
    visitorId && sessionToken && workspaceId
      ? { visitorId, sessionToken, workspaceId: workspaceId as Id<"workspaces"> }
      : "skip"
  );

  const totalUnread = useQuery(
    api.conversations.getTotalUnreadForVisitor,
    visitorId && sessionToken && workspaceId
      ? { visitorId, sessionToken, workspaceId: workspaceId as Id<"workspaces"> }
      : "skip"
  );

  return {
    conversations: conversations ?? [],
    totalUnread: totalUnread ?? 0,
    isLoading: conversations === undefined,
  };
}

export function useConversation(conversationId: Id<"conversations"> | null) {
  const { visitorId, sessionToken } = getVisitorState();

  const messages = useQuery(
    api.messages.list,
    conversationId && visitorId
      ? { conversationId, visitorId, sessionToken: sessionToken ?? undefined }
      : "skip"
  );

  const sendMessageMutation = useMutation(api.messages.send);
  const markAsReadMutation = useMutation(api.conversations.markAsRead);

  const sendMessage = async (content: string) => {
    if (!conversationId || !visitorId) return;

    await sendMessageMutation({
      conversationId,
      senderId: visitorId,
      senderType: "visitor",
      content,
      visitorId,
      sessionToken: sessionToken ?? undefined,
    });
  };

  const markAsRead = async () => {
    if (!conversationId || !sessionToken) return;

    await markAsReadMutation({
      id: conversationId,
      readerType: "visitor",
      visitorId: visitorId ?? undefined,
      sessionToken,
    });
  };

  return {
    messages: messages ?? [],
    isLoading: messages === undefined,
    sendMessage,
    markAsRead,
  };
}

export function useCreateConversation() {
  const createConversationMutation = useMutation(api.conversations.createForVisitor);

  const createConversation = async (workspaceId: Id<"workspaces">) => {
    const { visitorId, sessionToken } = getVisitorState();
    if (!visitorId || !sessionToken) return null;

    return await createConversationMutation({
      workspaceId,
      visitorId,
      sessionToken,
    });
  };

  return { createConversation };
}
