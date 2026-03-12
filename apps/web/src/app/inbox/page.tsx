"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { Id } from "@opencom/convex/dataModel";
import {
  normalizeUnknownError,
  uploadSupportAttachments,
  type StagedSupportAttachment,
} from "@opencom/web-shared";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout, AppPageShell } from "@/components/AppLayout";
import { Button } from "@opencom/ui";
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
import { useInboxConvex } from "./hooks/useInboxConvex";
import {
  shouldClearOptimisticLastMessage,
  useInboxMessageActions,
  type ConversationUiPatch,
} from "./hooks/useInboxMessageActions";
import { InboxConversationListPane } from "./InboxConversationListPane";
import { InboxThreadPane } from "./InboxThreadPane";
import { InboxAiReviewPanel } from "./InboxAiReviewPanel";
import type {
  InboxAiResponse,
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
  const [pendingAttachments, setPendingAttachments] = useState<
    StagedSupportAttachment<Id<"supportAttachments">>[]
  >([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [showKnowledgePicker, setShowKnowledgePicker] = useState(false);
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [snippetDialogMode, setSnippetDialogMode] = useState<"create" | "update" | null>(null);
  const [snippetDialogId, setSnippetDialogId] = useState<Id<"snippets"> | null>(null);
  const [snippetName, setSnippetName] = useState("");
  const [snippetShortcut, setSnippetShortcut] = useState("");
  const [snippetMutationError, setSnippetMutationError] = useState<string | null>(null);
  const [isSavingSnippet, setIsSavingSnippet] = useState(false);
  const [lastInsertedSnippetId, setLastInsertedSnippetId] = useState<Id<"snippets"> | null>(null);
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
  const selectedConversationIdRef = useRef<Id<"conversations"> | null>(selectedConversationId);
  const attachmentUploadContextVersionRef = useRef(0);
  const attachmentUploadRequestIdRef = useRef(0);
  selectedConversationIdRef.current = selectedConversationId;
  const {
    aiResponses,
    aiSettings,
    allSnippets,
    conversationsData,
    createSnippet,
    convertToTicket,
    finalizeSupportAttachmentUpload,
    generateSupportAttachmentUploadUrl,
    getSuggestionsForConversation,
    knowledgeResults,
    markAsRead,
    messages,
    recentContent,
    sendMessage,
    trackAccess,
    updateSnippet,
    updateStatus,
  } = useInboxConvex({
    workspaceId: activeWorkspace?._id,
    userId: user?._id,
    selectedConversationId,
    aiWorkflowFilter,
    knowledgeSearch,
  });
  const rawConversations = conversationsData?.conversations;

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
        setShowKnowledgePicker(true);
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    attachmentUploadContextVersionRef.current += 1;
    attachmentUploadRequestIdRef.current += 1;
    setPendingAttachments([]);
    setIsUploadingAttachments(false);
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId || !messages || messages.length === 0) {
      return;
    }
    setConversationPatches((previousState) => {
      const patch = previousState[selectedConversationId];
      if (!shouldClearOptimisticLastMessage(patch, messages)) {
        return previousState;
      }

      const latestMessage = messages[messages.length - 1];
      const nextState = { ...previousState };
      const nextPatch: ConversationUiPatch = {
        ...patch,
        lastMessageAt: latestMessage.createdAt,
      };
      delete nextPatch.optimisticLastMessage;
      delete nextPatch.optimisticBaseMessageId;

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
      pendingAttachments,
      setInputValue,
      setPendingAttachments,
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
      latestMessageId: messages?.[messages.length - 1]?._id ?? null,
      conversations,
      onTicketCreated: (ticketId) => router.push(`/tickets/${ticketId}`),
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
    // Open the consolidated knowledge picker on /
    if (e.key === "/" && inputValue === "") {
      e.preventDefault();
      setShowKnowledgePicker(true);
      setKnowledgeSearch("");
    }
    if (e.key === "Escape") {
      setShowKnowledgePicker(false);
    }
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

  const handleInsertKnowledgeContent = async (
    item: InboxKnowledgeItem,
    action: "content" | "link" = "content"
  ) => {
    if (user?._id && activeWorkspace?._id) {
      trackAccess({
        userId: user._id,
        workspaceId: activeWorkspace._id,
        contentType: item.type,
        contentId: item.id,
      }).catch(console.error);
    }

    if (item.type === "snippet") {
      setInputValue((prev) => `${prev}${prev ? "\n\n" : ""}${item.content}`);
      setLastInsertedSnippetId(item.id as Id<"snippets">);
    } else if (action === "link" && item.type === "article" && item.slug) {
      setInputValue((prev) => `${prev}${prev ? "\n\n" : ""}[${item.title}](/help/${item.slug})`);
    } else {
      setInputValue((prev) => `${prev}${prev ? "\n\n" : ""}${item.content}`);
    }

    setShowKnowledgePicker(false);
    setKnowledgeSearch("");
  };

  const closeSnippetDialog = () => {
    setSnippetDialogMode(null);
    setSnippetDialogId(null);
    setSnippetName("");
    setSnippetShortcut("");
    setSnippetMutationError(null);
    setIsSavingSnippet(false);
  };

  const openCreateSnippetDialog = () => {
    setSnippetDialogMode("create");
    setSnippetDialogId(null);
    setSnippetName("");
    setSnippetShortcut("");
    setSnippetMutationError(null);
  };

  const openUpdateSnippetDialog = () => {
    if (!lastInsertedSnippetId || !allSnippets) {
      return;
    }

    const snippet = allSnippets.find((entry) => entry._id === lastInsertedSnippetId);
    if (!snippet) {
      return;
    }

    setSnippetDialogMode("update");
    setSnippetDialogId(snippet._id);
    setSnippetName(snippet.name);
    setSnippetShortcut(snippet.shortcut ?? "");
    setSnippetMutationError(null);
  };

  const handleSubmitSnippetDialog = async () => {
    if (!activeWorkspace?._id || !inputValue.trim() || !snippetDialogMode) {
      return;
    }

    setIsSavingSnippet(true);
    setSnippetMutationError(null);

    try {
      if (snippetDialogMode === "create") {
        const snippetId = await createSnippet({
          workspaceId: activeWorkspace._id,
          name: snippetName.trim(),
          content: inputValue,
          shortcut: snippetShortcut.trim() || undefined,
        });
        setLastInsertedSnippetId(snippetId);
      } else if (snippetDialogId) {
        await updateSnippet({
          id: snippetDialogId,
          name: snippetName.trim(),
          content: inputValue,
          shortcut: snippetShortcut.trim() || undefined,
        });
        setLastInsertedSnippetId(snippetDialogId);
      }

      closeSnippetDialog();
    } catch (error) {
      setSnippetMutationError(
        error instanceof Error ? error.message : "Failed to save snippet from inbox."
      );
      setIsSavingSnippet(false);
    }
  };

  const lastInsertedSnippet =
    allSnippets?.find((snippet) => snippet._id === lastInsertedSnippetId) ?? null;

  const handleUploadAttachments = useCallback(
    async (files: File[]) => {
      if (!activeWorkspace?._id || !selectedConversationId || files.length === 0) {
        return;
      }

      const uploadConversationId = selectedConversationId;
      const uploadContextVersion = attachmentUploadContextVersionRef.current;
      const uploadRequestId = attachmentUploadRequestIdRef.current + 1;
      attachmentUploadRequestIdRef.current = uploadRequestId;
      setWorkflowError(null);
      setIsUploadingAttachments(true);
      try {
        const uploadedAttachments = await uploadSupportAttachments({
          files,
          currentCount: pendingAttachments.length,
          workspaceId: activeWorkspace._id,
          generateUploadUrl: generateSupportAttachmentUploadUrl,
          finalizeUpload: finalizeSupportAttachmentUpload,
        });
        if (
          selectedConversationIdRef.current !== uploadConversationId ||
          attachmentUploadContextVersionRef.current !== uploadContextVersion ||
          attachmentUploadRequestIdRef.current !== uploadRequestId
        ) {
          return;
        }
        setPendingAttachments((current) => [...current, ...uploadedAttachments]);
      } catch (error) {
        if (
          selectedConversationIdRef.current !== uploadConversationId ||
          attachmentUploadContextVersionRef.current !== uploadContextVersion ||
          attachmentUploadRequestIdRef.current !== uploadRequestId
        ) {
          return;
        }
        setWorkflowError(
          normalizeUnknownError(error, {
            fallbackMessage: "Failed to upload attachment.",
            nextAction: "Try again with a supported file.",
          }).message
        );
      } finally {
        if (attachmentUploadRequestIdRef.current === uploadRequestId) {
          setIsUploadingAttachments(false);
        }
      }
    },
    [
      activeWorkspace?._id,
      finalizeSupportAttachmentUpload,
      generateSupportAttachmentUploadUrl,
      pendingAttachments.length,
      selectedConversationId,
    ]
  );

  const handleRemovePendingAttachment = useCallback((attachmentId: Id<"supportAttachments">) => {
    setPendingAttachments((current) =>
      current.filter((attachment) => attachment.attachmentId !== attachmentId)
    );
  }, []);

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
                pendingAttachments={pendingAttachments}
                isSending={isSending}
                isUploadingAttachments={isUploadingAttachments}
                isResolving={isResolving}
                isConvertingTicket={isConvertingTicket}
                showKnowledgePicker={showKnowledgePicker}
                knowledgeSearch={knowledgeSearch}
                allSnippets={allSnippets as InboxSnippet[] | undefined}
                knowledgeResults={knowledgeResults as InboxKnowledgeItem[] | undefined}
                recentContent={recentContent as InboxKnowledgeItem[] | undefined}
                activeCompactPanel={activeCompactPanel}
                aiReviewPanelOpen={aiReviewPanelOpen}
                suggestionsPanelOpen={suggestionsPanelOpen}
                isSidecarEnabled={isSidecarEnabled}
                suggestionsCount={suggestionsCount}
                isSuggestionsCountLoading={isSuggestionsCountLoading}
                canSaveDraftAsSnippet={inputValue.trim().length > 0}
                canUpdateSnippetFromDraft={Boolean(
                  lastInsertedSnippet && inputValue.trim().length > 0
                )}
                lastInsertedSnippetName={lastInsertedSnippet?.name ?? null}
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
                onUploadAttachments={(files) => {
                  void handleUploadAttachments(files);
                }}
                onRemovePendingAttachment={handleRemovePendingAttachment}
                onKnowledgeSearchChange={setKnowledgeSearch}
                onToggleKnowledgePicker={() => {
                  setShowKnowledgePicker((current) => !current);
                }}
                onCloseKnowledgePicker={() => setShowKnowledgePicker(false)}
                onInsertKnowledgeContent={(item, action) => {
                  void handleInsertKnowledgeContent(item, action);
                }}
                onSaveDraftAsSnippet={openCreateSnippetDialog}
                onUpdateSnippetFromDraft={openUpdateSnippetDialog}
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

      {snippetDialogMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">
              {snippetDialogMode === "create" ? "Save draft as snippet" : "Update snippet"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Snippets stay available in the inbox knowledge picker and slash shortcuts.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
                <input
                  value={snippetName}
                  onChange={(event) => setSnippetName(event.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Billing follow-up"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Shortcut (optional)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">/</span>
                  <input
                    value={snippetShortcut}
                    onChange={(event) =>
                      setSnippetShortcut(
                        event.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase()
                      )
                    }
                    className="w-full rounded-md border px-3 py-2 text-sm font-mono"
                    placeholder="billing-followup"
                  />
                </div>
              </div>

              {snippetMutationError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {snippetMutationError}
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={closeSnippetDialog} disabled={isSavingSnippet}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  void handleSubmitSnippetDialog();
                }}
                disabled={isSavingSnippet || !snippetName.trim() || !inputValue.trim()}
              >
                {isSavingSnippet
                  ? snippetDialogMode === "create"
                    ? "Saving..."
                    : "Updating..."
                  : snippetDialogMode === "create"
                    ? "Save Snippet"
                    : "Update Snippet"}
              </Button>
            </div>
          </div>
        </div>
      )}
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
