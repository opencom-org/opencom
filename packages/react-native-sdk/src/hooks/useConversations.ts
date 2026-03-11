import type { Id } from "@opencom/convex/dataModel";
import { sdkMutationRef, sdkQueryRef, useSdkMutation, useSdkQuery } from "../internal/convex";
import {
  hasVisitorSessionTransport,
  hasVisitorWorkspaceTransport,
} from "../internal/runtime";
import { useSdkTransportContext } from "../internal/opencomContext";

const LIST_CONVERSATIONS_REF = sdkQueryRef("conversations:listByVisitor");
const TOTAL_UNREAD_REF = sdkQueryRef("conversations:getTotalUnreadForVisitor");
const LIST_MESSAGES_REF = sdkQueryRef("messages:list");
const SEND_MESSAGE_REF = sdkMutationRef("messages:send");
const MARK_AS_READ_REF = sdkMutationRef("conversations:markAsRead");
const CREATE_CONVERSATION_REF = sdkMutationRef("conversations:createForVisitor");

export interface ConversationSummaryRecord {
  _id: Id<"conversations">;
  createdAt: number;
  updatedAt?: number;
  lastMessageAt?: number;
  unreadByVisitor?: number;
  lastMessage?: {
    content?: string;
    senderType?: string;
  } | null;
}

export interface ConversationMessageRecord {
  _id: Id<"messages"> | string;
  _creationTime: number;
  senderType: "visitor" | string;
  content: string;
}

export function useConversations() {
  const transport = useSdkTransportContext();

  const conversations = useSdkQuery<ConversationSummaryRecord[]>(
    LIST_CONVERSATIONS_REF,
    hasVisitorWorkspaceTransport(transport)
      ? {
          visitorId: transport.visitorId,
          sessionToken: transport.sessionToken,
          workspaceId: transport.workspaceId,
        }
      : "skip"
  );

  const totalUnread = useSdkQuery<number>(
    TOTAL_UNREAD_REF,
    hasVisitorWorkspaceTransport(transport)
      ? {
          visitorId: transport.visitorId,
          sessionToken: transport.sessionToken,
          workspaceId: transport.workspaceId,
        }
      : "skip"
  );

  return {
    conversations: conversations ?? [],
    totalUnread: totalUnread ?? 0,
    isLoading: conversations === undefined,
  };
}

export function useConversation(conversationId: Id<"conversations"> | null) {
  const transport = useSdkTransportContext();

  const messages = useSdkQuery<ConversationMessageRecord[]>(
    LIST_MESSAGES_REF,
    conversationId && transport.visitorId
      ? {
          conversationId,
          visitorId: transport.visitorId,
          sessionToken: transport.sessionToken ?? undefined,
        }
      : "skip"
  );

  const sendMessageMutation = useSdkMutation<Record<string, unknown>, unknown>(SEND_MESSAGE_REF);
  const markAsReadMutation = useSdkMutation<Record<string, unknown>, unknown>(MARK_AS_READ_REF);

  const sendMessage = async (content: string) => {
    if (!conversationId || !transport.visitorId) return;

    await sendMessageMutation({
      conversationId,
      senderId: transport.visitorId,
      senderType: "visitor",
      content,
      visitorId: transport.visitorId,
      sessionToken: transport.sessionToken ?? undefined,
    });
  };

  const markAsRead = async () => {
    if (!conversationId || !transport.sessionToken) return;

    await markAsReadMutation({
      id: conversationId,
      readerType: "visitor",
      visitorId: transport.visitorId ?? undefined,
      sessionToken: transport.sessionToken,
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
  const transport = useSdkTransportContext();
  const createConversationMutation = useSdkMutation<
    {
      workspaceId: Id<"workspaces">;
      visitorId: Id<"visitors">;
      sessionToken: string;
    },
    { _id: Id<"conversations"> } | null
  >(CREATE_CONVERSATION_REF);

  const createConversation = async (workspaceId: Id<"workspaces">) => {
    if (!hasVisitorSessionTransport(transport)) return null;

    return await createConversationMutation({
      workspaceId,
      visitorId: transport.visitorId,
      sessionToken: transport.sessionToken,
    });
  };

  return { createConversation };
}
