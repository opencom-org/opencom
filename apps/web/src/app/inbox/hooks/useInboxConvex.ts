"use client";

import { useEffect, useState } from "react";
import type { Id } from "@opencom/convex/dataModel";
import type { SupportAttachmentFinalizeResult } from "@opencom/web-shared";
import {
  useWebAction,
  useWebMutation,
  useWebQuery,
  webActionRef,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";
import type {
  InboxAiResponse,
  InboxAiWorkflowFilter,
  InboxConversation,
  InboxKnowledgeItem,
  InboxMessage,
  InboxSnippet,
} from "../inboxRenderTypes";

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type ConversationArgs = {
  conversationId: Id<"conversations">;
};

type ConversationsForInboxArgs = {
  workspaceId: Id<"workspaces">;
  aiWorkflowState?: Exclude<InboxAiWorkflowFilter, "all">;
};

type AiSettingsRecord = {
  suggestionsEnabled?: boolean;
} | null;

type InboxConversationsResult = {
  conversations: InboxConversation[];
};

type SendMessageArgs = {
  conversationId: Id<"conversations">;
  senderId: Id<"users">;
  senderType: "agent";
  content: string;
  attachmentIds?: Id<"supportAttachments">[];
};

type SupportAttachmentUploadArgs = {
  workspaceId: Id<"workspaces">;
};

type FinalizeSupportAttachmentUploadArgs = SupportAttachmentUploadArgs & {
  storageId: Id<"_storage">;
  fileName?: string;
};

type MarkConversationReadArgs = {
  id: Id<"conversations">;
  readerType: "agent";
};

type UpdateConversationStatusArgs = {
  id: Id<"conversations">;
  status: "closed";
};

type ConvertConversationToTicketArgs = {
  conversationId: Id<"conversations">;
};

type SuggestionsForConversationArgs = {
  conversationId: Id<"conversations">;
  limit: number;
};

type CreateSnippetArgs = {
  workspaceId: Id<"workspaces">;
  name: string;
  content: string;
  shortcut?: string;
};

type UpdateSnippetArgs = {
  id: Id<"snippets">;
  name: string;
  content: string;
  shortcut?: string;
};

type KnowledgeSearchArgs = {
  workspaceId: Id<"workspaces">;
  query: string;
  limit: number;
};

type RecentlyUsedKnowledgeArgs = {
  userId: Id<"users">;
  workspaceId: Id<"workspaces">;
  limit: number;
};

type TrackKnowledgeAccessArgs = {
  userId: Id<"users">;
  workspaceId: Id<"workspaces">;
  contentType: InboxKnowledgeItem["type"];
  contentId: string;
};

const INBOX_CONVERSATIONS_QUERY_REF = webQueryRef<
  ConversationsForInboxArgs,
  InboxConversationsResult
>("conversations:listForInbox");
const AI_SETTINGS_QUERY_REF = webQueryRef<WorkspaceArgs, AiSettingsRecord>("aiAgent:getSettings");
const MESSAGES_LIST_QUERY_REF = webQueryRef<ConversationArgs, InboxMessage[]>("messages:list");
const AI_CONVERSATION_RESPONSES_QUERY_REF = webQueryRef<ConversationArgs, InboxAiResponse[]>(
  "aiAgent:getConversationResponses"
);
const SEND_MESSAGE_REF = webMutationRef<SendMessageArgs, unknown>("messages:send");
const GENERATE_SUPPORT_ATTACHMENT_UPLOAD_URL_REF = webMutationRef<
  SupportAttachmentUploadArgs,
  string
>("supportAttachments:generateUploadUrl");
const FINALIZE_SUPPORT_ATTACHMENT_UPLOAD_REF = webMutationRef<
  FinalizeSupportAttachmentUploadArgs,
  SupportAttachmentFinalizeResult<Id<"supportAttachments">>
>("supportAttachments:finalizeUpload");
const MARK_CONVERSATION_READ_REF = webMutationRef<MarkConversationReadArgs, unknown>(
  "conversations:markAsRead"
);
const UPDATE_CONVERSATION_STATUS_REF = webMutationRef<UpdateConversationStatusArgs, unknown>(
  "conversations:updateStatus"
);
const CONVERT_CONVERSATION_TO_TICKET_REF = webMutationRef<
  ConvertConversationToTicketArgs,
  Id<"tickets">
>("tickets:convertFromConversation");
const GET_SUGGESTIONS_FOR_CONVERSATION_REF = webActionRef<
  SuggestionsForConversationArgs,
  Array<{ id: string }>
>("suggestions:getForConversation");
const CREATE_SNIPPET_REF = webMutationRef<CreateSnippetArgs, Id<"snippets">>("snippets:create");
const UPDATE_SNIPPET_REF = webMutationRef<UpdateSnippetArgs, unknown>("snippets:update");
const SNIPPETS_LIST_QUERY_REF = webQueryRef<WorkspaceArgs, InboxSnippet[]>("snippets:list");
const KNOWLEDGE_SEARCH_ACTION_REF = webActionRef<KnowledgeSearchArgs, InboxKnowledgeItem[]>(
  "knowledge:searchWithEmbeddings"
);
const RECENTLY_USED_KNOWLEDGE_QUERY_REF = webQueryRef<
  RecentlyUsedKnowledgeArgs,
  InboxKnowledgeItem[]
>("knowledge:getRecentlyUsed");
const TRACK_KNOWLEDGE_ACCESS_REF = webMutationRef<TrackKnowledgeAccessArgs, null>(
  "knowledge:trackAccess"
);

type UseInboxConvexOptions = {
  workspaceId?: Id<"workspaces"> | null;
  userId?: Id<"users"> | null;
  selectedConversationId: Id<"conversations"> | null;
  aiWorkflowFilter: InboxAiWorkflowFilter;
  knowledgeSearch: string;
};

export function useInboxConvex({
  workspaceId,
  userId,
  selectedConversationId,
  aiWorkflowFilter,
  knowledgeSearch,
}: UseInboxConvexOptions) {
  const inboxQueryArgs = workspaceId
    ? {
        workspaceId,
        ...(aiWorkflowFilter === "all" ? {} : { aiWorkflowState: aiWorkflowFilter }),
      }
    : "skip";

  const searchKnowledge = useWebAction(KNOWLEDGE_SEARCH_ACTION_REF);
  const [knowledgeResults, setKnowledgeResults] = useState<InboxKnowledgeItem[] | undefined>(
    undefined
  );

  useEffect(() => {
    if (!workspaceId || knowledgeSearch.trim().length < 1) {
      setKnowledgeResults(undefined);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      searchKnowledge({ workspaceId, query: knowledgeSearch, limit: 20 })
        .then((results) => {
          if (!cancelled) {
            setKnowledgeResults(results);
          }
        })
        .catch((error) => {
          console.error("Knowledge search failed:", error);
          if (!cancelled) {
            setKnowledgeResults(undefined);
          }
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [workspaceId, knowledgeSearch, searchKnowledge]);

  return {
    aiResponses: useWebQuery(
      AI_CONVERSATION_RESPONSES_QUERY_REF,
      selectedConversationId ? { conversationId: selectedConversationId } : "skip"
    ),
    aiSettings: useWebQuery(AI_SETTINGS_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
    allSnippets: useWebQuery(SNIPPETS_LIST_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
    conversationsData: useWebQuery(INBOX_CONVERSATIONS_QUERY_REF, inboxQueryArgs),
    createSnippet: useWebMutation(CREATE_SNIPPET_REF),
    convertToTicket: useWebMutation(CONVERT_CONVERSATION_TO_TICKET_REF),
    finalizeSupportAttachmentUpload: useWebMutation(FINALIZE_SUPPORT_ATTACHMENT_UPLOAD_REF),
    generateSupportAttachmentUploadUrl: useWebMutation(GENERATE_SUPPORT_ATTACHMENT_UPLOAD_URL_REF),
    getSuggestionsForConversation: useWebAction(GET_SUGGESTIONS_FOR_CONVERSATION_REF),
    knowledgeResults,
    markAsRead: useWebMutation(MARK_CONVERSATION_READ_REF),
    messages: useWebQuery(
      MESSAGES_LIST_QUERY_REF,
      selectedConversationId ? { conversationId: selectedConversationId } : "skip"
    ),
    recentContent: useWebQuery(
      RECENTLY_USED_KNOWLEDGE_QUERY_REF,
      workspaceId && userId ? { userId, workspaceId, limit: 5 } : "skip"
    ),
    sendMessage: useWebMutation(SEND_MESSAGE_REF),
    trackAccess: useWebMutation(TRACK_KNOWLEDGE_ACCESS_REF),
    updateSnippet: useWebMutation(UPDATE_SNIPPET_REF),
    updateStatus: useWebMutation(UPDATE_CONVERSATION_STATUS_REF),
  };
}
