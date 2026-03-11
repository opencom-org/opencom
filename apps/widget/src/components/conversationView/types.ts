import type { Id } from "@opencom/convex/dataModel";

export interface ConversationViewProps {
  conversationId: Id<"conversations">;
  visitorId: Id<"visitors">;
  conversationStatus: "open" | "closed" | "snoozed";
  activeWorkspaceId: string;
  sessionId: string;
  sessionTokenRef: React.MutableRefObject<string | null>;
  sessionToken: string | null;
  userInfo: { email?: string } | undefined;
  automationSettings:
    | {
        suggestArticlesEnabled?: boolean;
        collectEmailEnabled?: boolean;
        showReplyTimeEnabled?: boolean;
        askForRatingEnabled?: boolean;
      }
    | undefined;
  officeHoursStatus: { isOpen: boolean; offlineMessage?: string } | undefined;
  expectedReplyTime: string | undefined;
  commonIssueButtons:
    | Array<{
        _id: string;
        label: string;
        action: string;
        articleId?: Id<"articles">;
        conversationStarter?: string;
      }>
    | undefined;
  onBack: () => void;
  onClose: () => void;
  onSelectArticle: (id: Id<"articles">) => void;
}

export interface ConversationMessage {
  _id: string;
  _creationTime: number;
  senderType: string;
  senderId: string;
  content: string;
  senderName?: string;
}

export interface AiResponseSource {
  type: string;
  id: string;
  title: string;
  articleId?: string;
}

export interface AiResponseData {
  _id: string;
  messageId: string;
  feedback?: "helpful" | "not_helpful";
  handedOff?: boolean;
  sources?: AiResponseSource[];
}

export interface ArticleSuggestion {
  id: string;
  title: string;
  snippet: string;
  score: number;
}

export type AiFeedback = "helpful" | "not_helpful";

export interface CsatEligibility {
  eligible?: boolean;
  reason?: string;
}
