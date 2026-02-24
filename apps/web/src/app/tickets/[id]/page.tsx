"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { Button, Card, Input } from "@opencom/ui";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  Send,
  Lock,
  Unlock,
  MessageSquare,
} from "lucide-react";
import type { Id } from "@opencom/convex/dataModel";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { formatVisitorIdentityLabel } from "@/lib/visitorIdentity";
import Link from "next/link";
import { useParams } from "next/navigation";

type TicketStatus = "submitted" | "in_progress" | "waiting_on_customer" | "resolved";
type TicketPriority = "low" | "normal" | "high" | "urgent";

const statusConfig: Record<
  TicketStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  submitted: { label: "Submitted", color: "bg-primary/10 text-primary", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-yellow-100 text-yellow-700", icon: AlertCircle },
  waiting_on_customer: {
    label: "Waiting on Customer",
    color: "bg-purple-100 text-purple-700",
    icon: User,
  },
  resolved: { label: "Resolved", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
};

const priorityConfig: Record<TicketPriority, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-gray-100 text-gray-600" },
  normal: { label: "Normal", color: "bg-primary/10 text-primary" },
  high: { label: "High", color: "bg-orange-100 text-orange-600" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-600" },
};

function TicketDetailContent(): React.JSX.Element | null {
  const { user, activeWorkspace } = useAuth();
  const params = useParams();
  const ticketId = params.id as Id<"tickets">;

  const [commentContent, setCommentContent] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState("");

  const ticketResult = useQuery(api.tickets.getForAdminView, ticketId ? { id: ticketId } : "skip");

  const workspaceUsers = useQuery(
    api.workspaceMembers.listByWorkspace,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const updateTicket = useMutation(api.tickets.update);
  const addComment = useMutation(api.tickets.addComment);
  const resolveTicket = useMutation(api.tickets.resolve);

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!ticketId) return;
    try {
      await updateTicket({ id: ticketId, status: newStatus });
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handlePriorityChange = async (newPriority: TicketPriority) => {
    if (!ticketId) return;
    try {
      await updateTicket({ id: ticketId, priority: newPriority });
    } catch (error) {
      console.error("Failed to update priority:", error);
    }
  };

  const handleAssigneeChange = async (assigneeId: string) => {
    if (!ticketId) return;
    try {
      await updateTicket({
        id: ticketId,
        assigneeId: assigneeId ? (assigneeId as Id<"users">) : undefined,
      });
    } catch (error) {
      console.error("Failed to update assignee:", error);
    }
  };

  const handleAddComment = async () => {
    if (!ticketId || !user || !commentContent.trim()) return;
    try {
      await addComment({
        ticketId,
        authorId: user._id,
        authorType: "agent",
        content: commentContent.trim(),
        isInternal,
      });
      setCommentContent("");
    } catch (error) {
      console.error("Failed to add comment:", error);
    }
  };

  const handleResolve = async () => {
    if (!ticketId) return;
    try {
      await resolveTicket({
        id: ticketId,
        resolutionSummary: resolutionSummary.trim() || undefined,
      });
      setShowResolveModal(false);
      setResolutionSummary("");
    } catch (error) {
      console.error("Failed to resolve ticket:", error);
    }
  };

  if (!user || !activeWorkspace) {
    return null;
  }

  if (ticketResult === undefined) {
    return (
      <div className="h-full p-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/tickets">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Loading...</h1>
        </div>
      </div>
    );
  }

  if (ticketResult.status !== "ok" || !ticketResult.ticket) {
    let title = "Ticket not found";
    let message = "This ticket could not be loaded.";
    if (ticketResult.status === "unauthenticated") {
      title = "Sign in required";
      message = "Authenticate to view ticket details.";
    } else if (ticketResult.status === "forbidden") {
      title = "Permission denied";
      message = "Your account does not have permission to access this ticket.";
    }

    return (
      <div className="h-full p-6" data-testid="tickets-detail-error-state">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/tickets">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
        <Card className="p-6">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground mt-1">{message}</p>
        </Card>
      </div>
    );
  }

  const ticket = ticketResult.ticket;
  const visitorIdentityLabel = formatVisitorIdentityLabel({
    visitorId: ticket.visitorId,
    readableId: ticket.visitor?.readableId,
    name: ticket.visitor?.name,
    email: ticket.visitor?.email,
  });

  const status = statusConfig[ticket.status as TicketStatus];
  const priority = priorityConfig[ticket.priority as TicketPriority];
  const StatusIcon = status.icon;

  return (
    <div className="h-full p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/tickets">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="ticket-detail-heading">
            {ticket.subject}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${status.color}`}
            >
              <StatusIcon className="h-3 w-3" />
              {status.label}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${priority.color}`}>
              {priority.label}
            </span>
          </div>
        </div>
        {ticket.status !== "resolved" && (
          <Button onClick={() => setShowResolveModal(true)}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Resolve
          </Button>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Content - Timeline */}
        <div className="col-span-8">
          <Card className="p-4">
            <h2 className="font-semibold mb-4">Timeline</h2>

            {/* Description */}
            {ticket.description && (
              <div className="mb-4 p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p>{ticket.description}</p>
              </div>
            )}

            {/* Comments */}
            <div className="space-y-4 mb-6">
              {ticket.comments?.map(
                (comment: NonNullable<NonNullable<typeof ticket>["comments"]>[number]) => (
                  <div
                    key={comment._id}
                    className={`p-3 rounded-lg ${
                      comment.isInternal
                        ? "bg-yellow-50 border border-yellow-200"
                        : comment.authorType === "visitor"
                          ? "bg-muted"
                          : "bg-primary/5"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {comment.isInternal && <Lock className="h-3 w-3 text-yellow-600" />}
                      <span className="text-sm font-medium">
                        {comment.authorType === "visitor"
                          ? visitorIdentityLabel
                          : comment.authorType === "system"
                            ? "System"
                            : "Agent"}
                      </span>
                      {comment.isInternal && (
                        <span className="text-xs text-yellow-600">(Internal Note)</span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm">{comment.content}</p>
                  </div>
                )
              )}

              {(!ticket.comments || ticket.comments.length === 0) && !ticket.description && (
                <p className="text-muted-foreground text-center py-4">No activity yet</p>
              )}
            </div>

            {/* Add Comment */}
            {ticket.status !== "resolved" && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setIsInternal(false)}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                      !isInternal ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    <Unlock className="h-3 w-3" />
                    Reply
                  </button>
                  <button
                    onClick={() => setIsInternal(true)}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                      isInternal ? "bg-yellow-500 text-white" : "bg-muted"
                    }`}
                  >
                    <Lock className="h-3 w-3" />
                    Internal Note
                  </button>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    placeholder={isInternal ? "Add internal note..." : "Reply to customer..."}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                  />
                  <Button onClick={handleAddComment} disabled={!commentContent.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                {isInternal && (
                  <p className="text-xs text-yellow-600 mt-1">
                    Internal notes are only visible to agents
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar - Details */}
        <div className="col-span-4 space-y-4">
          {/* Customer Info */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Customer</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{visitorIdentityLabel}</span>
              </div>
              {ticket.visitor?.email && (
                <div className="text-muted-foreground">{ticket.visitor.email}</div>
              )}
              {ticket.conversation && (
                <Link
                  href={`/inbox?conversation=${ticket.conversationId}`}
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <MessageSquare className="h-3 w-3" />
                  View Conversation
                </Link>
              )}
            </div>
          </Card>

          {/* Ticket Details */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Details</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <select
                  value={ticket.status}
                  onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                  className="w-full border rounded-md px-2 py-1 text-sm mt-1"
                  disabled={ticket.status === "resolved"}
                >
                  <option value="submitted">Submitted</option>
                  <option value="in_progress">In Progress</option>
                  <option value="waiting_on_customer">Waiting on Customer</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Priority</label>
                <select
                  value={ticket.priority}
                  onChange={(e) => handlePriorityChange(e.target.value as TicketPriority)}
                  className="w-full border rounded-md px-2 py-1 text-sm mt-1"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Assignee</label>
                <select
                  value={ticket.assigneeId || ""}
                  onChange={(e) => handleAssigneeChange(e.target.value)}
                  className="w-full border rounded-md px-2 py-1 text-sm mt-1"
                >
                  <option value="">Unassigned</option>
                  {workspaceUsers?.map((member: NonNullable<typeof workspaceUsers>[number]) => (
                    <option key={member._id} value={member.userId}>
                      {member.name || member.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
                <div>Created: {new Date(ticket.createdAt).toLocaleString()}</div>
                <div>Updated: {new Date(ticket.updatedAt).toLocaleString()}</div>
                {ticket.resolvedAt && (
                  <div>Resolved: {new Date(ticket.resolvedAt).toLocaleString()}</div>
                )}
              </div>
            </div>
          </Card>

          {/* Resolution Summary */}
          {ticket.resolutionSummary && (
            <Card className="p-4 bg-green-50">
              <h3 className="font-semibold mb-2 text-green-700">Resolution</h3>
              <p className="text-sm">{ticket.resolutionSummary}</p>
            </Card>
          )}
        </div>
      </div>

      {/* Resolve Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Resolve Ticket</h2>
            <div>
              <label className="block text-sm font-medium mb-1">
                Resolution Summary (optional)
              </label>
              <textarea
                value={resolutionSummary}
                onChange={(e) => setResolutionSummary(e.target.value)}
                placeholder="Describe how the issue was resolved..."
                className="w-full border rounded-md px-3 py-2 text-sm min-h-[100px]"
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowResolveModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleResolve}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Resolve Ticket
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function TicketDetailPage(): React.JSX.Element {
  return (
    <AppLayout>
      <TicketDetailContent />
    </AppLayout>
  );
}
