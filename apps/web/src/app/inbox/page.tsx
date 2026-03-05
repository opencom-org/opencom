"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout, AppPageShell } from "@/components/AppLayout";
import { formatVisitorIdentityLabel } from "@/lib/visitorIdentity";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import {
  AdaptiveSecondaryPanel,
  ResponsivePrimaryRegion,
  useIsCompactViewport,
} from "@/components/ResponsiveLayout";
import { useInboxSelectionSync } from "./hooks/useInboxSelectionSync";
import { useInboxCompactPanels } from "./hooks/useInboxCompactPanels";
import { useInboxSuggestionsCount } from "./hooks/useInboxSuggestionsCount";
import { useInboxAttentionCues } from "./hooks/useInboxAttentionCues";
import {
  useInboxMessageActions,
  type ConversationUiPatch,
} from "./hooks/useInboxMessageActions";
import { InboxConversationListPane } from "./InboxConversationListPane";
import { InboxThreadPane } from "./InboxThreadPane";
import { InboxAiReviewPanel } from "./InboxAiReviewPanel";
import type {
  InboxAiResponse,
  InboxArticle,
  InboxConversation,
  InboxKnowledgeItem,
  InboxMessage,
  InboxSnippet,
} from "./inboxRenderTypes";

const HANDOFF_REASON_FALLBACK = "Reason not provided by handoff trigger";

function sortInboxConversations(
  left: { _id: string; createdAt: number; lastMessageAt?: number },
  right: { _id: string; createdAt: number; lastMessageAt?: number }
): number {
  const leftTimestamp = left.lastMessageAt ?? left.createdAt;
  const rightTimestamp = right.lastMessageAt ?? right.createdAt;
  if (rightTimestamp !== leftTimestamp) {
    return rightTimestamp - leftTimestamp;
  }
  return right._id.localeCompare(left._id);
}

function getConversationIdentityLabel(conversation: {
  visitor?: { name?: string; email?: string; readableId?: string } | null;
  visitorId?: Id<"visitors">;
}): string {
  return formatVisitorIdentityLabel({
    visitorId: conversation.visitorId,
    readableId: conversation.visitor?.readableId,
    name: conversation.visitor?.name,
    email: conversation.visitor?.email,
  });
}

function getHandoffReasonLabel(reason: string | null | undefined): string {
  const normalizedReason = reason?.trim();
  return normalizedReason && normalizedReason.length > 0
    ? normalizedReason
    : HANDOFF_REASON_FALLBACK;
}

