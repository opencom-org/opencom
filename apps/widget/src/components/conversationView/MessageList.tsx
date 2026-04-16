import type { RefObject } from "react";
import type { Id } from "@opencom/convex/dataModel";
import { formatSupportAttachmentSize, resolveArticleSourceId } from "@opencom/web-shared";
import { Bot, Paperclip, ThumbsUp, ThumbsDown, User } from "../../icons";
import { formatTime } from "../../utils/format";
import { resolveHumanAgentName } from "./helpers";
import type { AiFeedback, AiResponseData, ConversationMessage } from "./types";

interface ConversationMessageListProps {
  messages: ConversationMessage[] | undefined;
  aiSettingsEnabled: boolean;
  isAiMessage: (message: ConversationMessage) => boolean;
  getAiResponseData: (messageId: string) => AiResponseData | undefined;
  aiResponseFeedback: Record<string, AiFeedback>;
  onAiFeedback: (responseId: string, feedback: AiFeedback) => void | Promise<void>;
  onSelectArticle: (id: Id<"articles">) => void;
  showWaitingForHumanSupport: boolean;
  isAiTyping: boolean;
  renderedMessages: Map<string, string>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

function renderAttachmentRow(attachment: NonNullable<ConversationMessage["attachments"]>[number]) {
  const content = (
    <>
      <span className="opencom-message-attachment-name">
        <Paperclip />
        {attachment.fileName}
      </span>
      <span className="opencom-message-attachment-size">
        {formatSupportAttachmentSize(attachment.size)}
      </span>
    </>
  );

  if (attachment.url) {
    return (
      <a
        key={attachment._id}
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className="opencom-message-attachment"
      >
        {content}
      </a>
    );
  }

  return (
    <div
      key={attachment._id}
      aria-disabled="true"
      className="opencom-message-attachment opencom-message-attachment-disabled"
    >
      {content}
    </div>
  );
}

export function ConversationMessageList({
  messages,
  aiSettingsEnabled,
  isAiMessage,
  getAiResponseData,
  aiResponseFeedback,
  onAiFeedback,
  onSelectArticle,
  showWaitingForHumanSupport,
  isAiTyping,
  renderedMessages,
  messagesEndRef,
}: ConversationMessageListProps) {
  const handleMessageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!target) {
      return;
    }
    const element = target instanceof Element ? target : (target as Text).parentElement;
    if (!element) {
      return;
    }
    const articleLink = element.closest("[data-article-id]");
    if (articleLink) {
      event.preventDefault();
      event.stopPropagation();
      const articleId = articleLink.getAttribute("data-article-id");
      if (articleId) {
        onSelectArticle(articleId as Id<"articles">);
      }
    }
  };

  return (
    <div className="opencom-messages" data-testid="widget-message-list">
      {!messages || messages.length === 0 ? (
        <div className="opencom-message opencom-message-agent opencom-message-animated">
          {aiSettingsEnabled ? (
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
        messages.map((msg, index) => {
          const showTimestamp =
            index === 0 ||
            (messages[index - 1] &&
              msg._creationTime - messages[index - 1]._creationTime > 5 * 60 * 1000);
          const isAi = isAiMessage(msg);
          const isHumanAgent = (msg.senderType === "agent" || msg.senderType === "user") && !isAi;
          const humanAgentName = isHumanAgent ? resolveHumanAgentName(msg.senderName) : null;
          const aiData = isAi ? getAiResponseData(msg._id) : null;
          const feedbackGiven = aiData
            ? aiResponseFeedback[aiData._id] || aiData.feedback || null
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
                {isHumanAgent && (
                  <span
                    className="opencom-human-badge"
                    data-testid={`widget-human-agent-badge-${msg._id}`}
                  >
                    <User /> {humanAgentName}
                  </span>
                )}
                {msg.content.trim().length > 0 && (
                  <div
                    className="opencom-message-content"
                    dangerouslySetInnerHTML={{
                      __html: renderedMessages.get(msg._id) ?? "",
                    }}
                    onClick={handleMessageClick}
                  />
                )}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="opencom-message-attachments">
                    {msg.attachments.map((attachment) => renderAttachmentRow(attachment))}
                  </div>
                )}
                {isAi && aiData && (
                  <div className="opencom-ai-feedback">
                    {aiData.sources && aiData.sources.length > 0 && (
                      <div className="opencom-ai-sources">
                        <span>Sources:</span>
                        <ul className="opencom-ai-source-list">
                          {aiData.sources.map((source, sourceIndex) => {
                            const articleSourceId = resolveArticleSourceId(source);
                            return (
                              <li
                                key={`${aiData._id}-${source.id}-${sourceIndex}`}
                                className="opencom-ai-source-item"
                              >
                                {articleSourceId ? (
                                  <button
                                    type="button"
                                    className="opencom-ai-source-link"
                                    data-testid={`widget-ai-source-link-${aiData._id}-${sourceIndex}`}
                                    onClick={() =>
                                      onSelectArticle(articleSourceId as Id<"articles">)
                                    }
                                  >
                                    {source.title}
                                  </button>
                                ) : (
                                  <span
                                    className="opencom-ai-source-text"
                                    data-testid={`widget-ai-source-text-${aiData._id}-${sourceIndex}`}
                                  >
                                    {source.title}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    {!feedbackGiven ? (
                      <div className="opencom-ai-feedback-buttons">
                        <span>Was this helpful?</span>
                        <button
                          onClick={() => {
                            void onAiFeedback(aiData._id, "helpful");
                          }}
                          className="opencom-feedback-btn opencom-feedback-helpful"
                          title="Helpful"
                          type="button"
                        >
                          <ThumbsUp />
                        </button>
                        <button
                          onClick={() => {
                            void onAiFeedback(aiData._id, "not_helpful");
                          }}
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
        })
      )}
      {showWaitingForHumanSupport && (
        <div className="opencom-status-divider" data-testid="widget-waiting-human-divider">
          Waiting for human support
        </div>
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
  );
}
