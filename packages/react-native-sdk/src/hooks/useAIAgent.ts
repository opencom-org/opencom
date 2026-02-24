import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import { getVisitorState } from "@opencom/sdk-core";

export type AIResponseId = Id<"aiResponses">;
export type ConversationId = Id<"conversations">;

export interface AIResponseData {
  _id: AIResponseId;
  conversationId: ConversationId;
  messageId: Id<"messages">;
  query: string;
  response: string;
  sources: Array<{
    type: string;
    id: string;
    title: string;
  }>;
  confidence: number;
  handedOff: boolean;
  feedback?: "helpful" | "not_helpful";
  createdAt: number;
}

export function useAIAgent(conversationId: ConversationId | null) {
  const { visitorId, sessionToken } = getVisitorState();

  const aiResponses = useQuery(
    api.aiAgent.getConversationResponses,
    conversationId && visitorId && sessionToken
      ? { conversationId, visitorId, sessionToken }
      : "skip"
  );

  const submitFeedbackMutation = useMutation(api.aiAgent.submitFeedback);
  const handoffMutation = useMutation(api.aiAgent.handoffToHuman);

  const submitFeedback = async (
    responseId: AIResponseId,
    feedback: "helpful" | "not_helpful"
  ): Promise<void> => {
    if (!visitorId || !sessionToken) return;
    await submitFeedbackMutation({
      responseId,
      feedback,
      visitorId,
      sessionToken,
    });
  };

  const handoffToHuman = async (
    reason?: string
  ): Promise<{
    messageId: Id<"messages">;
    handoffMessage: string;
  } | null> => {
    if (!conversationId) return null;

    const result = await handoffMutation({
      conversationId,
      visitorId: visitorId ?? undefined,
      sessionToken: sessionToken ?? undefined,
      reason,
    });

    return result;
  };

  return {
    aiResponses: (aiResponses ?? []) as AIResponseData[],
    isLoading: aiResponses === undefined,
    submitFeedback,
    handoffToHuman,
  };
}