function InboxContent(): React.JSX.Element | null {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, activeWorkspace } = useAuth();
  const isCompactViewport = useIsCompactViewport();
  const [selectedConversationId, setSelectedConversationId] = useState<Id<"conversations"> | null>(
    null
  );
  const [inputValue, setInputValue] = useState("");
  const [showSnippetPicker, setShowSnippetPicker] = useState(false);
  const [snippetSearch, setSnippetSearch] = useState("");
  const [showArticleSearch, setShowArticleSearch] = useState(false);
  const [articleSearch, setArticleSearch] = useState("");
  const [showKnowledgePanel, setShowKnowledgePanel] = useState(false);
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [aiWorkflowFilter, setAiWorkflowFilter] = useState<"all" | "ai_handled" | "handoff">("all");
  const [conversationPatches, setConversationPatches] = useState<
    Record<string, ConversationUiPatch>
  >({});
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isConvertingTicket, setIsConvertingTicket] = useState(false);
  const [readSyncConversationId, setReadSyncConversationId] = useState<Id<"conversations"> | null>(
    null
  );
  const [highlightedMessageId, setHighlightedMessageId] = useState<Id<"messages"> | null>(null);
  const messageHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replyInputRef = useRef<HTMLInputElement | null>(null);

  const inboxQueryArgs = activeWorkspace?._id
    ? {
        workspaceId: activeWorkspace._id,
        ...(aiWorkflowFilter === "all" ? {} : { aiWorkflowState: aiWorkflowFilter }),
      }
    : "skip";
  const conversationsData = useQuery(api.conversations.listForInbox, inboxQueryArgs);
  const rawConversations = conversationsData?.conversations;
  const aiSettings = useQuery(
    api.aiAgent.getSettings,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const messages = useQuery(
    api.messages.list,
    selectedConversationId ? { conversationId: selectedConversationId } : "skip"
  );
  const aiResponses = useQuery(
    api.aiAgent.getConversationResponses,
    selectedConversationId ? { conversationId: selectedConversationId } : "skip"
  );

  const sendMessage = useMutation(api.messages.send);
  const markAsRead = useMutation(api.conversations.markAsRead);
  const updateStatus = useMutation(api.conversations.updateStatus);
  const convertToTicket = useMutation(api.tickets.convertFromConversation);
  const getSuggestionsForConversation = useAction(api.suggestions.getForConversation);

  const snippets = useQuery(
    api.snippets.search,
    activeWorkspace?._id && snippetSearch.length >= 1
      ? { workspaceId: activeWorkspace._id, query: snippetSearch }
      : "skip"
  );

  const allSnippets = useQuery(
    api.snippets.list,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const articles = useQuery(
    api.articles.search,
    activeWorkspace?._id && articleSearch.length >= 2
      ? { workspaceId: activeWorkspace._id, query: articleSearch, publishedOnly: true }
      : "skip"
  );

  const knowledgeResults = useQuery(
    api.knowledge.search,
    activeWorkspace?._id && knowledgeSearch.length >= 2
      ? { workspaceId: activeWorkspace._id, query: knowledgeSearch, limit: 20 }
      : "skip"
  );

  const recentContent = useQuery(
    api.knowledge.getRecentlyUsed,
    activeWorkspace?._id && user?._id
      ? { userId: user._id, workspaceId: activeWorkspace._id, limit: 5 }
      : "skip"
  );

  const trackAccess = useMutation(api.knowledge.trackAccess);
  const conversations = useMemo(() => {
    if (!rawConversations) {
      return rawConversations;
    }
    return [...rawConversations]
      .map((conv) => {
        const patch = conversationPatches[conv._id];
        const optimisticLastMessage = patch?.optimisticLastMessage
          ? ({
              _id: `optimistic-${conv._id}`,
              conversationId: conv._id,
              senderId: user?._id ?? "agent",
              senderType: "agent",
              content: patch.optimisticLastMessage,
              createdAt: patch.lastMessageAt ?? Date.now(),
            } as NonNullable<typeof conv.lastMessage>)
          : conv.lastMessage;

        return {
          ...conv,
          unreadByAgent: patch?.unreadByAgent ?? conv.unreadByAgent,
          status: patch?.status ?? conv.status,
          lastMessageAt: patch?.lastMessageAt ?? conv.lastMessageAt,
          lastMessage: optimisticLastMessage,
        };
      })
      .sort(sortInboxConversations);
  }, [conversationPatches, rawConversations, user?._id]);

  const selectedConversation =
    conversations?.find((conversation) => conversation._id === selectedConversationId) ?? null;
  const isConversationsLoading = conversationsData === undefined;
  const isSidecarEnabled = aiSettings?.suggestionsEnabled === true;
  const orderedAiResponses = useMemo(() => {
    if (!aiResponses) {
      return aiResponses;
    }
    return [...aiResponses].sort((left, right) => right.createdAt - left.createdAt);
  }, [aiResponses]);
  const showConversationListPane = !isCompactViewport || !selectedConversationId;
  const showThreadPane = !isCompactViewport || Boolean(selectedConversationId);

  const focusReplyInput = () => {
    if (typeof window === "undefined") {
      return;
    }
    window.requestAnimationFrame(() => {
      replyInputRef.current?.focus();
    });
  };
  const clearWorkflowError = useCallback(() => {
    setWorkflowError(null);
  }, []);
  const {
    activeCompactPanel,
    aiReviewPanelOpen,
    suggestionsPanelOpen,
    closeCompactPanel,
    toggleAuxiliaryPanel,
    resetCompactPanel,
  } = useInboxCompactPanels({
    isCompactViewport,
    selectedConversationId,
    isSidecarEnabled,
    focusReplyInput,
  });
  useInboxSelectionSync({
    conversations,
    isConversationsLoading,
    selectedConversationId,
    setSelectedConversationId,
    resetCompactPanel,
    clearWorkflowError,
    searchParams,
    router,
  });
  const { suggestionsCount, isSuggestionsCountLoading, setSuggestionsCount } =
    useInboxSuggestionsCount({
      selectedConversationId,
      isSidecarEnabled,
      messageCountSignal: messages?.length ?? 0,
      getSuggestionsForConversation,
    });

  // Keyboard shortcut for knowledge search (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowKnowledgePanel(true);
        setShowSnippetPicker(false);
        setShowArticleSearch(false);
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (!selectedConversationId || !messages || messages.length === 0) {
      return;
    }
    const latestMessage = messages[messages.length - 1];
    setConversationPatches((previousState) => {
      const patch = previousState[selectedConversationId];
      if (!patch?.optimisticLastMessage) {
        return previousState;
      }
      if (latestMessage.content !== patch.optimisticLastMessage) {
        return previousState;
      }

      const nextState = { ...previousState };
      const nextPatch: ConversationUiPatch = {
        ...patch,
        lastMessageAt: latestMessage.createdAt,
      };
      delete nextPatch.optimisticLastMessage;

      if (
        nextPatch.unreadByAgent === undefined &&
        nextPatch.status === undefined &&
        nextPatch.lastMessageAt === undefined
      ) {
        delete nextState[selectedConversationId];
      } else {
        nextState[selectedConversationId] = nextPatch;
      }
      return nextState;
    });
  }, [messages, selectedConversationId]);

  useEffect(() => {
    return () => {
      if (messageHighlightTimerRef.current) {
        clearTimeout(messageHighlightTimerRef.current);
        messageHighlightTimerRef.current = null;
      }
    };
  }, []);
  const handleOpenConversationFromNotification = useCallback((conversationId: Id<"conversations">) => {
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    url.pathname = "/inbox";
    url.searchParams.set("conversationId", conversationId);
    window.location.assign(url.toString());
  }, []);
  useInboxAttentionCues({
    conversations,
    selectedConversationId,
    getConversationIdentityLabel,
    onOpenConversation: handleOpenConversationFromNotification,
  });
  const {
    handleSelectConversation,
    handleSendMessage,
    handleResolveConversation,
    handleConvertToTicket,
  } = useInboxMessageActions({
    api: {
      markAsRead,
      sendMessage,
      updateStatus,
      convertToTicket,
    },
    state: {
      inputValue,
      setInputValue,
      setIsSending,
      setIsResolving,
      setIsConvertingTicket,
      conversationPatches,
      setConversationPatches,
      setReadSyncConversationId,
      setSelectedConversationId,
      setWorkflowError,
    },
    context: {
      userId: user?._id ?? null,
      selectedConversationId,
      conversations,
      onTicketCreated: (ticketId) => router.push(`/tickets/${ticketId}`),
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
    // Trigger snippet picker on /
    if (e.key === "/" && inputValue === "") {
      e.preventDefault();
      setShowSnippetPicker(true);
      setSnippetSearch("");
    }
    // Close pickers on Escape
    if (e.key === "Escape") {
      setShowSnippetPicker(false);
      setShowArticleSearch(false);
    }
  };

  const handleSelectSnippet = (content: string) => {
    setInputValue(content);
    setShowSnippetPicker(false);
    setSnippetSearch("");
  };

  const jumpToMessage = (messageId: Id<"messages">) => {
    const target = document.getElementById(`message-${messageId}`);
    if (!target) {
      return;
    }
    if (messageHighlightTimerRef.current) {
      clearTimeout(messageHighlightTimerRef.current);
    }
    setHighlightedMessageId(messageId);
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    messageHighlightTimerRef.current = setTimeout(() => {
      setHighlightedMessageId((current) => (current === messageId ? null : current));
      messageHighlightTimerRef.current = null;
    }, 2000);
  };

  const handleInsertArticleLink = (title: string, slug: string) => {
    const link = `[${title}](/help/${slug})`;
    setInputValue((prev) => prev + (prev ? " " : "") + link);
    setShowArticleSearch(false);
    setArticleSearch("");
  };

  const handleInsertKnowledgeContent = async (item: InboxKnowledgeItem) => {
    // Track access for recently used
    if (user?._id && activeWorkspace?._id) {
      trackAccess({
        userId: user._id,
        workspaceId: activeWorkspace._id,
        contentType: item.type,
        contentId: item.id,
      }).catch(console.error);
    }

    if (item.type === "snippet") {
      // Insert snippet content directly
      setInputValue(item.content);
    } else {
      // Insert as a reference or paste content
      setInputValue((prev) => prev + (prev ? "\n\n" : "") + item.content);
    }
    setShowKnowledgePanel(false);
    setKnowledgeSearch("");
  };

  if (!user || !activeWorkspace) {
    return null;
  }

  return (
    <AppPageShell className="h-full" data-testid="inbox-responsive-shell">
      <div
        className="grid flex-1 min-h-0 gap-4 lg:gap-6 lg:grid-cols-[minmax(320px,40%)_minmax(0,1fr)]"
        data-testid="inbox-layout-grid"
      >
        {showConversationListPane && (
          <InboxConversationListPane
            aiWorkflowFilter={aiWorkflowFilter}
            onAiWorkflowFilterChange={setAiWorkflowFilter}
            isConversationsLoading={isConversationsLoading}
            conversations={conversations as InboxConversation[] | undefined}
            selectedConversationId={selectedConversationId}
            readSyncConversationId={readSyncConversationId}
            onSelectConversation={(conversationId) => {
              void handleSelectConversation(conversationId);
            }}
            getConversationIdentityLabel={getConversationIdentityLabel}
          />
        )}

        {showThreadPane && (
          <ResponsivePrimaryRegion className="min-h-0" data-testid="inbox-thread-pane">
            <div className="h-full min-h-0 flex gap-4">
              <InboxThreadPane
                isCompactViewport={isCompactViewport}
                selectedConversationId={selectedConversationId}
                selectedConversation={selectedConversation as InboxConversation | null}
                messages={messages as InboxMessage[] | undefined}
                workflowError={workflowError}
                highlightedMessageId={highlightedMessageId}
                inputValue={inputValue}
                isSending={isSending}
                isResolving={isResolving}
                isConvertingTicket={isConvertingTicket}
                showSnippetPicker={showSnippetPicker}
                snippetSearch={snippetSearch}
                showArticleSearch={showArticleSearch}
                articleSearch={articleSearch}
                showKnowledgePanel={showKnowledgePanel}
                knowledgeSearch={knowledgeSearch}
                snippets={snippets as InboxSnippet[] | undefined}
                allSnippets={allSnippets as InboxSnippet[] | undefined}
                articles={articles as InboxArticle[] | undefined}
                knowledgeResults={knowledgeResults as InboxKnowledgeItem[] | undefined}
                recentContent={recentContent as InboxKnowledgeItem[] | undefined}
                activeCompactPanel={activeCompactPanel}
                aiReviewPanelOpen={aiReviewPanelOpen}
                suggestionsPanelOpen={suggestionsPanelOpen}
                isSidecarEnabled={isSidecarEnabled}
                suggestionsCount={suggestionsCount}
                isSuggestionsCountLoading={isSuggestionsCountLoading}
                replyInputRef={replyInputRef}
                onBackToList={() => {
                  setSelectedConversationId(null);
                  resetCompactPanel();
                }}
                onResolveConversation={() => {
                  void handleResolveConversation();
                }}
                onConvertToTicket={() => {
                  void handleConvertToTicket();
                }}
                onOpenVisitorProfile={() => {
                  if (selectedConversation?.visitorId) {
                    router.push(`/visitors/${selectedConversation.visitorId}`);
                  }
                }}
                onToggleAiReview={() => toggleAuxiliaryPanel("ai-review")}
                onToggleSuggestions={() => toggleAuxiliaryPanel("suggestions")}
                onInputChange={setInputValue}
                onInputKeyDown={handleKeyDown}
                onSendMessage={() => {
                  void handleSendMessage();
                }}
                onToggleSnippetPicker={() => {
                  setShowSnippetPicker(!showSnippetPicker);
                  setShowArticleSearch(false);
                }}
                onToggleArticleSearch={() => {
                  setShowArticleSearch(!showArticleSearch);
                  setShowSnippetPicker(false);
                  setShowKnowledgePanel(false);
                }}
                onToggleKnowledgePanel={() => {
                  setShowKnowledgePanel(!showKnowledgePanel);
                  setShowSnippetPicker(false);
                  setShowArticleSearch(false);
                }}
                onSnippetSearchChange={setSnippetSearch}
                onArticleSearchChange={setArticleSearch}
                onKnowledgeSearchChange={setKnowledgeSearch}
                onCloseSnippetPicker={() => setShowSnippetPicker(false)}
                onCloseArticleSearch={() => setShowArticleSearch(false)}
                onCloseKnowledgePanel={() => setShowKnowledgePanel(false)}
                onSelectSnippet={handleSelectSnippet}
                onInsertArticleLink={handleInsertArticleLink}
                onInsertKnowledgeContent={(item) => {
                  void handleInsertKnowledgeContent(item);
                }}
                getConversationIdentityLabel={getConversationIdentityLabel}
                getHandoffReasonLabel={getHandoffReasonLabel}
              />
              {selectedConversationId && (
                <AdaptiveSecondaryPanel
                  isCompact={true}
                  isOpen={aiReviewPanelOpen}
                  panelTestId="inbox-ai-review-panel"
                  closeLabel="Close AI review"
                  desktopContainerClassName="w-80 flex-shrink-0"
                  onOpenChange={(open) => {
                    if (!open) {
                      closeCompactPanel();
                    }
                  }}
                >
                  <InboxAiReviewPanel
                    aiResponses={aiResponses as InboxAiResponse[] | undefined}
                    orderedAiResponses={orderedAiResponses as InboxAiResponse[] | undefined}
                    selectedConversation={selectedConversation as InboxConversation | null}
                    onOpenArticle={(articleId) => router.push(`/articles/${articleId}`)}
                    onJumpToMessage={jumpToMessage}
                    getHandoffReasonLabel={getHandoffReasonLabel}
                  />
                </AdaptiveSecondaryPanel>
              )}
              {selectedConversationId && isSidecarEnabled && (
                <AdaptiveSecondaryPanel
                  isCompact={isCompactViewport}
                  isOpen={suggestionsPanelOpen}
                  panelTestId="inbox-sidecar-container"
                  closeLabel="Close suggestions"
                  desktopMode="slideout"
                  desktopContainerClassName="w-full max-w-md"
                  onOpenChange={(open) => {
                    if (!open) {
                      closeCompactPanel();
                    }
                  }}
                >
                  <SuggestionsPanel
                    conversationId={selectedConversationId}
                    workspaceId={activeWorkspace._id}
                    onSuggestionsUpdated={setSuggestionsCount}
                    onInsert={(content) =>
                      setInputValue((prev) => prev + (prev ? "\n\n" : "") + content)
                    }
                  />
                </AdaptiveSecondaryPanel>
              )}
            </div>
          </ResponsivePrimaryRegion>
        )}
      </div>
    </AppPageShell>
  );
}

export default function InboxPage(): React.JSX.Element {
  return (
    <AppLayout>
      <InboxContent />
    </AppLayout>
  );
}
