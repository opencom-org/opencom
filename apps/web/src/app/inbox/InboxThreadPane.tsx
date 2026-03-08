"use client";

import { Button, Card, Input } from "@opencom/ui";
import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  BookOpen,
  FileText,
  Link,
  Mail,
  MessageSquare,
  MessageSquareText,
  Paperclip,
  Send,
  ShieldAlert,
  Ticket,
  X,
  Zap,
} from "lucide-react";
import type { Id } from "@opencom/convex/dataModel";
import {
  type InboxCompactPanel,
  type InboxConversation,
  type InboxKnowledgeItem,
  type InboxMessage,
  type InboxSnippet,
} from "./inboxRenderTypes";

interface InboxThreadPaneProps {
  isCompactViewport: boolean;
  selectedConversationId: Id<"conversations"> | null;
  selectedConversation: InboxConversation | null;
  messages: InboxMessage[] | undefined;
  workflowError: string | null;
  highlightedMessageId: Id<"messages"> | null;
  inputValue: string;
  isSending: boolean;
  isResolving: boolean;
  isConvertingTicket: boolean;
  showKnowledgePicker: boolean;
  knowledgeSearch: string;
  allSnippets: InboxSnippet[] | undefined;
  knowledgeResults: InboxKnowledgeItem[] | undefined;
  recentContent: InboxKnowledgeItem[] | undefined;
  activeCompactPanel: InboxCompactPanel;
  aiReviewPanelOpen: boolean;
  suggestionsPanelOpen: boolean;
  isSidecarEnabled: boolean;
  suggestionsCount: number;
  isSuggestionsCountLoading: boolean;
  canSaveDraftAsSnippet: boolean;
  canUpdateSnippetFromDraft: boolean;
  lastInsertedSnippetName: string | null;
  replyInputRef: React.RefObject<HTMLInputElement | null>;
  onBackToList: () => void;
  onResolveConversation: () => void;
  onConvertToTicket: () => void;
  onOpenVisitorProfile: () => void;
  onToggleAiReview: () => void;
  onToggleSuggestions: () => void;
  onInputChange: (value: string) => void;
  onInputKeyDown: (event: React.KeyboardEvent) => void;
  onSendMessage: () => void;
  onToggleKnowledgePicker: () => void;
  onKnowledgeSearchChange: (value: string) => void;
  onCloseKnowledgePicker: () => void;
  onInsertKnowledgeContent: (
    item: InboxKnowledgeItem,
    action?: "content" | "link"
  ) => void;
  onSaveDraftAsSnippet: () => void;
  onUpdateSnippetFromDraft: () => void;
  getConversationIdentityLabel: (conversation: InboxConversation) => string;
  getHandoffReasonLabel: (reason: string | null | undefined) => string;
}

function getContentTypeIcon(type: "article" | "internalArticle" | "snippet"): React.JSX.Element {
  switch (type) {
    case "article":
      return <FileText className="h-4 w-4 text-primary-foreground0" />;
    case "internalArticle":
      return <BookOpen className="h-4 w-4 text-purple-500" />;
    case "snippet":
      return <MessageSquareText className="h-4 w-4 text-green-500" />;
  }
}

function getContentTypeLabel(type: "article" | "internalArticle" | "snippet"): string {
  switch (type) {
    case "article":
      return "Article";
    case "internalArticle":
      return "Internal";
    case "snippet":
      return "Snippet";
  }
}

function getKnowledgePreview(item: Pick<InboxKnowledgeItem, "snippet" | "content">): string {
  const value = item.snippet?.trim() || item.content.trim();
  if (value.length <= 120) {
    return value;
  }
  return `${value.slice(0, 117)}...`;
}

function getContentTypeBadgeClass(type: "article" | "internalArticle" | "snippet"): string {
  switch (type) {
    case "article":
      return "bg-primary/10 text-primary";
    case "internalArticle":
      return "bg-amber-100 text-amber-700";
    case "snippet":
      return "bg-green-100 text-green-700";
  }
}

