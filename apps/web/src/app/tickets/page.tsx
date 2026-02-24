"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { Button, Card, Input } from "@opencom/ui";
import {
  Ticket,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  MessageSquare,
  FileText,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout, AppPageShell } from "@/components/AppLayout";
import { formatVisitorIdentityLabel } from "@/lib/visitorIdentity";
import Link from "next/link";
import type { Id } from "@opencom/convex/dataModel";

type TicketStatus = "submitted" | "in_progress" | "waiting_on_customer" | "resolved";
type TicketPriority = "low" | "normal" | "high" | "urgent";

const statusConfig: Record<
  TicketStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  submitted: { label: "Submitted", color: "bg-primary/10 text-primary", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-yellow-100 text-yellow-700", icon: AlertCircle },
  waiting_on_customer: { label: "Waiting", color: "bg-purple-100 text-purple-700", icon: User },
  resolved: { label: "Resolved", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
};

const priorityConfig: Record<TicketPriority, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-gray-100 text-gray-600" },
  normal: { label: "Normal", color: "bg-primary/10 text-primary" },
  high: { label: "High", color: "bg-orange-100 text-orange-600" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-600" },
};

function TicketsContent(): React.JSX.Element | null {
  const { user, activeWorkspace } = useAuth();
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketDescription, setNewTicketDescription] = useState("");
  const [newTicketPriority, setNewTicketPriority] = useState<TicketPriority>("normal");
  const [selectedVisitorId, setSelectedVisitorId] = useState<Id<"visitors"> | null>(null);
  const [visitorSearchQuery, setVisitorSearchQuery] = useState("");

  const visitors = useQuery(
    api.visitors.search,
    activeWorkspace?._id && visitorSearchQuery.length >= 2
      ? { workspaceId: activeWorkspace._id, query: visitorSearchQuery, limit: 10 }
      : "skip"
  );

  const recentVisitors = useQuery(
    api.visitors.list,
    activeWorkspace?._id && !visitorSearchQuery
      ? { workspaceId: activeWorkspace._id, limit: 10 }
      : "skip"
  );

  const tickets = useQuery(
    api.tickets.listForAdminView,
    activeWorkspace?._id
      ? {
          workspaceId: activeWorkspace._id,
          ...(statusFilter !== "all" && { status: statusFilter }),
        }
      : "skip"
  );

  const createTicket = useMutation(api.tickets.create);

  const handleCreateTicket = async () => {
    if (!activeWorkspace?._id || !newTicketSubject.trim()) return;

    try {
      await createTicket({
        workspaceId: activeWorkspace._id,
        subject: newTicketSubject.trim(),
        description: newTicketDescription.trim() || undefined,
        priority: newTicketPriority,
        visitorId: selectedVisitorId || undefined,
      });
      setShowCreateModal(false);
      setNewTicketSubject("");
      setNewTicketDescription("");
      setNewTicketPriority("normal");
      setSelectedVisitorId(null);
      setVisitorSearchQuery("");
    } catch (error) {
      console.error("Failed to create ticket:", error);
    }
  };

  const isTicketsLoading = tickets === undefined;
  const isPermissionDenied = tickets?.status === "forbidden";
  const isUnauthenticated = tickets?.status === "unauthenticated";
  const availableTickets = tickets?.status === "ok" ? tickets.tickets : [];

  const filteredTickets = availableTickets.filter((ticket) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      ticket.subject.toLowerCase().includes(query) ||
      ticket.description?.toLowerCase().includes(query) ||
      ticket.visitor?.name?.toLowerCase().includes(query) ||
      ticket.visitor?.email?.toLowerCase().includes(query)
    );
  });

  const selectedVisitor = (visitors || recentVisitors)?.find(
    (visitor: { _id: Id<"visitors">; name?: string; email?: string }) =>
      visitor._id === selectedVisitorId
  );

  if (!user || !activeWorkspace) {
    return null;
  }

  return (
    <AppPageShell className="h-full overflow-y-auto" data-testid="tickets-responsive-shell">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="tickets-page-heading">
            Tickets
          </h1>
          <p className="text-muted-foreground">Manage customer support tickets</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/tickets/forms">
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Manage Forms
            </Button>
          </Link>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tickets..."
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TicketStatus | "all")}
            className="border rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="submitted">Submitted</option>
            <option value="in_progress">In Progress</option>
            <option value="waiting_on_customer">Waiting on Customer</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Tickets List */}
      <Card>
        {isTicketsLoading ? (
          <div
            className="p-8 text-center text-muted-foreground"
            data-testid="tickets-loading-state"
          >
            <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Loading tickets...</p>
          </div>
        ) : isUnauthenticated ? (
          <div className="p-8 text-center" data-testid="tickets-error-state">
            <p className="text-lg font-medium">Sign in required</p>
            <p className="text-sm text-muted-foreground mt-1">Authenticate to access tickets.</p>
          </div>
        ) : isPermissionDenied ? (
          <div className="p-8 text-center" data-testid="tickets-error-state">
            <p className="text-lg font-medium">Permission denied</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your account does not have permission to read tickets.
            </p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No tickets found</p>
            <p className="text-sm">
              {statusFilter !== "all"
                ? "Try changing the filter or create a new ticket"
                : "Create your first ticket to get started"}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredTickets.map((ticket) => {
              const status = statusConfig[ticket.status as TicketStatus];
              const priority = priorityConfig[ticket.priority as TicketPriority];
              const StatusIcon = status.icon;

              return (
                <Link
                  key={ticket._id}
                  href={`/tickets/${ticket._id}`}
                  className="block p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">{ticket.subject}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${priority.color}`}>
                          {priority.label}
                        </span>
                      </div>
                      {ticket.description && (
                        <p className="text-sm text-muted-foreground truncate mb-2">
                          {ticket.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {formatVisitorIdentityLabel({
                            visitorId: ticket.visitorId,
                            readableId: ticket.visitor?.readableId,
                            name: ticket.visitor?.name,
                            email: ticket.visitor?.email,
                          })}
                        </span>
                        {ticket.assignee && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            Assigned to {ticket.assignee.name || ticket.assignee.email}
                          </span>
                        )}
                        <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${status.color}`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Create New Ticket</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <Input
                  value={newTicketSubject}
                  onChange={(e) => setNewTicketSubject(e.target.value)}
                  placeholder="Brief description of the issue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={newTicketDescription}
                  onChange={(e) => setNewTicketDescription(e.target.value)}
                  placeholder="Detailed description..."
                  className="w-full border rounded-md px-3 py-2 text-sm min-h-[100px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <select
                  value={newTicketPriority}
                  onChange={(e) => setNewTicketPriority(e.target.value as TicketPriority)}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Customer (optional)</label>
                <Input
                  value={visitorSearchQuery}
                  onChange={(e) => {
                    setVisitorSearchQuery(e.target.value);
                    if (!e.target.value) setSelectedVisitorId(null);
                  }}
                  placeholder="Search by email or name..."
                />
                {selectedVisitorId && (
                  <div className="mt-2 flex items-center gap-2 p-2 bg-primary/10 rounded text-sm">
                    <User className="h-4 w-4" />
                    <span>
                      {selectedVisitor
                        ? formatVisitorIdentityLabel({
                            visitorId: selectedVisitor._id,
                            readableId: selectedVisitor.readableId,
                            name: selectedVisitor.name,
                            email: selectedVisitor.email,
                          })
                        : "Selected customer"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVisitorId(null);
                        setVisitorSearchQuery("");
                      }}
                      className="ml-auto text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </div>
                )}
                {!selectedVisitorId &&
                (visitorSearchQuery.length >= 2 ? visitors : recentVisitors)?.length ? (
                  <div className="mt-2 border rounded-md max-h-40 overflow-y-auto">
                    {(visitorSearchQuery.length >= 2 ? visitors : recentVisitors)?.map(
                      (visitor: {
                        _id: Id<"visitors">;
                        readableId?: string;
                        name?: string;
                        email?: string;
                      }) => (
                        <button
                          key={visitor._id}
                          type="button"
                          onClick={() => {
                            setSelectedVisitorId(visitor._id);
                            setVisitorSearchQuery(
                              formatVisitorIdentityLabel({
                                visitorId: visitor._id,
                                readableId: visitor.readableId,
                                name: visitor.name,
                                email: visitor.email,
                              })
                            );
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center gap-2"
                        >
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            {visitor.name && <span className="font-medium">{visitor.name}</span>}
                            {visitor.email && (
                              <span className={visitor.name ? " text-muted-foreground ml-2" : ""}>
                                {visitor.email}
                              </span>
                            )}
                            {!visitor.name && !visitor.email && (
                              <span className="text-muted-foreground">
                                {formatVisitorIdentityLabel({
                                  visitorId: visitor._id,
                                  readableId: visitor.readableId,
                                })}
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    )}
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground mt-1">
                  Link this ticket to an existing customer
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTicket} disabled={!newTicketSubject.trim()}>
                Create Ticket
              </Button>
            </div>
          </Card>
        </div>
      )}
    </AppPageShell>
  );
}

export default function TicketsPage(): React.JSX.Element {
  return (
    <AppLayout>
      <TicketsContent />
    </AppLayout>
  );
}
