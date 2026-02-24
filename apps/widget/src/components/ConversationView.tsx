import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import { ChevronLeft, X, Send, Bot, ThumbsUp, ThumbsDown, User, Book } from "../icons";
import { CsatPrompt } from "../CsatPrompt";
import { formatTime } from "../utils/format";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

interface ConversationViewProps {
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
  const [aiResponseFeedback, setAiResponseFeedback] = useState<
    Record<string, "helpful" | "not_helpful">
  >({});
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [emailCapturedOrDismissed, setEmailCapturedOrDismissed] = useState(() => {
    return sessionStorage.getItem("opencom_email_dismissed") === "true";
  });
  const [emailCapturedThisSession, setEmailCapturedThisSession] = useState(false);
  const [hasVisitorSentMessage, setHasVisitorSentMessage] = useState(false);
  const [lastAgentMessageCount, setLastAgentMessageCount] = useState(0);
  const [emailInput, setEmailInput] = useState("");
  const [showArticleSuggestions, setShowArticleSuggestions] = useState(false);
  const [articleSuggestions, setArticleSuggestions] = useState<
    Array<{ id: string; title: string; snippet: string; score: number }>
  >([]);
  const [, setIsLoadingSuggestions] = useState(false);
  const [csatPromptVisible, setCsatPromptVisible] = useState(false);
  const [dismissedCsatByConversation, setDismissedCsatByConversation] = useState<
    Record<string, true>
  >({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversationKey = conversationId.toString();
  const isConversationResolved = conversationStatus === "closed";
  const shouldEvaluateCsat = isConversationResolved && !!automationSettings?.askForRatingEnabled;

  const debouncedInputValue = useDebouncedValue(inputValue, 300);

  const sendMessageMutation = useMutation(api.messages.send);
  const identifyVisitor = useMutation(api.visitors.identify);
  const generateAiResponse = useAction(api.aiAgentActions.generateResponse);
  const submitAiFeedback = useMutation(api.aiAgent.submitFeedback);
  const handoffToHuman = useMutation(api.aiAgent.handoffToHuman);
  const searchArticleSuggestions = useAction(api.suggestions.searchForWidget);

  const messages = useQuery(
    api.messages.list,
    conversationId
      ? {
          conversationId,
          visitorId: visitorId ?? undefined,
          sessionToken: sessionToken ?? undefined,
        }
      : "skip"
  );
  const persistedVisitorProfile = useQuery(
    api.visitors.getBySession,
    sessionId ? { sessionId } : "skip"
  );
  const isVisitorAlreadyIdentified = Boolean(
    emailCapturedThisSession ||
    userInfo?.email ||
    persistedVisitorProfile?.email ||
    persistedVisitorProfile?.externalUserId
  );
  const agentMessageCount =
    messages?.filter((m: { senderType: string }) => m.senderType !== "visitor").length ?? 0;

  const aiSettings = useQuery(api.aiAgent.getSettings, {
    workspaceId: activeWorkspaceId as Id<"workspaces">,
  });

  const aiResponses = useQuery(
    api.aiAgent.getConversationResponses,
    conversationId
      ? {
          conversationId,
          visitorId: visitorId ?? undefined,
          sessionToken: sessionToken ?? undefined,
        }
      : "skip"
  );

  const csatEligibility = useQuery(
    api.reporting.getCsatEligibility,
    shouldEvaluateCsat
      ? {
          conversationId,
          visitorId: visitorId ?? undefined,
          sessionToken: sessionToken ?? undefined,
        }
      : "skip"
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    if (!hasVisitorSentMessage) return;
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
    hasVisitorSentMessage,
    agentMessageCount,
    emailCapturedOrDismissed,
    lastAgentMessageCount,
    automationSettings?.collectEmailEnabled,
  ]);

  const sendMessage = async () => {
    if (
      !inputValue.trim() ||
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
      await sendMessageMutation({
        conversationId,
        senderId: visitorId,
        senderType: "visitor",
        content,
        visitorId,
        sessionToken: sessionTokenRef.current ?? undefined,
      });
      if (!hasVisitorSentMessage) {
        setHasVisitorSentMessage(true);
      }

      if (aiSettings?.enabled) {
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
        } finally {
          setIsAiTyping(false);
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setInputValue(content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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

  const isAiMessage = (messageId: string) => {
    return aiResponses?.some((r: { messageId: string }) => r.messageId === messageId);
  };

  const getAiResponseData = (messageId: string) => {
    return aiResponses?.find(
      (r: { messageId: string; _id: string; feedback?: string }) => r.messageId === messageId
    );
  };

  const handleAiFeedback = async (responseId: string, feedback: "helpful" | "not_helpful") => {
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
      });
    } catch (error) {
      console.error("Failed to handoff to human:", error);
    }
  };

  const dismissCsatPrompt = () => {
    setCsatPromptVisible(false);
    setDismissedCsatByConversation((prev) => ({ ...prev, [conversationKey]: true }));
  };

  const handleCsatSubmitted = () => {
    setCsatPromptVisible(false);
    setDismissedCsatByConversation((prev) => ({ ...prev, [conversationKey]: true }));
  };

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

      <div className="opencom-messages" data-testid="widget-message-list">
        {!messages || messages.length === 0 ? (
          <div className="opencom-message opencom-message-agent opencom-message-animated">
            {aiSettings?.enabled ? (
              <>
                <span className="opencom-ai-badge">
                  <Bot /> AI
                </span>
                Hi! I&apos;m an AI assistant. How can I help you today?
              </>
            ) : (
              "Hi! How can we help you today?"
            )}
          </div>
        ) : (
          messages.map(
            (
              msg: {
                _id: string;
                _creationTime: number;
                senderType: string;
                content: string;
                senderName?: string;
              },
              index: number
            ) => {
              const showTimestamp =
                index === 0 ||
                (messages[index - 1] &&
                  msg._creationTime - messages[index - 1]._creationTime > 5 * 60 * 1000);
              const isAi = isAiMessage(msg._id);
              const aiData = isAi ? getAiResponseData(msg._id) : null;
              const feedbackGiven = aiData
                ? aiResponseFeedback[aiData._id] || aiData.feedback
                : null;

              return (
                <div key={msg._id} className="opencom-message-wrapper">
                  {showTimestamp && (
                    <div className="opencom-message-timestamp">{formatTime(msg._creationTime)}</div>
                  )}
                  <div
                    className={`opencom-message opencom-message-${
                      msg.senderType === "visitor" ? "user" : "agent"
                    } ${isAi ? "opencom-message-ai" : ""} opencom-message-animated`}
                    title={new Date(msg._creationTime).toLocaleString()}
                  >
                    {isAi && (
                      <span className="opencom-ai-badge">
                        <Bot /> AI
                      </span>
                    )}
                    {msg.content}
                    {isAi && aiData && (
                      <div className="opencom-ai-feedback">
                        {aiData.sources && aiData.sources.length > 0 && (
                          <div className="opencom-ai-sources">
                            Sources:{" "}
                            {aiData.sources
                              .map((s: { type: string; id: string; title: string }) => s.title)
                              .join(", ")}
                          </div>
                        )}
                        {!feedbackGiven ? (
                          <div className="opencom-ai-feedback-buttons">
                            <span>Was this helpful?</span>
                            <button
                              onClick={() => handleAiFeedback(aiData._id, "helpful")}
                              className="opencom-feedback-btn opencom-feedback-helpful"
                              title="Helpful"
                              type="button"
                            >
                              <ThumbsUp />
                            </button>
                            <button
                              onClick={() => handleAiFeedback(aiData._id, "not_helpful")}
                              className="opencom-feedback-btn opencom-feedback-not-helpful"
                              title="Not helpful"
                              type="button"
                            >
                              <ThumbsDown />
                            </button>
                          </div>
                        ) : (
                          <div className="opencom-ai-feedback-given">
                            {feedbackGiven === "helpful"
                              ? "Thanks for your feedback!"
                              : "Sorry to hear that. A human agent will follow up."}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }
          )
        )}
        {isAiTyping && (
          <div className="opencom-message opencom-message-agent opencom-message-ai opencom-typing">
            <span className="opencom-ai-badge">
              <Bot /> AI
            </span>
            <span className="opencom-typing-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </div>
        )}
        <div className="opencom-typing-indicator-area" />
        <div ref={messagesEndRef} />
      </div>

      <div className="opencom-conversation-footer" data-testid="widget-conversation-footer">
        {csatPromptVisible && shouldEvaluateCsat && (
          <CsatPrompt
            conversationId={conversationId}
            visitorId={visitorId}
            sessionToken={sessionTokenRef.current ?? undefined}
            onClose={dismissCsatPrompt}
            onSubmitted={handleCsatSubmitted}
          />
        )}

        {isConversationResolved ? (
          <div className="opencom-conversation-status" data-testid="widget-conversation-status">
            <p className="opencom-conversation-status-title">This conversation is resolved.</p>
            {!automationSettings?.askForRatingEnabled && (
              <p className="opencom-conversation-status-body">
                Rating prompts are disabled for this workspace.
              </p>
            )}
            {automationSettings?.askForRatingEnabled &&
              csatEligibility?.reason === "already_submitted" && (
                <p className="opencom-conversation-status-body">
                  Thanks, your rating has already been recorded.
                </p>
              )}
            {automationSettings?.askForRatingEnabled &&
              csatEligibility?.reason !== "already_submitted" &&
              !csatPromptVisible && (
                <p className="opencom-conversation-status-body">
                  You can open a new conversation from the Messages tab if you still need help.
                </p>
              )}
          </div>
        ) : (
          <>
            {showEmailCapture && (
              <div className="opencom-email-capture">
                <p>Get notified when we reply:</p>
                <div className="opencom-email-input-row">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleEmailSubmit();
                      }
                    }}
                    placeholder="Enter your email..."
                    className="opencom-email-input"
                  />
                  <button
                    onClick={handleEmailSubmit}
                    className="opencom-email-submit"
                    type="button"
                  >
                    Save
                  </button>
                </div>
                <button onClick={handleEmailDismiss} className="opencom-email-skip" type="button">
                  Skip
                </button>
              </div>
            )}

            {automationSettings?.showReplyTimeEnabled && officeHoursStatus && (
              <div className="opencom-reply-time">
                {officeHoursStatus.isOpen ? (
                  expectedReplyTime && <span>Typically replies in {expectedReplyTime}</span>
                ) : (
                  <span>{officeHoursStatus.offlineMessage || "We're currently offline"}</span>
                )}
              </div>
            )}

            {commonIssueButtons && commonIssueButtons.length > 0 && !messages?.length && (
              <div className="opencom-common-issues">
                <p className="opencom-common-issues-label">Common questions:</p>
                <div className="opencom-common-issues-grid">
                  {commonIssueButtons.map((button) => (
                    <button
                      key={button._id}
                      className="opencom-common-issue-btn"
                      onClick={() => {
                        if (button.action === "article" && button.articleId) {
                          onSelectArticle(button.articleId);
                        } else if (
                          button.action === "start_conversation" &&
                          button.conversationStarter
                        ) {
                          setInputValue(button.conversationStarter);
                        }
                      }}
                      type="button"
                    >
                      {button.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showArticleSuggestions && articleSuggestions.length > 0 && (
              <div className="opencom-article-suggestions">
                <p className="opencom-suggestions-label">
                  <Book /> Suggested articles:
                </p>
                <div className="opencom-suggestions-list">
                  {articleSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      className="opencom-suggestion-item"
                      onClick={() => {
                        onSelectArticle(suggestion.id as Id<"articles">);
                        setShowArticleSuggestions(false);
                      }}
                      type="button"
                    >
                      <span className="opencom-suggestion-title">{suggestion.title}</span>
                      <span className="opencom-suggestion-snippet">{suggestion.snippet}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="opencom-input-container" data-testid="widget-chat-controls">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="opencom-input"
                data-testid="widget-message-input"
              />
              <button
                onClick={sendMessage}
                className="opencom-send"
                data-testid="widget-send-button"
                type="button"
                disabled={!inputValue.trim()}
              >
                <Send />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
