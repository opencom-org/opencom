"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@opencom/convex";
import { Button, Card, Input } from "@opencom/ui";
import {
  Send,
  MessageSquare,
  Circle,
  Search,
  FileText,
  Zap,
  Link,
  X,
  BookOpen,
  MessageSquareText,
  Mail,
  Paperclip,
  Ticket,
  ShieldAlert,
  Bot,
  ArrowUpRight,
  ArrowLeft,
} from "lucide-react";
import type { Id } from "@opencom/convex/dataModel";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout, AppPageShell } from "@/components/AppLayout";
import { formatVisitorIdentityLabel } from "@/lib/visitorIdentity";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import {
  AdaptiveSecondaryPanel,
  ResponsivePrimaryRegion,
  ResponsiveSecondaryRegion,
  useIsCompactViewport,
} from "@/components/ResponsiveLayout";
import {
  buildUnreadSnapshot,
  getUnreadIncreases,
  loadInboxCuePreferences,
  shouldSuppressAttentionCue,
} from "@/lib/inboxNotificationCues";

function PresenceIndicator({ visitorId }: { visitorId: Id<"visitors"> }) {
  const isOnline = useQuery(api.visitors.isOnline, { visitorId });
  return (
    <Circle
      className={`h-2 w-2 ${isOnline ? "fill-green-500 text-green-500" : "fill-gray-300 text-gray-300"}`}
    />
  );
}

type ConversationStatus = "open" | "closed" | "snoozed";

