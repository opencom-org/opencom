import { useState } from "react";
import { ChevronLeft, X, Send } from "../icons";
import { formatTime } from "../utils/format";

interface Comment {
  _id: string;
  authorType: string;
  content: string;
  createdAt: number;
  isInternal: boolean;
}

interface TicketData {
  subject: string;
  status: string;
  description?: string;
  resolutionSummary?: string;
  comments?: Comment[];
}

interface TicketDetailProps {
  ticket: TicketData | undefined;
  onBack: () => void;
  onClose: () => void;
  onAddComment: (content: string) => Promise<void>;
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

export function TicketDetail({ ticket, onBack, onClose, onAddComment }: TicketDetailProps) {
  const [commentInput, setCommentInput] = useState("");

  const handleSubmitComment = async () => {
    if (!commentInput.trim()) return;
    await onAddComment(commentInput.trim());
    setCommentInput("");
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
          <div className="opencom-ticket-detail-header">
            <h3 className="opencom-ticket-detail-subject">{ticket.subject}</h3>
            <span className={`opencom-ticket-status ${getTicketStatusClass(ticket.status)}`}>
              {getTicketStatusLabel(ticket.status)}
            </span>
          </div>

          {ticket.description && (
            <div className="opencom-ticket-description">{ticket.description}</div>
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
                  <div className="opencom-ticket-comment-content">{comment.content}</div>
                  <div className="opencom-ticket-comment-time">{formatTime(comment.createdAt)}</div>
                </div>
              ))}
          </div>

          {ticket.status !== "resolved" && (
            <div className="opencom-ticket-reply">
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
              />
              <button onClick={handleSubmitComment} className="opencom-ticket-reply-send">
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
