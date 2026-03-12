import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Id } from "@opencom/convex/dataModel";
import type { StagedSupportAttachment } from "@opencom/web-shared";

type ConversationStatus = "open" | "closed" | "snoozed";

export type ConversationUiPatch = {
  unreadByAgent?: number;
  status?: ConversationStatus;
  lastMessageAt?: number;
  optimisticLastMessage?: string;
};

interface ConversationSummaryForActions {
  _id: Id<"conversations">;
  unreadByAgent?: number;
  status?: ConversationStatus;
}

interface MutationApi {
  markAsRead: (args: { id: Id<"conversations">; readerType: "agent" }) => Promise<unknown>;
  sendMessage: (args: {
    conversationId: Id<"conversations">;
    senderId: Id<"users">;
    senderType: "agent";
    content: string;
    attachmentIds?: Id<"supportAttachments">[];
  }) => Promise<unknown>;
  updateStatus: (args: { id: Id<"conversations">; status: "closed" }) => Promise<unknown>;
  convertToTicket: (args: { conversationId: Id<"conversations"> }) => Promise<Id<"tickets">>;
}

interface MutationState {
  inputValue: string;
  pendingAttachments: StagedSupportAttachment<Id<"supportAttachments">>[];
  setInputValue: Dispatch<SetStateAction<string>>;
  setPendingAttachments: Dispatch<
    SetStateAction<StagedSupportAttachment<Id<"supportAttachments">>[]>
  >;
  setIsSending: Dispatch<SetStateAction<boolean>>;
  setIsResolving: Dispatch<SetStateAction<boolean>>;
  setIsConvertingTicket: Dispatch<SetStateAction<boolean>>;
  conversationPatches: Record<string, ConversationUiPatch>;
  setConversationPatches: Dispatch<SetStateAction<Record<string, ConversationUiPatch>>>;
  setReadSyncConversationId: Dispatch<SetStateAction<Id<"conversations"> | null>>;
  setSelectedConversationId: Dispatch<SetStateAction<Id<"conversations"> | null>>;
  setWorkflowError: Dispatch<SetStateAction<string | null>>;
}

interface MutationContext {
  userId: Id<"users"> | null;
  selectedConversationId: Id<"conversations"> | null;
  conversations: ConversationSummaryForActions[] | undefined;
  onTicketCreated: (ticketId: Id<"tickets">) => void;
}

export interface UseInboxMessageActionsArgs {
  api: MutationApi;
  state: MutationState;
  context: MutationContext;
}

export interface UseInboxMessageActionsResult {
  patchConversationState: (conversationId: Id<"conversations">, patch: ConversationUiPatch) => void;
  handleSelectConversation: (conversationId: Id<"conversations">) => Promise<void>;
  handleSendMessage: () => Promise<void>;
  handleResolveConversation: () => Promise<void>;
  handleConvertToTicket: () => Promise<void>;
}

