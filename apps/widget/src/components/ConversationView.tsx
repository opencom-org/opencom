import { useState, useEffect, useMemo, useRef } from "react";
import type { Id } from "@opencom/convex/dataModel";
import {
  normalizeUnknownError,
  uploadSupportAttachments,
  type StagedSupportAttachment,
} from "@opencom/web-shared";
import { ChevronLeft, X, User } from "../icons";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useConversationViewConvex } from "../hooks/convex/useConversationViewConvex";
import { parseMarkdown } from "../utils/parseMarkdown";
import { MANUAL_HANDOFF_REASON } from "./conversationView/constants";
import { ConversationFooter } from "./conversationView/Footer";
import { ConversationMessageList } from "./conversationView/MessageList";
import type {
  AiFeedback,
  AiResponseData,
  ArticleSuggestion,
  ConversationMessage,
  ConversationViewProps,
} from "./conversationView/types";

export function ConversationView({
  conversationId,
  visitorId,
  conversationStatus,
  activeWorkspaceId,
  sessionId,
  sessionTokenRef,
  sessionToken,
  userInfo,
  automationSettings,
  officeHoursStatus,
  expectedReplyTime,
  commonIssueButtons,
  onBack,
  onClose,
  onSelectArticle,
}: ConversationViewProps) {
  const [inputValue, setInputValue] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [aiResponseFeedback, setAiResponseFeedback] = useState<Record<string, AiFeedback>>({});
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [emailCapturedOrDismissed, setEmailCapturedOrDismissed] = useState(() => {
    return sessionStorage.getItem("opencom_email_dismissed") === "true";
  });
  const [emailCapturedThisSession, setEmailCapturedThisSession] = useState(false);
  // const [hasVisitorSentMessage, setHasVisitorSentMessage] = useState(false);
  const [lastAgentMessageCount, setLastAgentMessageCount] = useState(0);
  const [emailInput, setEmailInput] = useState("");
  const [showArticleSuggestions, setShowArticleSuggestions] = useState(false);
  const [articleSuggestions, setArticleSuggestions] = useState<ArticleSuggestion[]>([]);
  const [, setIsLoadingSuggestions] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<
    StagedSupportAttachment<Id<"supportAttachments">>[]
  >([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [csatPromptVisible, setCsatPromptVisible] = useState(false);
  const [dismissedCsatByConversation, setDismissedCsatByConversation] = useState<
    Record<string, true>
  >({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversationKey = conversationId.toString();
  const isConversationResolved = conversationStatus === "closed";
  const shouldEvaluateCsat = isConversationResolved && !!automationSettings?.askForRatingEnabled;

  const debouncedInputValue = useDebouncedValue(inputValue, 300);

  const {
    aiResponses,
    aiSettings,
    conversationData,
    csatEligibility,
    finalizeSupportAttachmentUpload,
    generateAiResponse,
    generateSupportAttachmentUploadUrl,
    handoffToHuman,
    identifyVisitor,
    messages,
    persistedVisitorProfile,
    searchArticleSuggestions,
    sendMessageMutation,
    submitAiFeedback,
  } = useConversationViewConvex({
    conversationId,
    visitorId,
    activeWorkspaceId,
    sessionId,
    sessionToken,
    shouldEvaluateCsat,
  });

  const isVisitorAlreadyIdentified = Boolean(
    emailCapturedThisSession ||
    userInfo?.email ||
    persistedVisitorProfile?.email ||
    persistedVisitorProfile?.externalUserId
  );
  const agentMessageCount =
    messages?.filter((m: { senderType: string }) => m.senderType !== "visitor").length ?? 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setPendingAttachments([]);
  }, [conversationId]);

  useEffect(() => {
    const dismissed = dismissedCsatByConversation[conversationKey];
    const eligible = shouldEvaluateCsat && !!csatEligibility?.eligible && !dismissed;
    if (!eligible) {
      setCsatPromptVisible(false);
      return;
    }

    const timer = setTimeout(() => {
      setCsatPromptVisible(true);
    }, 250);
    return () => clearTimeout(timer);
  }, [conversationKey, shouldEvaluateCsat, csatEligibility?.eligible, dismissedCsatByConversation]);

  // Fetch article suggestions when user types (debounced)
  useEffect(() => {
    if (
      !debouncedInputValue ||
      debouncedInputValue.length < 2 ||
      !activeWorkspaceId ||
      !automationSettings?.suggestArticlesEnabled
    ) {
      setArticleSuggestions([]);
      setShowArticleSuggestions(false);
      return;
    }

    const fetchSuggestions = async () => {
      setIsLoadingSuggestions(true);
      try {
        const results = await searchArticleSuggestions({
          workspaceId: activeWorkspaceId as Id<"workspaces">,
          visitorId,
          sessionToken: sessionTokenRef.current ?? "",
          origin: window.location.origin,
          query: debouncedInputValue,
          limit: 3,
        });
        setArticleSuggestions(results);
        setShowArticleSuggestions(results.length > 0);
      } catch (error) {
        console.error("Failed to fetch article suggestions:", error);
        setArticleSuggestions([]);
        setShowArticleSuggestions(false);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, [
    debouncedInputValue,
    activeWorkspaceId,
    automationSettings?.suggestArticlesEnabled,
    searchArticleSuggestions,
  ]);

  // Smart email capture
  useEffect(() => {
    if (!visitorId) return;
    if (isVisitorAlreadyIdentified) {
      setShowEmailCapture(false);
      return;
    }
    // if (!hasVisitorSentMessage) return;
    if (!automationSettings?.collectEmailEnabled) return;

    const agentCount = agentMessageCount;

    if (!emailCapturedOrDismissed) {
      setShowEmailCapture(true);
      return;
    }

    if (agentCount > lastAgentMessageCount && !isVisitorAlreadyIdentified) {
      setShowEmailCapture(true);
      setEmailCapturedOrDismissed(false);
    }
    setLastAgentMessageCount(agentCount);
  }, [
    visitorId,
    isVisitorAlreadyIdentified,
    // hasVisitorSentMessage,
    agentMessageCount,
    emailCapturedOrDismissed,
    lastAgentMessageCount,
    automationSettings?.collectEmailEnabled,
  ]);

  const sendMessage = async () => {
    if (
      (!inputValue.trim() && pendingAttachments.length === 0) ||
      !conversationId ||
      !visitorId ||
      !activeWorkspaceId ||
      isConversationResolved
    ) {
      return;
    }

    const content = inputValue;
    setInputValue("");

    try {
      setComposerError(null);
      await sendMessageMutation({
        conversationId,
        senderId: visitorId,
        senderType: "visitor",
        content,
        attachmentIds: pendingAttachments.map((attachment) => attachment.attachmentId),
        visitorId,
        sessionToken: sessionTokenRef.current ?? undefined,
      });
      setPendingAttachments([]);
      // if (!hasVisitorSentMessage) {
      //   setHasVisitorSentMessage(true);
      // }

      if (aiSettings?.enabled !== false) {
        setIsAiTyping(true);
        try {
          const history =
            messages?.map((m: { senderType: string; content: string }) => ({
              role: m.senderType === "visitor" ? ("user" as const) : ("assistant" as const),
              content: m.content,
            })) || [];

          await generateAiResponse({
            workspaceId: activeWorkspaceId as Id<"workspaces">,
            conversationId,
            visitorId,
            sessionToken: sessionTokenRef.current ?? undefined,
            query: content,
            conversationHistory: history,
          });
        } catch (aiError) {
          console.error("AI response generation failed:", aiError);
          try {
            await handoffToHuman({
              conversationId,
              visitorId,
              sessionToken: sessionTokenRef.current ?? undefined,
              reason: "AI generation failed",
            });
          } catch (handoffError) {
            console.error("AI handoff fallback failed:", handoffError);
          }
        } finally {
          setIsAiTyping(false);
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setInputValue(content);
      setComposerError(
        normalizeUnknownError(error, {
          fallbackMessage: "Failed to send message.",
          nextAction: "Please try again.",
        }).message
      );
    }
  };

  const handleUploadAttachments = async (files: File[]) => {
    if (!activeWorkspaceId || !visitorId || files.length === 0) {
      return;
    }

    setIsUploadingAttachments(true);
    try {
      setComposerError(null);
      const uploadedAttachments = await uploadSupportAttachments({
        files,
        currentCount: pendingAttachments.length,
        workspaceId: activeWorkspaceId as Id<"workspaces">,
        visitorId,
        sessionToken: sessionTokenRef.current ?? undefined,
        generateUploadUrl: generateSupportAttachmentUploadUrl,
        finalizeUpload: finalizeSupportAttachmentUpload,
      });
      setPendingAttachments((current) => [...current, ...uploadedAttachments]);
    } catch (error) {
      const normalizedError = normalizeUnknownError(error, {
        fallbackMessage: "Failed to upload attachment.",
        nextAction: "Try again with a supported file.",
      });
      console.error("Failed to upload widget attachment:", normalizedError.message);
      setComposerError(normalizedError.message);
    } finally {
      setIsUploadingAttachments(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleEmailSubmit = async () => {
    if (!emailInput.trim() || !visitorId) return;
    try {
      await identifyVisitor({
        visitorId,
        sessionToken: sessionTokenRef.current ?? undefined,
        email: emailInput.trim(),
        origin: window.location.origin,
      });
      setShowEmailCapture(false);
      setEmailCapturedOrDismissed(true);
      setEmailCapturedThisSession(true);
      setLastAgentMessageCount(agentMessageCount);
      setEmailInput("");
      sessionStorage.setItem("opencom_email_dismissed", "true");
    } catch (error) {
      console.error("Failed to save email:", error);
    }
  };

  const handleEmailDismiss = () => {
    setShowEmailCapture(false);
    setEmailCapturedOrDismissed(true);
    setLastAgentMessageCount(agentMessageCount);
    sessionStorage.setItem("opencom_email_dismissed", "true");
  };

  const isAiMessage = (message: ConversationMessage) => {
    if (message.senderType !== "bot") {
      return false;
    }

    if (message.senderId === "ai-agent") {
      return true;
    }

    return aiResponses?.some((response: { messageId: string }) => response.messageId === message._id) ?? false;
  };

  const getAiResponseData = (messageId: string): AiResponseData | undefined => {
    return aiResponses?.find(
      (response: { messageId: string }) => response.messageId === messageId
    ) as AiResponseData | undefined;
  };

  const handleAiFeedback = async (responseId: string, feedback: AiFeedback) => {
    try {
      await submitAiFeedback({
        responseId: responseId as Id<"aiResponses">,
        feedback,
        visitorId,
        sessionToken: sessionTokenRef.current ?? undefined,
      });
      setAiResponseFeedback((prev) => ({ ...prev, [responseId]: feedback }));
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    }
  };

  const handleTalkToHuman = async () => {
    if (!conversationId) return;
    try {
      await handoffToHuman({
        conversationId,
        visitorId,
        sessionToken: sessionTokenRef.current ?? undefined,
        reason: MANUAL_HANDOFF_REASON,
      });
    } catch (error) {
      console.error("Failed to handoff to human:", error);
    }
  };

  const showWaitingForHumanSupport = useMemo(() => {
    if (!messages || messages.length === 0) {
      return false;
    }

    const aiWorkflowState = conversationData?.aiWorkflowState ?? "none";
    const handoffMessageIds = new Set(
      (aiResponses ?? [])
        .filter((response: { handedOff?: boolean; messageId: string }) => response.handedOff)
        .map((response: { messageId: string }) => response.messageId)
    );

    const hasResponseTrackedHandoff = handoffMessageIds.size > 0;
    const hasConversationHandoffState = aiWorkflowState === "handoff";
    if (!hasResponseTrackedHandoff && !hasConversationHandoffState) {
      return false;
    }

    let lastHandoffMessageIndex = -1;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      const isTrackedHandoff = handoffMessageIds.has(message._id);
      const isAiHandoffFallback =
        hasConversationHandoffState &&
        message.senderType === "bot" &&
        message.senderId === "ai-agent";

      if (isTrackedHandoff || isAiHandoffFallback) {
        lastHandoffMessageIndex = i;
        break;
      }
    }
    if (lastHandoffMessageIndex < 0) {
      return false;
    }

    return !messages
      .slice(lastHandoffMessageIndex + 1)
      .some((message) => message.senderType === "agent" || message.senderType === "user");
  }, [aiResponses, conversationData?.aiWorkflowState, messages]);

  const dismissCsatPrompt = () => {
    setCsatPromptVisible(false);
    setDismissedCsatByConversation((prev) => ({ ...prev, [conversationKey]: true }));
  };

  const handleCsatSubmitted = () => {
    setCsatPromptVisible(false);
    setDismissedCsatByConversation((prev) => ({ ...prev, [conversationKey]: true }));
  };

  const renderedMessages = useMemo(() => {
    if (!messages) {
      return new Map<string, string>();
    }

    return new Map(
      (messages as ConversationMessage[]).map((message) => [
        message._id,
        parseMarkdown(message.content),
      ])
    );
  }, [messages]);

  return (
    <div className="opencom-chat">
      <div className="opencom-header">
        <button
          onClick={onBack}
          className="opencom-back"
          data-testid="widget-back-button"
          type="button"
        >
          <ChevronLeft />
        </button>
        <span>Chat with us</span>
        <div className="opencom-header-actions">
          {aiSettings?.enabled && (
            <button
              onClick={handleTalkToHuman}
              className="opencom-talk-to-human"
              title="Talk to a human"
              data-testid="widget-talk-to-human"
              type="button"
            >
              <User />
            </button>
          )}
          <button
            onClick={onClose}
            className="opencom-close"
            data-testid="widget-close-button"
            type="button"
          >
            <X />
          </button>
        </div>
      </div>

      <ConversationMessageList
        messages={messages}
        aiSettingsEnabled={Boolean(aiSettings?.enabled)}
        isAiMessage={isAiMessage}
        getAiResponseData={getAiResponseData}
        aiResponseFeedback={aiResponseFeedback}
        onAiFeedback={handleAiFeedback}
        onSelectArticle={onSelectArticle}
        showWaitingForHumanSupport={showWaitingForHumanSupport}
        isAiTyping={isAiTyping}
        renderedMessages={renderedMessages}
        messagesEndRef={messagesEndRef}
      />

      <ConversationFooter
        conversationId={conversationId}
        visitorId={visitorId}
        sessionToken={sessionTokenRef.current ?? undefined}
        csatPromptVisible={csatPromptVisible}
        shouldEvaluateCsat={shouldEvaluateCsat}
        onDismissCsatPrompt={dismissCsatPrompt}
        onCsatSubmitted={handleCsatSubmitted}
        isConversationResolved={isConversationResolved}
        automationSettings={automationSettings}
        csatEligibility={csatEligibility}
        showEmailCapture={showEmailCapture}
        emailInput={emailInput}
        onEmailInputChange={setEmailInput}
        onEmailSubmit={handleEmailSubmit}
        onEmailDismiss={handleEmailDismiss}
        officeHoursStatus={officeHoursStatus}
        expectedReplyTime={expectedReplyTime}
        commonIssueButtons={commonIssueButtons}
        hasMessages={Boolean(messages?.length)}
        onSelectArticle={onSelectArticle}
        onApplyConversationStarter={setInputValue}
        showArticleSuggestions={showArticleSuggestions}
        articleSuggestions={articleSuggestions}
        onSelectSuggestionArticle={(id) => {
          onSelectArticle(id as Id<"articles">);
          setShowArticleSuggestions(false);
        }}
        inputValue={inputValue}
        composerError={composerError}
        pendingAttachments={pendingAttachments}
        isUploadingAttachments={isUploadingAttachments}
        onInputChange={(value) => {
          setComposerError(null);
          setInputValue(value);
        }}
        onInputKeyDown={handleKeyDown}
        onSendMessage={sendMessage}
        onUploadAttachments={handleUploadAttachments}
        onRemovePendingAttachment={(attachmentId) => {
          setComposerError(null);
          setPendingAttachments((current) =>
            current.filter((attachment) => attachment.attachmentId !== attachmentId)
          );
        }}
      />
    </div>
  );
}