export function InboxThreadPane({
  isCompactViewport,
  selectedConversationId,
  selectedConversation,
  messages,
  workflowError,
  highlightedMessageId,
  inputValue,
  isSending,
  isResolving,
  isConvertingTicket,
  showKnowledgePicker,
  knowledgeSearch,
  allSnippets,
  knowledgeResults,
  recentContent,
  activeCompactPanel,
  aiReviewPanelOpen,
  suggestionsPanelOpen,
  isSidecarEnabled,
  suggestionsCount,
  isSuggestionsCountLoading,
  canSaveDraftAsSnippet,
  canUpdateSnippetFromDraft,
  lastInsertedSnippetName,
  replyInputRef,
  onBackToList,
  onResolveConversation,
  onConvertToTicket,
  onOpenVisitorProfile,
  onToggleAiReview,
  onToggleSuggestions,
  onInputChange,
  onInputKeyDown,
  onSendMessage,
  onToggleKnowledgePicker,
  onKnowledgeSearchChange,
  onCloseKnowledgePicker,
  onInsertKnowledgeContent,
  onSaveDraftAsSnippet,
  onUpdateSnippetFromDraft,
  getConversationIdentityLabel,
  getHandoffReasonLabel,
}: InboxThreadPaneProps): React.JSX.Element {
  const normalizedKnowledgeSearch = knowledgeSearch.trim();
  const isSearchingKnowledge = normalizedKnowledgeSearch.length > 0;
  const hasRecentContent = Boolean(recentContent && recentContent.length > 0);
  const hasSnippetLibrary = Boolean(allSnippets && allSnippets.length > 0);
  const hasKnowledgeResults = Boolean(knowledgeResults && knowledgeResults.length > 0);

  const renderKnowledgeActions = (item: InboxKnowledgeItem) => {
    if (item.type === "snippet") {
      return (
        <Button size="sm" variant="outline" onClick={() => onInsertKnowledgeContent(item)}>
          Insert
        </Button>
      );
    }

    if (item.type === "article" && item.slug) {
      return (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onInsertKnowledgeContent(item, "link")}
          >
            <Link className="mr-1 h-3.5 w-3.5" />
            Insert Link
          </Button>
          <Button size="sm" variant="outline" onClick={() => onInsertKnowledgeContent(item)}>
            Insert Content
          </Button>
        </div>
      );
    }

    return (
      <Button size="sm" variant="outline" onClick={() => onInsertKnowledgeContent(item)}>
        Insert Content
      </Button>
    );
  };

  const renderKnowledgeItem = (item: InboxKnowledgeItem) => (
    <div
      key={`${item.type}-${item.id}`}
      className="flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-3"
    >
      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-50">
        {getContentTypeIcon(item.type)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-gray-900">{item.title}</p>
          <span
            className={`inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${getContentTypeBadgeClass(
              item.type
            )}`}
          >
            {getContentTypeLabel(item.type)}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{getKnowledgePreview(item)}</p>
        {item.tags && item.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">{renderKnowledgeActions(item)}</div>
    </div>
  );

  return (
    <Card
      className="flex-1 min-w-0 flex flex-col overflow-hidden"
      data-testid="inbox-primary-thread-pane"
    >
      {selectedConversationId ? (
        <>
            <div className="p-4 border-b space-y-3">
              <div className="flex items-center gap-2 min-w-0">
                {isCompactViewport && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBackToList}
                    data-testid="inbox-back-to-list"
                    title="Back to conversations"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
                <h2 className="font-semibold truncate">
                  {selectedConversation
                    ? getConversationIdentityLabel(selectedConversation)
                    : "Loading conversation..."}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onResolveConversation}
                  disabled={isResolving || selectedConversation?.status === "closed"}
                  data-testid="inbox-resolve-button"
                  title="Resolve Conversation"
                >
                  {isResolving ? "Resolving..." : "Resolve"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onConvertToTicket}
                  disabled={isConvertingTicket}
                  data-testid="inbox-convert-ticket-button"
                  title="Convert to Ticket"
                >
                  <Ticket className="h-4 w-4 mr-1" />
                  {isConvertingTicket ? "Creating..." : "Create Ticket"}
                </Button>
                {selectedConversation?.visitorId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onOpenVisitorProfile}
                    data-testid="inbox-open-visitor-profile"
                    title="View visitor profile"
                  >
                    <ArrowUpRight className="h-4 w-4 mr-1" />
                    View visitor
                  </Button>
                ) : null}
                {!isCompactViewport && (
                  <Button
                    variant={aiReviewPanelOpen ? "default" : "outline"}
                    size="sm"
                    onClick={onToggleAiReview}
                    data-testid="inbox-open-ai-review"
                  >
                    <Bot className="h-4 w-4 mr-1" />
                    AI review
                  </Button>
                )}
                {!isCompactViewport && isSidecarEnabled && (
                  <Button
                    variant={suggestionsPanelOpen ? "default" : "outline"}
                    size="sm"
                    onClick={onToggleSuggestions}
                    data-testid="inbox-open-suggestions"
                  >
                    <MessageSquareText className="h-4 w-4 mr-1" />
                    Suggestions
                    <span
                      className={`ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs ${
                        suggestionsPanelOpen
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {isSuggestionsCountLoading ? "…" : suggestionsCount}
                    </span>
                  </Button>
                )}
              </div>
              {selectedConversation?.aiWorkflow?.state === "handoff" && (
                <div
                  className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800"
                  data-testid="inbox-handoff-context-banner"
                >
                  <Bot className="h-3 w-3" />
                  <span className="font-medium">AI handoff</span>
                  <span className="truncate">
                    {getHandoffReasonLabel(selectedConversation.aiWorkflow.handoffReason)}
                  </span>
                </div>
              )}
              {isCompactViewport && (
                <div className="flex items-center gap-2" data-testid="inbox-compact-aux-actions">
                  <Button
                    variant={activeCompactPanel === "ai-review" ? "default" : "outline"}
                    size="sm"
                    onClick={onToggleAiReview}
                    data-testid="inbox-open-ai-review"
                  >
                    <Bot className="h-4 w-4 mr-1" />
                    AI review
                  </Button>
                  {isSidecarEnabled && (
                    <Button
                      variant={activeCompactPanel === "suggestions" ? "default" : "outline"}
                      size="sm"
                      onClick={onToggleSuggestions}
                      data-testid="inbox-open-suggestions"
                    >
                      <MessageSquareText className="h-4 w-4 mr-1" />
                      Suggestions
                      <span
                        className={`ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs ${
                          activeCompactPanel === "suggestions"
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {isSuggestionsCountLoading ? "…" : suggestionsCount}
                      </span>
                    </Button>
                  )}
                </div>
              )}
            </div>

            {workflowError && (
              <div
                className="px-4 py-2 bg-red-50 border-b border-red-200 text-sm text-red-700"
                data-testid="inbox-workflow-error"
              >
                {workflowError}
              </div>
            )}

            {selectedConversation?.visitor?.identityVerified === false && (
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-sm text-amber-800">
                <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                <span>
                  <strong>Unverified user:</strong> This visitor&apos;s identity has not been
                  verified. Messages may be from an impersonator.
                </span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="inbox-message-list">
              {messages === undefined ? (
                <div className="text-sm text-muted-foreground" data-testid="inbox-messages-loading">
                  Loading conversation...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-sm text-muted-foreground" data-testid="inbox-messages-empty">
                  No messages yet
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message._id}
                    id={`message-${message._id}`}
                    data-testid={`message-item-${message._id}`}
                    data-highlighted={highlightedMessageId === message._id ? "true" : "false"}
                    className={`flex ${
                      message.senderType === "agent" || message.senderType === "bot"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                        message.senderType === "agent"
                          ? "bg-primary text-primary-foreground"
                          : message.senderType === "bot"
                            ? "bg-muted text-muted-foreground"
                            : "bg-muted"
                      } ${highlightedMessageId === message._id ? "ring-2 ring-primary/60 ring-offset-1" : ""}`}
                    >
                      {message.channel === "email" && message.emailMetadata?.subject && (
                        <div className="flex items-center gap-1 text-xs opacity-70 mb-1">
                          <Mail className="h-3 w-3" />
                          <span className="font-medium">{message.emailMetadata.subject}</span>
                        </div>
                      )}
                      {message.channel === "email" &&
                        message.senderType === "visitor" &&
                        message.emailMetadata?.from && (
                          <div className="text-xs opacity-70 mb-2">
                            From: {message.emailMetadata.from}
                          </div>
                        )}
                      <p className="whitespace-pre-wrap">{message.content.replace(/<[^>]*>/g, "")}</p>
                      {message.emailMetadata?.attachments &&
                        message.emailMetadata.attachments.length > 0 && (
                          <div className="flex items-center gap-1 text-xs opacity-70 mt-2">
                            <Paperclip className="h-3 w-3" />
                            <span>{message.emailMetadata.attachments.length} attachment(s)</span>
                          </div>
                        )}
                      <div className="flex items-center gap-2 text-xs opacity-70 mt-1">
                        <span>
                          {message.channel === "email" && <Mail className="h-3 w-3 inline mr-1" />}
                          {message.senderType === "bot"
                            ? "Bot"
                            : message.senderType === "agent"
                              ? "You"
                              : "Visitor"}{" "}
                          • {new Date(message.createdAt).toLocaleTimeString()}
                        </span>
                        {message.channel === "email" &&
                          message.senderType === "agent" &&
                          message.deliveryStatus && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                message.deliveryStatus === "sent" || message.deliveryStatus === "delivered"
                                  ? "bg-green-100 text-green-700"
                                  : message.deliveryStatus === "pending"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-red-100 text-red-700"
                              }`}
                            >
                              {message.deliveryStatus}
                            </span>
                          )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t relative">
              {showKnowledgePicker && (
                <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border bg-white shadow-lg">
                  <div className="flex items-center gap-3 border-b px-3 py-3">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={knowledgeSearch}
                      onChange={(event) => onKnowledgeSearchChange(event.target.value)}
                      placeholder="Search articles and snippets... (Ctrl+K)"
                      className="flex-1 text-sm outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={onCloseKnowledgePicker}
                      className="rounded p-1 hover:bg-muted"
                      aria-label="Close knowledge picker"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="max-h-96 space-y-4 overflow-y-auto p-3">
                    {!isSearchingKnowledge && hasRecentContent ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Recently Used
                        </p>
                        <div className="space-y-2">
                          {recentContent?.map((item) => renderKnowledgeItem(item))}
                        </div>
                      </div>
                    ) : null}

                    {!isSearchingKnowledge && hasSnippetLibrary ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Snippets
                        </p>
                        <div className="space-y-2">
                          {allSnippets?.map((snippet) =>
                            renderKnowledgeItem({
                              id: snippet._id,
                              type: "snippet",
                              title: snippet.name,
                              content: snippet.content,
                              snippet: snippet.shortcut
                                ? `/${snippet.shortcut} • ${snippet.content}`
                                : snippet.content,
                            })
                          )}
                        </div>
                      </div>
                    ) : null}

                    {isSearchingKnowledge ? (
                      hasKnowledgeResults ? (
                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Search Results
                          </p>
                          <div className="space-y-2">
                            {knowledgeResults?.map((item) => renderKnowledgeItem(item))}
                          </div>
                        </div>
                      ) : (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                          No matching knowledge found.
                        </p>
                      )
                    ) : null}

                    {!isSearchingKnowledge && !hasRecentContent && !hasSnippetLibrary ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        Start typing to search knowledge, or save this draft as a snippet.
                      </p>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant={showKnowledgePicker ? "default" : "ghost"}
                    size="icon"
                    onClick={onToggleKnowledgePicker}
                    title="Search knowledge (Ctrl+K or /)"
                  >
                    <BookOpen className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSaveDraftAsSnippet}
                    disabled={!canSaveDraftAsSnippet}
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    Save snippet
                  </Button>
                  {canUpdateSnippetFromDraft ? (
                    <Button variant="outline" size="sm" onClick={onUpdateSnippetFromDraft}>
                      Update {lastInsertedSnippetName ? `"${lastInsertedSnippetName}"` : "snippet"}
                    </Button>
                  ) : null}
                </div>
                <Input
                  ref={replyInputRef}
                  value={inputValue}
                  onChange={(event) => onInputChange(event.target.value)}
                  onKeyDown={onInputKeyDown}
                  placeholder="Type a message... (/ or Ctrl+K for knowledge)"
                  data-testid="inbox-reply-input"
                  disabled={isSending}
                  className="flex-1"
                />
                <Button
                  onClick={onSendMessage}
                  size="icon"
                  data-testid="inbox-send-button"
                  aria-label="Send reply"
                  disabled={isSending || !inputValue.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Select a conversation to start chatting</p>
          </div>
        </div>
      )}
    </Card>
  );
}
