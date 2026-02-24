import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { getVisitorState } from "@opencom/sdk-core";
import { useOpencomContext } from "../components/OpencomProvider";
import type { Id } from "@opencom/convex/dataModel";

export type TicketId = Id<"tickets">;
export type TicketStatus = "submitted" | "in_progress" | "waiting_on_customer" | "resolved";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export interface TicketData {
  _id: TicketId;
  subject: string;
  description?: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
}

export function useTickets() {
  const { workspaceId } = useOpencomContext();
  const state = getVisitorState();
  const visitorId = state.visitorId;

  const { sessionToken } = state;

  const tickets = useQuery(
    api.tickets.listByVisitor,
    visitorId && sessionToken && workspaceId
      ? { visitorId, sessionToken, workspaceId: workspaceId as Id<"workspaces"> }
      : "skip"
  );

  const createTicketMutation = useMutation(api.tickets.create);
  const addCommentMutation = useMutation(api.tickets.addComment);

  const createTicket = async (params: {
    subject: string;
    description?: string;
    priority?: TicketPriority;
  }): Promise<TicketId | null> => {
    if (!visitorId || !sessionToken) return null;

    const ticketId = await createTicketMutation({
      workspaceId: workspaceId as Id<"workspaces">,
      visitorId,
      sessionToken,
      subject: params.subject,
      description: params.description,
      priority: params.priority,
    });

    return ticketId;
  };

  const addComment = async (ticketId: TicketId, content: string): Promise<void> => {
    if (!visitorId || !sessionToken) return;

    await addCommentMutation({
      ticketId,
      visitorId,
      content,
      sessionToken,
    });
  };

  return {
    tickets: (tickets ?? []) as TicketData[],
    isLoading: tickets === undefined,
    createTicket,
    addComment,
  };
}

export function useTicket(ticketId: TicketId | null) {
  const state = getVisitorState();

  const ticket = useQuery(
    api.tickets.get,
    ticketId && state.visitorId && state.sessionToken
      ? { id: ticketId, visitorId: state.visitorId, sessionToken: state.sessionToken }
      : "skip"
  );

  const comments = useQuery(
    api.tickets.getComments,
    ticketId && state.visitorId && state.sessionToken
      ? {
          ticketId,
          includeInternal: false,
          visitorId: state.visitorId,
          sessionToken: state.sessionToken,
        }
      : "skip"
  );

  const addCommentMutation = useMutation(api.tickets.addComment);

  const addComment = async (content: string): Promise<void> => {
    if (!ticketId || !state.visitorId || !state.sessionToken) return;

    await addCommentMutation({
      ticketId,
      visitorId: state.visitorId,
      content,
      sessionToken: state.sessionToken,
    });
  };

  return {
    ticket: ticket as TicketData | null | undefined,
    comments: comments ?? [],
    isLoading: ticket === undefined,
    addComment,
  };
}
