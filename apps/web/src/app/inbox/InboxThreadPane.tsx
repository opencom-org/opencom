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
  Search,
  Send,
  ShieldAlert,
  Ticket,
  X,
  Zap,
} from "lucide-react";
import type { Id } from "@opencom/convex/dataModel";
import {
  type InboxArticle,
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
  showSnippetPicker: boolean;
  snippetSearch: string;
  showArticleSearch: boolean;
  articleSearch: string;
  showKnowledgePanel: boolean;
  knowledgeSearch: string;
  snippets: InboxSnippet[] | undefined;
  allSnippets: InboxSnippet[] | undefined;
  articles: InboxArticle[] | undefined;
  knowledgeResults: InboxKnowledgeItem[] | undefined;
  recentContent: InboxKnowledgeItem[] | undefined;
  activeCompactPanel: InboxCompactPanel;
  aiReviewPanelOpen: boolean;
  suggestionsPanelOpen: boolean;
  isSidecarEnabled: boolean;
  suggestionsCount: number;
  isSuggestionsCountLoading: boolean;
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
  onToggleSnippetPicker: () => void;
  onToggleArticleSearch: () => void;
  onToggleKnowledgePanel: () => void;
  onSnippetSearchChange: (value: string) => void;
  onArticleSearchChange: (value: string) => void;
  onKnowledgeSearchChange: (value: string) => void;
  onCloseSnippetPicker: () => void;
  onCloseArticleSearch: () => void;
  onCloseKnowledgePanel: () => void;
  onSelectSnippet: (content: string) => void;
  onInsertArticleLink: (title: string, slug: string) => void;
  onInsertKnowledgeContent: (item: InboxKnowledgeItem) => void;
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
  showSnippetPicker,
  snippetSearch,
  showArticleSearch,
  articleSearch,
  showKnowledgePanel,
  knowledgeSearch,
  snippets,
  allSnippets,
  articles,
  knowledgeResults,
  recentContent,
  activeCompactPanel,
  aiReviewPanelOpen,
  suggestionsPanelOpen,
  isSidecarEnabled,
  suggestionsCount,
  isSuggestionsCountLoading,
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
  onToggleSnippetPicker,
  onToggleArticleSearch,
  onToggleKnowledgePanel,
  onSnippetSearchChange,
  onArticleSearchChange,
  onKnowledgeSearchChange,
  onCloseSnippetPicker,
  onCloseArticleSearch,
  onCloseKnowledgePanel,
  onSelectSnippet,
  onInsertArticleLink,
  onInsertKnowledgeContent,
  getConversationIdentityLabel,
  getHandoffReasonLabel,
}: InboxThreadPaneProps): React.JSX.Element {
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
              {showSnippetPicker && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  <div className="p-2 border-b flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={snippetSearch}
                      onChange={(event) => onSnippetSearchChange(event.target.value)}
                      placeholder="Search snippets..."
                      className="flex-1 text-sm outline-none"
                      autoFocus
                    />
                    <button onClick={onCloseSnippetPicker} className="p-1 hover:bg-muted rounded">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="p-1">
                    {(snippetSearch ? snippets : allSnippets)?.map((snippet) => (
                      <button
                        key={snippet._id}
                        onClick={() => onSelectSnippet(snippet.content)}
                        className="w-full text-left p-2 hover:bg-muted rounded text-sm"
                      >
                        <div className="font-medium">{snippet.name}</div>
                        {snippet.shortcut && (
                          <div className="text-xs text-muted-foreground">/{snippet.shortcut}</div>
                        )}
                      </button>
                    ))}
                    {(snippetSearch ? snippets : allSnippets)?.length === 0 && (
                      <p className="text-sm text-muted-foreground p-2">No snippets found</p>
                    )}
                  </div>
                </div>
              )}

              {showArticleSearch && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  <div className="p-2 border-b flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={articleSearch}
                      onChange={(event) => onArticleSearchChange(event.target.value)}
                      placeholder="Search articles..."
                      className="flex-1 text-sm outline-none"
                      autoFocus
                    />
                    <button onClick={onCloseArticleSearch} className="p-1 hover:bg-muted rounded">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="p-1">
                    {articles?.map((article) => (
                      <button
                        key={article._id}
                        onClick={() => onInsertArticleLink(article.title, article.slug)}
                        className="w-full text-left p-2 hover:bg-muted rounded text-sm flex items-start gap-2"
                      >
                        <FileText className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <div className="font-medium">{article.title}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {article.content.slice(0, 60)}...
                          </div>
                        </div>
                      </button>
                    ))}
                    {articleSearch.length < 2 && (
                      <p className="text-sm text-muted-foreground p-2">
                        Type at least 2 characters to search
                      </p>
                    )}
                    {articleSearch.length >= 2 && articles?.length === 0 && (
                      <p className="text-sm text-muted-foreground p-2">No articles found</p>
                    )}
                  </div>
                </div>
              )}

              {showKnowledgePanel && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border rounded-lg shadow-lg max-h-80 overflow-y-auto">
                  <div className="p-2 border-b flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={knowledgeSearch}
                      onChange={(event) => onKnowledgeSearchChange(event.target.value)}
                      placeholder="Search all knowledge... (Ctrl+K)"
                      className="flex-1 text-sm outline-none"
                      autoFocus
                    />
                    <button onClick={onCloseKnowledgePanel} className="p-1 hover:bg-muted rounded">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="p-1">
                    {!knowledgeSearch && recentContent && recentContent.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs text-muted-foreground px-2 py-1">Recently Used</p>
                        {recentContent.map((item) => (
                          <button
                            key={`${item.type}-${item.id}`}
                            onClick={() => onInsertKnowledgeContent(item)}
                            className="w-full text-left p-2 hover:bg-muted rounded text-sm flex items-start gap-2"
                          >
                            {getContentTypeIcon(item.type)}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{item.title}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {item.content.slice(0, 50)}...
                              </div>
                            </div>
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                item.type === "article"
                                  ? "bg-primary/10 text-primary"
                                  : item.type === "internalArticle"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-green-100 text-green-700"
                              }`}
                            >
                              {getContentTypeLabel(item.type)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {knowledgeSearch.length >= 2 && knowledgeResults && (
                      <>
                        <p className="text-xs text-muted-foreground px-2 py-1">Search Results</p>
                        {knowledgeResults.map((item) => (
                          <button
                            key={`${item.type}-${item.id}`}
                            onClick={() => onInsertKnowledgeContent(item)}
                            className="w-full text-left p-2 hover:bg-muted rounded text-sm flex items-start gap-2"
                          >
                            {getContentTypeIcon(item.type)}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{item.title}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {item.snippet || item.content.slice(0, 50)}...
                              </div>
                            </div>
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                item.type === "article"
                                  ? "bg-primary/10 text-primary"
                                  : item.type === "internalArticle"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-green-100 text-green-700"
                              }`}
                            >
                              {getContentTypeLabel(item.type)}
                            </span>
                          </button>
                        ))}
                        {knowledgeResults.length === 0 && (
                          <p className="text-sm text-muted-foreground p-2">No results found</p>
                        )}
                      </>
                    )}

                    {knowledgeSearch.length > 0 && knowledgeSearch.length < 2 && (
                      <p className="text-sm text-muted-foreground p-2">
                        Type at least 2 characters to search
                      </p>
                    )}

                    {!knowledgeSearch && (!recentContent || recentContent.length === 0) && (
                      <p className="text-sm text-muted-foreground p-2">
                        Start typing to search all knowledge
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggleSnippetPicker}
                    title="Insert snippet (or type /)"
                  >
                    <Zap className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggleArticleSearch}
                    title="Insert article link"
                  >
                    <Link className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggleKnowledgePanel}
                    title="Search knowledge (Ctrl+K)"
                  >
                    <BookOpen className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  ref={replyInputRef}
                  value={inputValue}
                  onChange={(event) => onInputChange(event.target.value)}
                  onKeyDown={onInputKeyDown}
                  placeholder="Type a message... (/ for snippets)"
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
