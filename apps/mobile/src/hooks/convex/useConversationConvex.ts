import type { Id } from "@opencom/convex/dataModel";
import { makeFunctionReference } from "convex/server";
import { useMobileMutation, useMobileQuery } from "../../lib/convex/hooks";
import type {
  MobileConversationMessage,
  MobileConversationRecord,
  MobileConversationStatus,
  MobileVisitorRecord,
} from "./types";

type ConversationIdArgs = {
  id: Id<"conversations">;
};

type MessagesListArgs = {
  conversationId: Id<"conversations">;
};

type SendMessageArgs = {
  conversationId: Id<"conversations">;
  senderId: Id<"users">;
  senderType: "agent";
  content: string;
};

type UpdateConversationStatusArgs = {
  id: Id<"conversations">;
  status: MobileConversationStatus;
};

type MarkConversationReadArgs = {
  id: Id<"conversations">;
  readerType: "agent" | "visitor";
};

const CONVERSATION_GET_QUERY_REF = makeFunctionReference<
  "query",
  ConversationIdArgs,
  MobileConversationRecord | null
>("conversations:get");
const VISITOR_GET_QUERY_REF = makeFunctionReference<
  "query",
  { id: Id<"visitors"> },
  MobileVisitorRecord
>("visitors:get");
const MESSAGES_LIST_QUERY_REF = makeFunctionReference<
  "query",
  MessagesListArgs,
  MobileConversationMessage[]
>("messages:list");
const SEND_MESSAGE_MUTATION_REF = makeFunctionReference<
  "mutation",
  SendMessageArgs,
  Id<"messages">
>("messages:send");
const UPDATE_CONVERSATION_STATUS_MUTATION_REF = makeFunctionReference<
  "mutation",
  UpdateConversationStatusArgs,
  null
>("conversations:updateStatus");
const MARK_CONVERSATION_READ_MUTATION_REF = makeFunctionReference<
  "mutation",
  MarkConversationReadArgs,
  null
>("conversations:markAsRead");

function resolveConversationId(
  conversationId?: string | Id<"conversations"> | null
): Id<"conversations"> | null {
  return conversationId ? (conversationId as Id<"conversations">) : null;
}

export function useConversationConvex(conversationId?: string | Id<"conversations"> | null) {
  const resolvedConversationId = resolveConversationId(conversationId);
  const conversation = useMobileQuery(
    CONVERSATION_GET_QUERY_REF,
    resolvedConversationId ? { id: resolvedConversationId } : "skip"
  );

  return {
    conversation,
    markConversationRead: useMobileMutation(MARK_CONVERSATION_READ_MUTATION_REF),
    messages: useMobileQuery(
      MESSAGES_LIST_QUERY_REF,
      resolvedConversationId ? { conversationId: resolvedConversationId } : "skip"
    ),
    resolvedConversationId,
    sendMessage: useMobileMutation(SEND_MESSAGE_MUTATION_REF),
    updateConversationStatus: useMobileMutation(UPDATE_CONVERSATION_STATUS_MUTATION_REF),
    visitor: useMobileQuery(
      VISITOR_GET_QUERY_REF,
      conversation?.visitorId ? { id: conversation.visitorId } : "skip"
    ),
  };
}
