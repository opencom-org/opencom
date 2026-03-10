import type { Id } from "@opencom/convex/dataModel";
import {
  useWidgetAction,
  useWidgetMutation,
  useWidgetQuery,
  widgetActionRef,
  widgetMutationRef,
  widgetQueryRef,
} from "../../lib/convex/hooks";
import type {
  ArticleSuggestion,
  ConversationMessage,
  CsatEligibility,
} from "../../components/conversationView/types";

type PersistedVisitorProfile = {
  email?: string;
  externalUserId?: string;
} | null;

type AiSettings = {
  enabled?: boolean;
} | null;

type AiResponseRecord = {
  _id?: string;
  messageId: string;
  handedOff?: boolean;
};

type ConversationDataRecord = {
  aiWorkflowState?: string | null;
} | null;

type ConversationQueryArgs = {
  conversationId: Id<"conversations">;
  visitorId?: Id<"visitors">;
  sessionToken?: string;
};

type ConversationGetArgs = {
  id: Id<"conversations">;
  visitorId?: Id<"visitors">;
};

type SearchWidgetSuggestionsArgs = {
  workspaceId: Id<"workspaces">;
  visitorId: Id<"visitors">;
  sessionToken: string;
  origin: string;
  query: string;
  limit: number;
};

type PublicAiSettingsArgs = {
  workspaceId: Id<"workspaces">;
};

type SessionArgs = {
  sessionId: string;
};

type SendMessageArgs = {
  conversationId: Id<"conversations">;
  senderId: Id<"visitors">;
  senderType: "visitor";
  content: string;
  visitorId: Id<"visitors">;
  sessionToken?: string;
};

type GenerateAiResponseArgs = {
  workspaceId: Id<"workspaces">;
  conversationId: Id<"conversations">;
  visitorId: Id<"visitors">;
  sessionToken?: string;
  query: string;
  conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

type IdentifyVisitorArgs = {
  visitorId: Id<"visitors">;
  sessionToken?: string;
  email: string;
  origin: string;
};

type SubmitAiFeedbackArgs = {
  responseId: Id<"aiResponses">;
  feedback: "helpful" | "not_helpful";
  visitorId: Id<"visitors">;
  sessionToken?: string;
};

type HandoffToHumanArgs = {
  conversationId: Id<"conversations">;
  visitorId: Id<"visitors">;
  sessionToken?: string;
  reason: string;
};

type ConversationViewConvexOptions = {
  conversationId: Id<"conversations">;
  visitorId: Id<"visitors">;
  activeWorkspaceId: string;
  sessionId: string;
  sessionToken: string | null;
  shouldEvaluateCsat: boolean;
};

const SEND_MESSAGE_MUTATION_REF = widgetMutationRef<SendMessageArgs, unknown>("messages:send");
const IDENTIFY_VISITOR_MUTATION_REF = widgetMutationRef<IdentifyVisitorArgs, unknown>(
  "visitors:identify"
);
const GENERATE_AI_RESPONSE_ACTION_REF = widgetActionRef<GenerateAiResponseArgs, unknown>(
  "aiAgentActions:generateResponse"
);
const SUBMIT_AI_FEEDBACK_MUTATION_REF = widgetMutationRef<SubmitAiFeedbackArgs, unknown>(
  "aiAgent:submitFeedback"
);
const HANDOFF_TO_HUMAN_MUTATION_REF = widgetMutationRef<HandoffToHumanArgs, unknown>(
  "aiAgent:handoffToHuman"
);
const SEARCH_ARTICLE_SUGGESTIONS_ACTION_REF = widgetActionRef<
  SearchWidgetSuggestionsArgs,
  ArticleSuggestion[]
>("suggestions:searchForWidget");
const MESSAGES_LIST_QUERY_REF = widgetQueryRef<ConversationQueryArgs, ConversationMessage[]>(
  "messages:list"
);
const VISITOR_BY_SESSION_QUERY_REF = widgetQueryRef<SessionArgs, PersistedVisitorProfile>(
  "visitors:getBySession"
);
const PUBLIC_AI_SETTINGS_QUERY_REF = widgetQueryRef<PublicAiSettingsArgs, AiSettings>(
  "aiAgent:getPublicSettings"
);
const CONVERSATION_RESPONSES_QUERY_REF = widgetQueryRef<ConversationQueryArgs, AiResponseRecord[]>(
  "aiAgent:getConversationResponses"
);
const CONVERSATION_GET_QUERY_REF = widgetQueryRef<ConversationGetArgs, ConversationDataRecord>(
  "conversations:get"
);
const CSAT_ELIGIBILITY_QUERY_REF = widgetQueryRef<ConversationQueryArgs, CsatEligibility>(
  "reporting:getCsatEligibility"
);

export function useConversationViewConvex({
  conversationId,
  visitorId,
  activeWorkspaceId,
  sessionId,
  sessionToken,
  shouldEvaluateCsat,
}: ConversationViewConvexOptions) {
  const sendMessageMutation = useWidgetMutation(SEND_MESSAGE_MUTATION_REF);
  const identifyVisitor = useWidgetMutation(IDENTIFY_VISITOR_MUTATION_REF);
  const generateAiResponse = useWidgetAction(GENERATE_AI_RESPONSE_ACTION_REF);
  const submitAiFeedback = useWidgetMutation(SUBMIT_AI_FEEDBACK_MUTATION_REF);
  const handoffToHuman = useWidgetMutation(HANDOFF_TO_HUMAN_MUTATION_REF);
  const searchArticleSuggestions = useWidgetAction(SEARCH_ARTICLE_SUGGESTIONS_ACTION_REF);

  const messages = useWidgetQuery(MESSAGES_LIST_QUERY_REF, {
    conversationId,
    visitorId,
    sessionToken: sessionToken ?? undefined,
  });
  const persistedVisitorProfile = useWidgetQuery(
    VISITOR_BY_SESSION_QUERY_REF,
    sessionId ? { sessionId } : "skip"
  );
  const aiSettings = useWidgetQuery(PUBLIC_AI_SETTINGS_QUERY_REF, {
    workspaceId: activeWorkspaceId as Id<"workspaces">,
  });
  const aiResponses = useWidgetQuery(CONVERSATION_RESPONSES_QUERY_REF, {
    conversationId,
    visitorId,
    sessionToken: sessionToken ?? undefined,
  });
  const conversationData = useWidgetQuery(CONVERSATION_GET_QUERY_REF, {
    id: conversationId,
    visitorId,
  });
  const csatEligibility = useWidgetQuery(
    CSAT_ELIGIBILITY_QUERY_REF,
    shouldEvaluateCsat
      ? {
          conversationId,
          visitorId,
          sessionToken: sessionToken ?? undefined,
        }
      : "skip"
  );

  return {
    aiResponses,
    aiSettings,
    conversationData,
    csatEligibility,
    generateAiResponse,
    handoffToHuman,
    identifyVisitor,
    messages,
    persistedVisitorProfile,
    searchArticleSuggestions,
    sendMessageMutation,
    submitAiFeedback,
  };
}
