import type { Id } from "@opencom/convex/dataModel";
import { sdkMutationRef, sdkQueryRef, useSdkMutation, useSdkQuery } from "../internal/convex";
import {
  hasVisitorSessionTransport,
  hasVisitorWorkspaceTransport,
} from "../internal/runtime";
import { useSdkTransportContext } from "../internal/opencomContext";

const LIST_TICKETS_REF = sdkQueryRef("tickets:listByVisitor");
const CREATE_TICKET_REF = sdkMutationRef("tickets:create");
const ADD_TICKET_COMMENT_REF = sdkMutationRef("tickets:addComment");
const GET_TICKET_REF = sdkQueryRef("tickets:get");
const GET_TICKET_COMMENTS_REF = sdkQueryRef("tickets:getComments");

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

type TicketCommentRecord = {
  _id: string;
  authorType: "visitor" | "agent";
  createdAt: number;
  content: string;
};

export function useTickets() {
  const transport = useSdkTransportContext();

  const tickets = useSdkQuery<TicketData[]>(
    LIST_TICKETS_REF,
    hasVisitorWorkspaceTransport(transport)
      ? {
          visitorId: transport.visitorId,
          sessionToken: transport.sessionToken,
          workspaceId: transport.workspaceId,
        }
      : "skip"
  );

  const createTicketMutation = useSdkMutation<Record<string, unknown>, TicketId | null>(
    CREATE_TICKET_REF
  );
  const addCommentMutation = useSdkMutation<Record<string, unknown>, unknown>(ADD_TICKET_COMMENT_REF);

  const createTicket = async (params: {
    subject: string;
    description?: string;
    priority?: TicketPriority;
  }): Promise<TicketId | null> => {
    if (!hasVisitorWorkspaceTransport(transport)) return null;

    const ticketId = await createTicketMutation({
      workspaceId: transport.workspaceId,
      visitorId: transport.visitorId,
      sessionToken: transport.sessionToken,
      subject: params.subject,
      description: params.description,
      priority: params.priority,
    });

    return ticketId;
  };

  const addComment = async (ticketId: TicketId, content: string): Promise<void> => {
    if (!hasVisitorSessionTransport(transport)) return;

    await addCommentMutation({
      ticketId,
      visitorId: transport.visitorId,
      content,
      sessionToken: transport.sessionToken,
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
  const transport = useSdkTransportContext();

  const ticket = useSdkQuery<TicketData | null>(
    GET_TICKET_REF,
    ticketId && hasVisitorSessionTransport(transport)
      ? { id: ticketId, visitorId: transport.visitorId, sessionToken: transport.sessionToken }
      : "skip"
  );

  const comments = useSdkQuery<TicketCommentRecord[]>(
    GET_TICKET_COMMENTS_REF,
    ticketId && hasVisitorSessionTransport(transport)
      ? {
          ticketId,
          includeInternal: false,
          visitorId: transport.visitorId,
          sessionToken: transport.sessionToken,
        }
      : "skip"
  );

  const addCommentMutation = useSdkMutation<Record<string, unknown>, unknown>(ADD_TICKET_COMMENT_REF);

  const addComment = async (content: string): Promise<void> => {
    if (!ticketId || !hasVisitorSessionTransport(transport)) return;

    await addCommentMutation({
      ticketId,
      visitorId: transport.visitorId,
      content,
      sessionToken: transport.sessionToken,
    });
  };

  return {
    ticket,
    comments: comments ?? [],
    isLoading: ticket === undefined,
    addComment,
  };
}
