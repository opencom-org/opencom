import { useRef, type KeyboardEvent } from "react";
import type { Id } from "@opencom/convex/dataModel";
import {
  SUPPORT_ATTACHMENT_ACCEPT,
  formatSupportAttachmentSize,
  type StagedSupportAttachment,
} from "@opencom/web-shared";
import { Book, Paperclip, Send, X } from "../../icons";
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
  composerError?: string | null;
  pendingAttachments: StagedSupportAttachment<Id<"supportAttachments">>[];
  isUploadingAttachments: boolean;
  onInputChange: (value: string) => void;
  onInputKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onSendMessage: () => void | Promise<void>;
  onUploadAttachments: (files: File[]) => void | Promise<void>;
  onRemovePendingAttachment: (attachmentId: Id<"supportAttachments">) => void;
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
  composerError,
  pendingAttachments,
  isUploadingAttachments,
  onInputChange,
  onInputKeyDown,
  onSendMessage,
  onUploadAttachments,
  onRemovePendingAttachment,
}: ConversationFooterProps) {
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const canSendMessage = inputValue.trim().length > 0 || pendingAttachments.length > 0;

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
            {composerError && <div className="opencom-ticket-error">{composerError}</div>}
            <input
              ref={attachmentInputRef}
              type="file"
              multiple
              accept={SUPPORT_ATTACHMENT_ACCEPT}
              className="opencom-visually-hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length > 0) {
                  void onUploadAttachments(files);
                }
                event.target.value = "";
              }}
            />
            {pendingAttachments.length > 0 && (
              <div className="opencom-pending-attachments">
                {pendingAttachments.map((attachment) => (
                  <div key={attachment.attachmentId} className="opencom-pending-attachment">
                    <span className="opencom-pending-attachment-name">
                      <Paperclip />
                      {attachment.fileName}
                    </span>
                    <span className="opencom-pending-attachment-size">
                      {formatSupportAttachmentSize(attachment.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemovePendingAttachment(attachment.attachmentId)}
                      aria-label={`Remove ${attachment.fileName}`}
                    >
                      <X />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="opencom-composer-row">
              <button
                type="button"
                className="opencom-attach"
                onClick={() => attachmentInputRef.current?.click()}
                disabled={isUploadingAttachments}
                aria-label="Attach files"
              >
                <Paperclip />
              </button>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Type a message..."
                className="opencom-input"
                data-testid="widget-message-input"
                disabled={isUploadingAttachments}
              />
              <button
                onClick={() => {
                  void onSendMessage();
                }}
                className="opencom-send"
                data-testid="widget-send-button"
                type="button"
                disabled={!canSendMessage || isUploadingAttachments}
              >
                <Send />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
