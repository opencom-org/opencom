import type { Id } from "@opencom/convex/dataModel";
import { sdkMutationRef, sdkQueryRef, useSdkMutation, useSdkQuery } from "../internal/convex";
import { useSdkTransportContext } from "../internal/opencomContext";

const CONVERSATION_RESPONSES_REF = sdkQueryRef("aiAgent:getConversationResponses");
const SUBMIT_FEEDBACK_REF = sdkMutationRef("aiAgent:submitFeedback");
const HANDOFF_TO_HUMAN_REF = sdkMutationRef("aiAgent:handoffToHuman");

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
  const transport = useSdkTransportContext();

  const aiResponses = useSdkQuery<AIResponseData[]>(
    CONVERSATION_RESPONSES_REF,
    conversationId && transport.visitorId && transport.sessionToken
      ? {
          conversationId,
          visitorId: transport.visitorId,
          sessionToken: transport.sessionToken,
        }
      : "skip"
  );

  const submitFeedbackMutation = useSdkMutation<Record<string, unknown>, unknown>(
    SUBMIT_FEEDBACK_REF
  );
  const handoffMutation = useSdkMutation<
    Record<string, unknown>,
    {
      messageId: Id<"messages">;
      handoffMessage: string;
    } | null
  >(HANDOFF_TO_HUMAN_REF);

  const submitFeedback = async (
    responseId: AIResponseId,
    feedback: "helpful" | "not_helpful"
  ): Promise<void> => {
    if (!transport.visitorId || !transport.sessionToken) return;
    await submitFeedbackMutation({
      responseId,
      feedback,
      visitorId: transport.visitorId,
      sessionToken: transport.sessionToken,
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
      visitorId: transport.visitorId ?? undefined,
      sessionToken: transport.sessionToken ?? undefined,
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
