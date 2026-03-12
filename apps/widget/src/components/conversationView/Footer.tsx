import type { KeyboardEvent } from "react";
import type { Id } from "@opencom/convex/dataModel";
import { Book, Send } from "../../icons";
import { CsatPrompt } from "../../CsatPrompt";
import type { ArticleSuggestion, ConversationViewProps, CsatEligibility } from "./types";

interface ConversationFooterProps {
  conversationId: ConversationViewProps["conversationId"];
  visitorId: ConversationViewProps["visitorId"];
  sessionToken: string | undefined;
  csatPromptVisible: boolean;
  shouldEvaluateCsat: boolean;
  onDismissCsatPrompt: () => void;
  onCsatSubmitted: () => void;
  isConversationResolved: boolean;
  automationSettings: ConversationViewProps["automationSettings"];
  csatEligibility: CsatEligibility | undefined;
  showEmailCapture: boolean;
  emailInput: string;
  onEmailInputChange: (value: string) => void;
  onEmailSubmit: () => void | Promise<void>;
  onEmailDismiss: () => void;
  officeHoursStatus: ConversationViewProps["officeHoursStatus"];
  expectedReplyTime: string | undefined;
  commonIssueButtons: ConversationViewProps["commonIssueButtons"];
  hasMessages: boolean;
  onSelectArticle: (id: Id<"articles">) => void;
  onApplyConversationStarter: (starter: string) => void;
  showArticleSuggestions: boolean;
  articleSuggestions: ArticleSuggestion[];
  onSelectSuggestionArticle: (id: string) => void;
  inputValue: string;
  onInputChange: (value: string) => void;
  onInputKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onSendMessage: () => void | Promise<void>;
}

export function ConversationFooter({
  conversationId,
  visitorId,
  sessionToken,
  csatPromptVisible,
  shouldEvaluateCsat,
  onDismissCsatPrompt,
  onCsatSubmitted,
  isConversationResolved,
  automationSettings,
  csatEligibility,
  showEmailCapture,
  emailInput,
  onEmailInputChange,
  onEmailSubmit,
  // onEmailDismiss,
  officeHoursStatus,
  expectedReplyTime,
  commonIssueButtons,
  hasMessages,
  onSelectArticle,
  onApplyConversationStarter,
  showArticleSuggestions,
  articleSuggestions,
  onSelectSuggestionArticle,
  inputValue,
  onInputChange,
  onInputKeyDown,
  onSendMessage,
}: ConversationFooterProps) {
  return (
    <div className="opencom-conversation-footer" data-testid="widget-conversation-footer">
      {csatPromptVisible && shouldEvaluateCsat && (
        <CsatPrompt
          conversationId={conversationId}
          visitorId={visitorId}
          sessionToken={sessionToken}
          onClose={onDismissCsatPrompt}
          onSubmitted={onCsatSubmitted}
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
          {automationSettings?.askForRatingEnabled && csatEligibility?.reason === "already_submitted" && (
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
                  onChange={(e) => onEmailInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void onEmailSubmit();
                    }
                  }}
                  placeholder="Enter your email..."
                  className="opencom-email-input"
                />
                <button
                  onClick={() => {
                    void onEmailSubmit();
                  }}
                  className="opencom-email-submit"
                  type="button"
                >
                  Save
                </button>
              </div>
              {/* <button onClick={onEmailDismiss} className="opencom-email-skip" type="button">
                Skip
              </button> */}
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

          {commonIssueButtons && commonIssueButtons.length > 0 && !hasMessages && (
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
                        onApplyConversationStarter(button.conversationStarter);
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
                      onSelectSuggestionArticle(suggestion.id);
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
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Type a message..."
              className="opencom-input"
              data-testid="widget-message-input"
            />
            <button
              onClick={() => {
                void onSendMessage();
              }}
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
  );
}
