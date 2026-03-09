import { useQuery, useMutation } from "convex/react";
import type { Id } from "@opencom/convex/dataModel";
import { getVisitorState } from "@opencom/sdk-core";
import { makeFunctionReference, type FunctionReference } from "convex/server";

function getQueryRef(name: string): FunctionReference<"query"> {
  return makeFunctionReference(name) as FunctionReference<"query">;
}

function getMutationRef(name: string): FunctionReference<"mutation"> {
  return makeFunctionReference(name) as FunctionReference<"mutation">;
}

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
    articleId?: string;
  }>;
  confidence: number;
  handedOff: boolean;
  feedback?: "helpful" | "not_helpful";
  createdAt: number;
}

export function useAIAgent(conversationId: ConversationId | null) {
  const { visitorId, sessionToken } = getVisitorState();

  const aiResponses = useQuery(
    getQueryRef("aiAgent:getConversationResponses"),
    conversationId && visitorId && sessionToken
      ? { conversationId, visitorId, sessionToken }
      : "skip"
  );

  const submitFeedbackMutation = useMutation(getMutationRef("aiAgent:submitFeedback"));
  const handoffMutation = useMutation(getMutationRef("aiAgent:handoffToHuman"));

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
