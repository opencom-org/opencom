import type { Id } from "@opencom/convex/dataModel";
import { useConversations, useCreateConversation } from "../../hooks/useConversations";
import { formatConversationTimestamp } from "./messengerFlow";

interface UseConversationListControllerInput {
  workspaceId: Id<"workspaces">;
  onSelectConversation: (conversationId: Id<"conversations">) => void;
  onNewConversation: (conversationId: Id<"conversations">) => void;
}

export function useConversationListController({
  workspaceId,
  onNewConversation,
  onSelectConversation,
}: UseConversationListControllerInput) {
  const { conversations, isLoading } = useConversations();
  const { createConversation } = useCreateConversation();

  const handleNewConversation = async () => {
    const result = await createConversation(workspaceId);
    if (result) {
      onNewConversation(result._id);
    }
  };

  return {
    conversations,
    isLoading,
    handleNewConversation,
    onSelectConversation,
    formatConversationTimestamp,
  };
}