type ConversationUiPatch = {
  unreadByAgent?: number;
  status?: ConversationStatus;
  lastMessageAt?: number;
  optimisticLastMessage?: string;
};

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
  const [suggestionsCount, setSuggestionsCount] = useState(0);
  const [isSuggestionsCountLoading, setIsSuggestionsCountLoading] = useState(false);
  const [readSyncConversationId, setReadSyncConversationId] = useState<Id<"conversations"> | null>(
    null
  );
  const [highlightedMessageId, setHighlightedMessageId] = useState<Id<"messages"> | null>(null);
  const [activeCompactPanel, setActiveCompactPanel] = useState<"ai-review" | "suggestions" | null>(
    null
  );
  const messageHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replyInputRef = useRef<HTMLInputElement | null>(null);
  const inboxCuePreferencesRef = useRef<{
    browserNotifications: boolean;
    sound: boolean;
  }>({
    browserNotifications: false,
    sound: false,
  });
  const unreadSnapshotRef = useRef<Record<string, number> | null>(null);
  const defaultTitleRef = useRef<string | null>(null);

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
  const queryConversationId = useMemo<Id<"conversations"> | null>(() => {
    const requestedConversationId =
      searchParams.get("conversationId") ?? searchParams.get("conversation");
    return requestedConversationId ? (requestedConversationId as Id<"conversations">) : null;
  }, [searchParams]);
  const isSidecarEnabled = aiSettings?.suggestionsEnabled === true;
  const orderedAiResponses = useMemo(() => {
    if (!aiResponses) {
      return aiResponses;
    }
    return [...aiResponses].sort((left, right) => right.createdAt - left.createdAt);
  }, [aiResponses]);
  const showConversationListPane = !isCompactViewport || !selectedConversationId;
  const showThreadPane = !isCompactViewport || Boolean(selectedConversationId);
  const aiReviewPanelOpen = Boolean(selectedConversationId) && activeCompactPanel === "ai-review";
  const suggestionsPanelOpen =
    Boolean(selectedConversationId) && isSidecarEnabled && activeCompactPanel === "suggestions";

  const focusReplyInput = () => {
    if (typeof window === "undefined") {
      return;
    }
    window.requestAnimationFrame(() => {
      replyInputRef.current?.focus();
    });
  };

  const closeCompactPanel = () => {
    setActiveCompactPanel(null);
    focusReplyInput();
  };

  const toggleAuxiliaryPanel = (panel: "ai-review" | "suggestions") => {
    setActiveCompactPanel((current) => (current === panel ? null : panel));
  };

  const playInboxCueSound = () => {
    if (typeof window === "undefined") {
      return;
    }
    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    gainNode.gain.setValueAtTime(0.05, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
    oscillator.onended = () => {
      void context.close();
    };
  };

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
    if (!selectedConversationId || !conversations) {
      return;
    }
    if (!conversations.some((conversation) => conversation._id === selectedConversationId)) {
      setSelectedConversationId(null);
    }
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    if (!queryConversationId || !conversations || selectedConversationId) {
      return;
    }
    if (!conversations.some((conversation) => conversation._id === queryConversationId)) {
      return;
    }
    setSelectedConversationId(queryConversationId);
  }, [conversations, queryConversationId, selectedConversationId]);

  useEffect(() => {
    let cancelled = false;

    const fetchSuggestionsCount = async () => {
      if (!selectedConversationId || !isSidecarEnabled) {
        setSuggestionsCount(0);
        setIsSuggestionsCountLoading(false);
        return;
      }

      setIsSuggestionsCountLoading(true);
      try {
        const results = await getSuggestionsForConversation({
          conversationId: selectedConversationId,
          limit: 5,
        });
        if (!cancelled) {
          setSuggestionsCount(results.length);
        }
      } catch (error) {
        console.error("Failed to fetch suggestions count:", error);
        if (!cancelled) {
          setSuggestionsCount(0);
        }
      } finally {
        if (!cancelled) {
          setIsSuggestionsCountLoading(false);
        }
      }
    };

    void fetchSuggestionsCount();

    return () => {
      cancelled = true;
    };
  }, [getSuggestionsForConversation, isSidecarEnabled, selectedConversationId, messages?.length]);

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

  useEffect(() => {
    if (!isCompactViewport || !selectedConversationId) {
      setActiveCompactPanel(null);
    }
  }, [isCompactViewport, selectedConversationId]);

  useEffect(() => {
    if (!isSidecarEnabled && activeCompactPanel === "suggestions") {
      setActiveCompactPanel(null);
    }
  }, [activeCompactPanel, isSidecarEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const refreshCuePreferences = () => {
      inboxCuePreferencesRef.current = loadInboxCuePreferences(window.localStorage);
    };
    refreshCuePreferences();
    window.addEventListener("storage", refreshCuePreferences);
    return () => {
      window.removeEventListener("storage", refreshCuePreferences);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (!defaultTitleRef.current) {
      defaultTitleRef.current = document.title;
    }

    const totalUnread =
      conversations?.reduce((sum, conversation) => sum + (conversation.unreadByAgent ?? 0), 0) ?? 0;
    const baseTitle = defaultTitleRef.current || "Inbox";
    document.title = totalUnread > 0 ? `(${totalUnread}) ${baseTitle}` : baseTitle;
  }, [conversations]);

  useEffect(() => {
    return () => {
      if (typeof document !== "undefined" && defaultTitleRef.current) {
        document.title = defaultTitleRef.current;
      }
    };
  }, []);

  useEffect(() => {
    if (!conversations || typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const previousSnapshot = unreadSnapshotRef.current;
    const currentSnapshot = buildUnreadSnapshot(
      conversations.map((conversation) => ({
        _id: conversation._id,
        unreadByAgent: conversation.unreadByAgent,
      }))
    );
    unreadSnapshotRef.current = currentSnapshot;

    if (!previousSnapshot) {
      return;
    }

    const increasedConversationIds = getUnreadIncreases({
      previous: previousSnapshot,
      conversations: conversations.map((conversation) => ({
        _id: conversation._id,
        unreadByAgent: conversation.unreadByAgent,
      })),
    });
    if (increasedConversationIds.length === 0) {
      return;
    }

    for (const conversationId of increasedConversationIds) {
      const conversation = conversations.find((item) => item._id === conversationId);
      if (!conversation) {
        continue;
      }

      const suppressCue = shouldSuppressAttentionCue({
        conversationId,
        selectedConversationId,
        isDocumentVisible: document.visibilityState === "visible",
        hasWindowFocus: document.hasFocus(),
      });
      if (suppressCue) {
        continue;
      }

      const preferences = inboxCuePreferencesRef.current;
      if (preferences.sound) {
        playInboxCueSound();
      }

      if (
        preferences.browserNotifications &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const notification = new Notification("New inbox message", {
          body: `${getConversationIdentityLabel(conversation)}: ${conversation.lastMessage?.content ?? "Open inbox to view details."}`,
          tag: `opencom-inbox-${conversation._id}`,
        });
        notification.onclick = () => {
          window.focus();
          const url = new URL(window.location.href);
          url.pathname = "/inbox";
          url.searchParams.set("conversationId", conversation._id);
          window.location.assign(url.toString());
        };
      }
    }
  }, [conversations, selectedConversationId]);

  const patchConversationState = (
    conversationId: Id<"conversations">,
    patch: ConversationUiPatch
  ) => {
    setConversationPatches((previousState) => ({
      ...previousState,
      [conversationId]: {
        ...(previousState[conversationId] ?? {}),
        ...patch,
      },
    }));
  };

  const handleSelectConversation = async (convId: Id<"conversations">) => {
    setWorkflowError(null);
    setSelectedConversationId(convId);
    const previousUnreadCount =
      conversations?.find((conversation) => conversation._id === convId)?.unreadByAgent ?? 0;
    patchConversationState(convId, { unreadByAgent: 0 });
    setReadSyncConversationId(convId);

    try {
      await markAsRead({ id: convId, readerType: "agent" });
    } catch (error) {
      console.error("Failed to mark conversation as read:", error);
      patchConversationState(convId, { unreadByAgent: previousUnreadCount });
      setWorkflowError("Failed to sync read state. Please retry.");
    } finally {
      setReadSyncConversationId((current) => (current === convId ? null : current));
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !selectedConversationId || !user) return;

    const content = inputValue.trim();
    const conversationId = selectedConversationId;
    const previousPatch = conversationPatches[conversationId];
    const now = Date.now();

    setWorkflowError(null);
    setIsSending(true);
    setInputValue("");
    patchConversationState(conversationId, {
      unreadByAgent: 0,
      lastMessageAt: now,
      optimisticLastMessage: content,
    });

    try {
      await sendMessage({
        conversationId,
        senderId: user._id,
        senderType: "agent",
        content,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      setInputValue(content);
      setWorkflowError("Failed to send reply. Please try again.");
      setConversationPatches((previousState) => {
        const nextState = { ...previousState };
        if (previousPatch) {
          nextState[conversationId] = previousPatch;
        } else {
          delete nextState[conversationId];
        }
        return nextState;
      });
    } finally {
      setIsSending(false);
    }
  };

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

  const handleConvertToTicket = async () => {
    if (!selectedConversationId) return;
    setWorkflowError(null);
    setIsConvertingTicket(true);
    try {
      const ticketId = await convertToTicket({
        conversationId: selectedConversationId,
      });
      router.push(`/tickets/${ticketId}`);
    } catch (error) {
      console.error("Failed to convert to ticket:", error);
      setWorkflowError(
        "Failed to convert to ticket. A ticket may already exist for this conversation."
      );
    } finally {
      setIsConvertingTicket(false);
    }
  };

  const handleResolveConversation = async () => {
    if (!selectedConversationId) return;
    const previousPatch = conversationPatches[selectedConversationId];

    setWorkflowError(null);
    setIsResolving(true);
    patchConversationState(selectedConversationId, {
      status: "closed",
      unreadByAgent: 0,
    });

    try {
      await updateStatus({
        id: selectedConversationId,
        status: "closed",
      });
    } catch (error) {
      console.error("Failed to resolve conversation:", error);
      setWorkflowError("Failed to resolve conversation. Please retry.");
      setConversationPatches((previousState) => {
        const nextState = { ...previousState };
        if (previousPatch) {
          nextState[selectedConversationId] = previousPatch;
        } else {
          delete nextState[selectedConversationId];
        }
        return nextState;
      });
    } finally {
      setIsResolving(false);
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

  const handleInsertArticleLink = (title: string, slug: string) => {
    const link = `[${title}](/help/${slug})`;
    setInputValue((prev) => prev + (prev ? " " : "") + link);
    setShowArticleSearch(false);
    setArticleSearch("");
  };

  const handleInsertKnowledgeContent = async (item: {
    id: string;
    type: "article" | "internalArticle" | "snippet";
    title: string;
    content: string;
  }) => {
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

  const getContentTypeIcon = (type: "article" | "internalArticle" | "snippet") => {
    switch (type) {
      case "article":
        return <FileText className="h-4 w-4 text-primary-foreground0" />;
      case "internalArticle":
        return <BookOpen className="h-4 w-4 text-purple-500" />;
      case "snippet":
        return <MessageSquareText className="h-4 w-4 text-green-500" />;
    }
  };

  const getContentTypeLabel = (type: "article" | "internalArticle" | "snippet") => {
    switch (type) {
      case "article":
        return "Article";
      case "internalArticle":
        return "Internal";
      case "snippet":
        return "Snippet";
    }
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
          <ResponsiveSecondaryRegion className="min-h-0" data-testid="inbox-conversation-pane">
            <Card className="h-full overflow-hidden flex flex-col">
              <div className="p-4 border-b space-y-2">
                <h2 className="font-semibold">Conversations</h2>
                <div className="flex items-center gap-2">
                  <label htmlFor="inbox-ai-filter" className="text-xs text-muted-foreground">
                    AI workflow
                  </label>
                  <select
                    id="inbox-ai-filter"
                    value={aiWorkflowFilter}
                    onChange={(event) =>
                      setAiWorkflowFilter(event.target.value as "all" | "ai_handled" | "handoff")
                    }
                    className="text-xs border rounded px-2 py-1 bg-background"
                    data-testid="inbox-ai-filter"
                  >
                    <option value="all">All conversations</option>
                    <option value="ai_handled">AI handled</option>
                    <option value="handoff">AI handoff</option>
                  </select>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto" data-testid="inbox-conversation-list">
                {isConversationsLoading ? (
                  <div
                    className="p-4 text-center text-muted-foreground"
                    data-testid="inbox-conversations-loading"
                  >
                    <p>Loading conversations...</p>
                  </div>
                ) : !conversations || conversations.length === 0 ? (
                  <div
                    className="p-4 text-center text-muted-foreground"
                    data-testid="inbox-empty-state"
                  >
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No conversations yet</p>
                    <p className="text-sm">
                      Conversations will appear here when visitors start chatting via your widget
                    </p>
                  </div>
                ) : (
                  conversations.map((conv: NonNullable<typeof conversations>[number]) => (
                    <button
                      key={conv._id}
                      onClick={() => void handleSelectConversation(conv._id)}
                      data-testid={`conversation-item-${conv._id}`}
                      data-conversation-id={conv._id}
                      className={`w-full p-4 text-left border-b hover:bg-muted/50 transition-colors ${
                        selectedConversationId === conv._id ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {/* Channel indicator */}
                          {conv.channel === "email" ? (
                            <Mail className="h-4 w-4 text-primary-foreground0" />
                          ) : (
                            <MessageSquare className="h-4 w-4 text-green-500" />
                          )}
                          {conv.visitorId && <PresenceIndicator visitorId={conv.visitorId} />}
                          <span
                            className="font-medium"
                            data-testid={`conversation-label-${conv._id}`}
                          >
                            {getConversationIdentityLabel(conv)}
                          </span>
                          {/* Unverified badge (task 7.4) */}
                          {conv.visitor && conv.visitor.identityVerified === false && (
                            <span
                              className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700"
                              title="Identity not verified"
                            >
                              <ShieldAlert className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {readSyncConversationId === conv._id && (
                            <span className="text-xs text-muted-foreground">Syncing...</span>
                          )}
                          {typeof conv.unreadByAgent === "number" && conv.unreadByAgent > 0 && (
                            <span
                              className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full"
                              data-testid={`conversation-unread-badge-${conv._id}`}
                            >
                              {conv.unreadByAgent}
                            </span>
                          )}
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              conv.status === "open"
                                ? "bg-green-100 text-green-700"
                                : conv.status === "closed"
                                  ? "bg-gray-100 text-gray-700"
                                  : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {conv.status}
                          </span>
                        </div>
                      </div>
                      {/* Show subject for email conversations */}
                      {conv.channel === "email" && conv.subject && (
                        <p className="text-sm font-medium text-foreground mt-1 truncate">
                          {conv.subject}
                        </p>
                      )}
                      {conv.lastMessage && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {conv.lastMessage.content}
                        </p>
                      )}
                      {conv.aiWorkflow?.state && conv.aiWorkflow.state !== "none" && (
                        <div
                          className="mt-1 flex items-center gap-2 text-xs"
                          data-testid={`conversation-ai-state-${conv._id}`}
                        >
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                              conv.aiWorkflow.state === "handoff"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            <Bot className="h-3 w-3" />
                            {conv.aiWorkflow.state === "handoff" ? "AI handoff" : "AI handled"}
                          </span>
                          {conv.aiWorkflow.state === "handoff" && conv.aiWorkflow.handoffReason && (
                            <span
                              className="truncate text-amber-700"
                              data-testid={`conversation-ai-handoff-reason-${conv._id}`}
                            >
                              {conv.aiWorkflow.handoffReason}
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(conv.lastMessageAt || conv.createdAt).toLocaleString()}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </Card>
          </ResponsiveSecondaryRegion>
        )}

        {showThreadPane && (
          <ResponsivePrimaryRegion className="min-h-0" data-testid="inbox-thread-pane">
            <div className="h-full min-h-0 flex gap-4">
              <Card
                className="flex-1 min-w-0 flex flex-col overflow-hidden"
                data-testid="inbox-primary-thread-pane"
              >
                {selectedConversationId ? (
                  <>
                    <div className="p-4 border-b space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isCompactViewport && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedConversationId(null);
                                setActiveCompactPanel(null);
                              }}
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
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResolveConversation}
                            disabled={isResolving || selectedConversation?.status === "closed"}
                            data-testid="inbox-resolve-button"
                            title="Resolve Conversation"
                          >
                            {isResolving ? "Resolving..." : "Resolve"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleConvertToTicket}
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
                              onClick={() =>
                                router.push(`/visitors/${selectedConversation.visitorId}`)
                              }
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
                              onClick={() => toggleAuxiliaryPanel("ai-review")}
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
                              onClick={() => toggleAuxiliaryPanel("suggestions")}
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
                      </div>
                      {isCompactViewport && (
                        <div
                          className="flex items-center gap-2"
                          data-testid="inbox-compact-aux-actions"
                        >
                          <Button
                            variant={activeCompactPanel === "ai-review" ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleAuxiliaryPanel("ai-review")}
                            data-testid="inbox-open-ai-review"
                          >
                            <Bot className="h-4 w-4 mr-1" />
                            AI review
                          </Button>
                          {isSidecarEnabled && (
                            <Button
                              variant={activeCompactPanel === "suggestions" ? "default" : "outline"}
                              size="sm"
                              onClick={() => toggleAuxiliaryPanel("suggestions")}
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

                    {/* Unverified user warning banner (task 7.5) */}
                    {selectedConversation?.visitor?.identityVerified === false && (
                      <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-sm text-amber-800">
                        <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                        <span>
                          <strong>Unverified user:</strong> This visitor&apos;s identity has not
                          been verified. Messages may be from an impersonator.
                        </span>
                      </div>
                    )}

                    <div
                      className="flex-1 overflow-y-auto p-4 space-y-4"
                      data-testid="inbox-message-list"
                    >
                      {messages === undefined ? (
                        <div
                          className="text-sm text-muted-foreground"
                          data-testid="inbox-messages-loading"
                        >
                          Loading conversation...
                        </div>
                      ) : messages.length === 0 ? (
                        <div
                          className="text-sm text-muted-foreground"
                          data-testid="inbox-messages-empty"
                        >
                          No messages yet
                        </div>
                      ) : (
                        messages.map((msg: NonNullable<typeof messages>[number]) => (
                          <div
                            key={msg._id}
                            id={`message-${msg._id}`}
                            data-testid={`message-item-${msg._id}`}
                            data-highlighted={highlightedMessageId === msg._id ? "true" : "false"}
                            className={`flex ${
                              msg.senderType === "agent" || msg.senderType === "bot"
                                ? "justify-end"
                                : "justify-start"
                            }`}
                          >
                            <div
                              className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                                msg.senderType === "agent"
                                  ? "bg-primary text-primary-foreground"
                                  : msg.senderType === "bot"
                                    ? "bg-muted text-muted-foreground"
                                    : "bg-muted"
                              } ${highlightedMessageId === msg._id ? "ring-2 ring-primary/60 ring-offset-1" : ""}`}
                            >
                              {/* Email subject header */}
                              {msg.channel === "email" && msg.emailMetadata?.subject && (
                                <div className="flex items-center gap-1 text-xs opacity-70 mb-1">
                                  <Mail className="h-3 w-3" />
                                  <span className="font-medium">{msg.emailMetadata.subject}</span>
                                </div>
                              )}
                              {/* Email from/to for inbound emails */}
                              {msg.channel === "email" &&
                                msg.senderType === "visitor" &&
                                msg.emailMetadata?.from && (
                                  <div className="text-xs opacity-70 mb-2">
                                    From: {msg.emailMetadata.from}
                                  </div>
                                )}
                              <p className="whitespace-pre-wrap">
                                {msg.content.replace(/<[^>]*>/g, "")}
                              </p>
                              {/* Attachments indicator */}
                              {msg.emailMetadata?.attachments &&
                                msg.emailMetadata.attachments.length > 0 && (
                                  <div className="flex items-center gap-1 text-xs opacity-70 mt-2">
                                    <Paperclip className="h-3 w-3" />
                                    <span>
                                      {msg.emailMetadata.attachments.length} attachment(s)
                                    </span>
                                  </div>
                                )}
                              <div className="flex items-center gap-2 text-xs opacity-70 mt-1">
                                <span>
                                  {msg.channel === "email" && (
                                    <Mail className="h-3 w-3 inline mr-1" />
                                  )}
                                  {msg.senderType === "bot"
                                    ? "Bot"
                                    : msg.senderType === "agent"
                                      ? "You"
                                      : "Visitor"}{" "}
                                  • {new Date(msg.createdAt).toLocaleTimeString()}
                                </span>
                                {/* Delivery status for outbound emails */}
                                {msg.channel === "email" &&
                                  msg.senderType === "agent" &&
                                  msg.deliveryStatus && (
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                                        msg.deliveryStatus === "sent" ||
                                        msg.deliveryStatus === "delivered"
                                          ? "bg-green-100 text-green-700"
                                          : msg.deliveryStatus === "pending"
                                            ? "bg-yellow-100 text-yellow-700"
                                            : "bg-red-100 text-red-700"
                                      }`}
                                    >
                                      {msg.deliveryStatus}
                                    </span>
                                  )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="p-4 border-t relative">
                      {/* Snippet Picker */}
                      {showSnippetPicker && (
                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                          <div className="p-2 border-b flex items-center gap-2">
                            <Zap className="h-4 w-4 text-muted-foreground" />
                            <input
                              type="text"
                              value={snippetSearch}
                              onChange={(e) => setSnippetSearch(e.target.value)}
                              placeholder="Search snippets..."
                              className="flex-1 text-sm outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => setShowSnippetPicker(false)}
                              className="p-1 hover:bg-muted rounded"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="p-1">
                            {(snippetSearch ? snippets : allSnippets)?.map(
                              (snippet: NonNullable<typeof allSnippets>[number]) => (
                                <button
                                  key={snippet._id}
                                  onClick={() => handleSelectSnippet(snippet.content)}
                                  className="w-full text-left p-2 hover:bg-muted rounded text-sm"
                                >
                                  <div className="font-medium">{snippet.name}</div>
                                  {snippet.shortcut && (
                                    <div className="text-xs text-muted-foreground">
                                      /{snippet.shortcut}
                                    </div>
                                  )}
                                </button>
                              )
                            )}
                            {(snippetSearch ? snippets : allSnippets)?.length === 0 && (
                              <p className="text-sm text-muted-foreground p-2">No snippets found</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Article Search */}
                      {showArticleSearch && (
                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                          <div className="p-2 border-b flex items-center gap-2">
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <input
                              type="text"
                              value={articleSearch}
                              onChange={(e) => setArticleSearch(e.target.value)}
                              placeholder="Search articles..."
                              className="flex-1 text-sm outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => setShowArticleSearch(false)}
                              className="p-1 hover:bg-muted rounded"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="p-1">
                            {articles?.map((article: NonNullable<typeof articles>[number]) => (
                              <button
                                key={article._id}
                                onClick={() => handleInsertArticleLink(article.title, article.slug)}
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

                      {/* Knowledge Search Panel */}
                      {showKnowledgePanel && (
                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border rounded-lg shadow-lg max-h-80 overflow-y-auto">
                          <div className="p-2 border-b flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            <input
                              type="text"
                              value={knowledgeSearch}
                              onChange={(e) => setKnowledgeSearch(e.target.value)}
                              placeholder="Search all knowledge... (Ctrl+K)"
                              className="flex-1 text-sm outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => setShowKnowledgePanel(false)}
                              className="p-1 hover:bg-muted rounded"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="p-1">
                            {/* Recent Content */}
                            {!knowledgeSearch && recentContent && recentContent.length > 0 && (
                              <div className="mb-2">
                                <p className="text-xs text-muted-foreground px-2 py-1">
                                  Recently Used
                                </p>
                                {recentContent.map(
                                  (item: NonNullable<typeof recentContent>[number]) => (
                                    <button
                                      key={`${item.type}-${item.id}`}
                                      onClick={() => handleInsertKnowledgeContent(item)}
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
                                  )
                                )}
                              </div>
                            )}

                            {/* Search Results */}
                            {knowledgeSearch.length >= 2 && knowledgeResults && (
                              <>
                                <p className="text-xs text-muted-foreground px-2 py-1">
                                  Search Results
                                </p>
                                {knowledgeResults.map(
                                  (item: NonNullable<typeof knowledgeResults>[number]) => (
                                    <button
                                      key={`${item.type}-${item.id}`}
                                      onClick={() => handleInsertKnowledgeContent(item)}
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
                                  )
                                )}
                                {knowledgeResults.length === 0 && (
                                  <p className="text-sm text-muted-foreground p-2">
                                    No results found
                                  </p>
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
                            onClick={() => {
                              setShowSnippetPicker(!showSnippetPicker);
                              setShowArticleSearch(false);
                            }}
                            title="Insert snippet (or type /)"
                          >
                            <Zap className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setShowArticleSearch(!showArticleSearch);
                              setShowSnippetPicker(false);
                              setShowKnowledgePanel(false);
                            }}
                            title="Insert article link"
                          >
                            <Link className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setShowKnowledgePanel(!showKnowledgePanel);
                              setShowSnippetPicker(false);
                              setShowArticleSearch(false);
                            }}
                            title="Search knowledge (Ctrl+K)"
                          >
                            <BookOpen className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          ref={replyInputRef}
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Type a message... (/ for snippets)"
                          data-testid="inbox-reply-input"
                          disabled={isSending}
                          className="flex-1"
                        />
                        <Button
                          onClick={handleSendMessage}
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
                  <Card className="h-full flex flex-col overflow-hidden">
                    <div className="p-4 border-b">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        AI review
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Review AI responses, confidence, feedback, and handoff context.
                      </p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {aiResponses === undefined ? (
                        <p
                          className="text-sm text-muted-foreground"
                          data-testid="inbox-ai-review-loading"
                        >
                          Loading AI responses...
                        </p>
                      ) : !orderedAiResponses || orderedAiResponses.length === 0 ? (
                        <p
                          className="text-sm text-muted-foreground"
                          data-testid="inbox-ai-review-empty"
                        >
                          No AI responses in this conversation yet.
                        </p>
                      ) : (
                        orderedAiResponses.map(
                          (response: NonNullable<typeof orderedAiResponses>[number]) => (
                            <article
                              key={response._id}
                              className="rounded-lg border p-3 space-y-2"
                              data-testid={`inbox-ai-review-entry-${response._id}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                                    response.handedOff
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-blue-100 text-blue-700"
                                  }`}
                                >
                                  <Bot className="h-3 w-3" />
                                  {response.handedOff ? "AI handoff" : "AI handled"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(response.createdAt).toLocaleTimeString()}
                                </span>
                              </div>

                              <p className="text-sm whitespace-pre-wrap">{response.response}</p>

                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="rounded bg-muted px-2 py-0.5">
                                  Confidence {Math.round(response.confidence * 100)}%
                                </span>
                                {response.feedback && (
                                  <span className="rounded bg-muted px-2 py-0.5">
                                    Feedback{" "}
                                    {response.feedback === "helpful" ? "helpful" : "not helpful"}
                                  </span>
                                )}
                              </div>

                              {response.sources.length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-xs text-muted-foreground">Sources</p>
                                  <ul className="flex flex-wrap gap-1">
                                    {response.sources.map((source, index) => (
                                      <li
                                        key={`${response._id}-${source.id}-${index}`}
                                        className="rounded border px-2 py-0.5 text-xs"
                                      >
                                        {source.title}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {response.handedOff && (
                                <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                                  Handoff reason:{" "}
                                  {response.handoffReason ??
                                    selectedConversation?.aiWorkflow?.handoffReason ??
                                    "Not specified"}
                                </p>
                              )}

                              <div className="flex justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => jumpToMessage(response.messageId)}
                                  data-testid={`inbox-ai-review-jump-${response._id}`}
                                >
                                  View in thread
                                  <ArrowUpRight className="h-3 w-3 ml-1" />
                                </Button>
                              </div>
                            </article>
                          )
                        )
                      )}
                    </div>
                  </Card>
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
