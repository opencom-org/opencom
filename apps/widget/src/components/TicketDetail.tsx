import { useRef, useState } from "react";
import type { Id } from "@opencom/convex/dataModel";
import {
  SUPPORT_ATTACHMENT_ACCEPT,
  formatSupportAttachmentSize,
  type ErrorFeedbackMessage,
  type StagedSupportAttachment,
  type SupportAttachmentDescriptor,
} from "@opencom/web-shared";
import { ChevronLeft, Paperclip, X, Send } from "../icons";
import { formatTime } from "../utils/format";

interface Comment {
  _id: string;
  authorType: string;
  content: string;
  createdAt: number;
  isInternal: boolean;
  attachments?: SupportAttachmentDescriptor[];
}

interface TicketData {
  subject: string;
  status: string;
  description?: string;
  resolutionSummary?: string;
  attachments?: SupportAttachmentDescriptor[];
  comments?: Comment[];
}

interface TicketDetailProps {
  ticket: TicketData | undefined;
  onBack: () => void;
  onClose: () => void;
  onAddComment: (content: string) => Promise<void>;
  onUploadAttachments: (files: File[]) => Promise<void> | void;
  onRemoveAttachment: (attachmentId: Id<"supportAttachments">) => void;
  pendingAttachments: StagedSupportAttachment<Id<"supportAttachments">>[];
  isUploadingAttachments: boolean;
  errorFeedback: ErrorFeedbackMessage | null;
}

function getTicketStatusLabel(status: string): string {
  switch (status) {
    case "submitted":
      return "Submitted";
    case "in_progress":
      return "In Progress";
    case "waiting_on_customer":
      return "Waiting on You";
    case "resolved":
      return "Resolved";
    default:
      return status;
  }
}

function getTicketStatusClass(status: string): string {
  switch (status) {
    case "submitted":
      return "opencom-ticket-status-submitted";
    case "in_progress":
      return "opencom-ticket-status-progress";
    case "waiting_on_customer":
      return "opencom-ticket-status-waiting";
    case "resolved":
      return "opencom-ticket-status-resolved";
    default:
      return "";
  }
}

function renderAttachmentRow(attachment: SupportAttachmentDescriptor) {
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

export function TicketDetail({
  ticket,
  onBack,
  onClose,
  onAddComment,
  onUploadAttachments,
  onRemoveAttachment,
  pendingAttachments,
  isUploadingAttachments,
  errorFeedback,
}: TicketDetailProps) {
  const [commentInput, setCommentInput] = useState("");
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmitComment = async () => {
    if (!commentInput.trim() && pendingAttachments.length === 0) return;
    try {
      await onAddComment(commentInput.trim());
      setCommentInput("");
    } catch {
      // Error feedback is rendered by the parent flow.
    }
  };

  return (
    <div className="opencom-chat">
      <div className="opencom-header">
        <button onClick={onBack} className="opencom-back">
          <ChevronLeft />
        </button>
        <span>Ticket Details</span>
        <div className="opencom-header-actions">
          <button onClick={onClose} className="opencom-close">
            <X />
          </button>
        </div>
      </div>
      {ticket ? (
        <div className="opencom-ticket-detail">
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
          <div className="opencom-ticket-detail-header">
            <h3 className="opencom-ticket-detail-subject">{ticket.subject}</h3>
            <span className={`opencom-ticket-status ${getTicketStatusClass(ticket.status)}`}>
              {getTicketStatusLabel(ticket.status)}
            </span>
          </div>

          {ticket.description && (
            <div className="opencom-ticket-description">
              {ticket.description}
            </div>
          )}

          {ticket.attachments && ticket.attachments.length > 0 && (
            <div className="opencom-ticket-attachments">
              <span className="opencom-ticket-form-label">Attachments</span>
              <div className="opencom-message-attachments">
                {ticket.attachments.map((attachment) => renderAttachmentRow(attachment))}
              </div>
            </div>
          )}

          <div className="opencom-ticket-timeline">
            {ticket.comments
              ?.filter((c) => !c.isInternal)
              .map((comment) => (
                <div
                  key={comment._id}
                  className={`opencom-ticket-comment ${comment.authorType === "visitor" ? "opencom-ticket-comment-visitor" : "opencom-ticket-comment-agent"}`}
                >
                  <div className="opencom-ticket-comment-author">
                    {comment.authorType === "visitor"
                      ? "You"
                      : comment.authorType === "system"
                        ? "System"
                        : "Support"}
                  </div>
                  {comment.content.trim().length > 0 && (
                    <div className="opencom-ticket-comment-content">{comment.content}</div>
                  )}
                  {comment.attachments && comment.attachments.length > 0 && (
                    <div className="opencom-message-attachments">
                      {comment.attachments.map((attachment) => renderAttachmentRow(attachment))}
                    </div>
                  )}
                  <div className="opencom-ticket-comment-time">{formatTime(comment.createdAt)}</div>
                </div>
              ))}
          </div>

          {ticket.status !== "resolved" && (
            <div className="opencom-ticket-reply">
              {errorFeedback && (
                <div className="opencom-ticket-error">{errorFeedback.message}</div>
              )}
              <div className="opencom-ticket-reply-actions">
                <button
                  type="button"
                  className="opencom-ticket-attach-btn"
                  onClick={() => attachmentInputRef.current?.click()}
                  disabled={isUploadingAttachments}
                >
                  <Paperclip />
                  <span>{isUploadingAttachments ? "Uploading..." : "Attach files"}</span>
                </button>
              </div>
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
                        onClick={() => onRemoveAttachment(attachment.attachmentId)}
                        aria-label={`Remove ${attachment.fileName}`}
                      >
                        <X />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitComment();
                  }
                }}
                placeholder="Add a reply..."
                className="opencom-ticket-reply-input"
                disabled={isUploadingAttachments}
              />
              <button
                onClick={handleSubmitComment}
                className="opencom-ticket-reply-send"
                disabled={isUploadingAttachments || (!commentInput.trim() && pendingAttachments.length === 0)}
              >
                <Send />
              </button>
            </div>
          )}

          {ticket.status === "resolved" && ticket.resolutionSummary && (
            <div className="opencom-ticket-resolution">
              <strong>Resolution:</strong> {ticket.resolutionSummary}
            </div>
          )}
        </div>
      ) : (
        <div className="opencom-ticket-loading">Loading ticket...</div>
      )}
    </div>
  );
}