export function useInboxMessageActions({
  api,
  state,
  context,
}: UseInboxMessageActionsArgs): UseInboxMessageActionsResult {
  const getOptimisticLastMessage = useCallback(
    (content: string) => {
      if (content.trim()) {
        return content;
      }
      const attachmentCount = state.pendingAttachments.length;
      if (attachmentCount === 0) {
        return "";
      }
      return attachmentCount === 1 ? "1 attachment" : `${attachmentCount} attachments`;
    },
    [state.pendingAttachments]
  );

  const patchConversationState = useCallback(
    (conversationId: Id<"conversations">, patch: ConversationUiPatch) => {
      state.setConversationPatches((previousState) => ({
        ...previousState,
        [conversationId]: {
          ...(previousState[conversationId] ?? {}),
          ...patch,
        },
      }));
    },
    [state]
  );

  const handleSelectConversation = useCallback(
    async (conversationId: Id<"conversations">) => {
      state.setWorkflowError(null);
      state.setSelectedConversationId(conversationId);
      const previousUnreadCount =
        context.conversations?.find((conversation) => conversation._id === conversationId)
          ?.unreadByAgent ?? 0;
      patchConversationState(conversationId, { unreadByAgent: 0 });
      state.setReadSyncConversationId(conversationId);

      try {
        await api.markAsRead({ id: conversationId, readerType: "agent" });
      } catch (error) {
        console.error("Failed to mark conversation as read:", error);
        patchConversationState(conversationId, { unreadByAgent: previousUnreadCount });
        state.setWorkflowError("Failed to sync read state. Please retry.");
      } finally {
        state.setReadSyncConversationId((current) => (current === conversationId ? null : current));
      }
    },
    [api, context.conversations, patchConversationState, state]
  );

  const handleSendMessage = useCallback(async () => {
    if (
      (!state.inputValue.trim() && state.pendingAttachments.length === 0) ||
      !context.selectedConversationId ||
      !context.userId
    ) {
      return;
    }

    const content = state.inputValue.trim();
    const conversationId = context.selectedConversationId;
    const attachmentIds = state.pendingAttachments.map((attachment) => attachment.attachmentId);
    const previousPatch = state.conversationPatches[conversationId];
    const now = Date.now();

    state.setWorkflowError(null);
    state.setIsSending(true);
    state.setInputValue("");
    patchConversationState(conversationId, {
      unreadByAgent: 0,
      lastMessageAt: now,
      optimisticLastMessage: getOptimisticLastMessage(content),
    });

    try {
      await api.sendMessage({
        conversationId,
        senderId: context.userId,
        senderType: "agent",
        content,
        attachmentIds,
      });
      state.setPendingAttachments([]);
    } catch (error) {
      console.error("Failed to send message:", error);
      state.setInputValue(content);
      state.setWorkflowError("Failed to send reply. Please try again.");
      state.setConversationPatches((previousState) => {
        const nextState = { ...previousState };
        if (previousPatch) {
          nextState[conversationId] = previousPatch;
        } else {
          delete nextState[conversationId];
        }
        return nextState;
      });
    } finally {
      state.setIsSending(false);
    }
  }, [
    api,
    context.selectedConversationId,
    context.userId,
    getOptimisticLastMessage,
    patchConversationState,
    state,
  ]);

  const handleResolveConversation = useCallback(async () => {
    if (!context.selectedConversationId) {
      return;
    }
    const conversationId = context.selectedConversationId;
    const previousPatch = state.conversationPatches[conversationId];

    state.setWorkflowError(null);
    state.setIsResolving(true);
    patchConversationState(conversationId, {
      status: "closed",
      unreadByAgent: 0,
    });

    try {
      await api.updateStatus({
        id: conversationId,
        status: "closed",
      });
    } catch (error) {
      console.error("Failed to resolve conversation:", error);
      state.setWorkflowError("Failed to resolve conversation. Please retry.");
      state.setConversationPatches((previousState) => {
        const nextState = { ...previousState };
        if (previousPatch) {
          nextState[conversationId] = previousPatch;
        } else {
          delete nextState[conversationId];
        }
        return nextState;
      });
    } finally {
      state.setIsResolving(false);
    }
  }, [api, context.selectedConversationId, patchConversationState, state]);

  const handleConvertToTicket = useCallback(async () => {
    if (!context.selectedConversationId) {
      return;
    }
    state.setWorkflowError(null);
    state.setIsConvertingTicket(true);
    try {
      const ticketId = await api.convertToTicket({
        conversationId: context.selectedConversationId,
      });
      context.onTicketCreated(ticketId);
    } catch (error) {
      console.error("Failed to convert to ticket:", error);
      state.setWorkflowError(
        "Failed to convert to ticket. A ticket may already exist for this conversation."
      );
    } finally {
      state.setIsConvertingTicket(false);
    }
  }, [api, context, state]);

  return {
    patchConversationState,
    handleSelectConversation,
    handleSendMessage,
    handleResolveConversation,
    handleConvertToTicket,
  };
}
