import { makeFunctionReference, type FunctionReference } from "convex/server";
import type { Id } from "@opencom/convex/dataModel";
import { getClient, getConfig } from "./client";
import type { VisitorId } from "../types";
import { getVisitorState } from "../state/visitor";

function getMutationRef(name: string): FunctionReference<"mutation"> {
  return makeFunctionReference(name) as FunctionReference<"mutation">;
}

function getQueryRef(name: string): FunctionReference<"query"> {
  return makeFunctionReference(name) as FunctionReference<"query">;
}

export type TicketId = Id<"tickets">;
export type TicketCommentId = Id<"ticketComments">;

export type TicketStatus = "submitted" | "in_progress" | "waiting_on_customer" | "resolved";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export interface TicketData {
  _id: TicketId;
  workspaceId: Id<"workspaces">;
  visitorId?: VisitorId;
  subject: string;
  description?: string;
  priority?: TicketPriority;
  status: TicketStatus;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
}

export interface TicketCommentData {
  _id: TicketCommentId;
  ticketId: TicketId;
  authorId: string;
  authorType: "agent" | "visitor" | "system";
  content: string;
  isInternal: boolean;
  createdAt: number;
}

export interface CreateTicketParams {
  visitorId: VisitorId;
  sessionToken?: string;
  subject: string;
  description?: string;
  priority?: TicketPriority;
}

export async function createTicket(params: CreateTicketParams): Promise<TicketId> {
  const client = getClient();
  const config = getConfig();

  const ticketId = await client.mutation(getMutationRef("tickets:create"), {
    workspaceId: config.workspaceId as Id<"workspaces">,
    visitorId: params.visitorId,
    sessionToken: params.sessionToken,
    subject: params.subject,
    description: params.description,
    priority: params.priority,
  });

  return ticketId;
}

export async function listTickets(
  visitorId: VisitorId,
  sessionToken?: string
): Promise<TicketData[]> {
  const client = getClient();
  const config = getConfig();

  const tickets = await client.query(getQueryRef("tickets:listByVisitor"), {
    visitorId,
    sessionToken,
    workspaceId: config.workspaceId as Id<"workspaces">,
  });

  return tickets as TicketData[];
}

export async function getTicket(
  ticketId: TicketId,
  visitorId?: VisitorId,
  sessionToken?: string
): Promise<TicketData | null> {
  const client = getClient();
  const state = getVisitorState();
  const resolvedVisitorId = visitorId ?? state.visitorId ?? undefined;
  const token = sessionToken ?? state.sessionToken ?? undefined;

  const ticket = await client.query(getQueryRef("tickets:get"), {
    id: ticketId,
    visitorId: resolvedVisitorId,
    sessionToken: token,
  });

  return ticket as TicketData | null;
}

export async function addTicketComment(params: {
  ticketId: TicketId;
  visitorId: VisitorId;
  sessionToken?: string;
  content: string;
}): Promise<TicketCommentId> {
  const client = getClient();

  const commentId = await client.mutation(getMutationRef("tickets:addComment"), {
    ticketId: params.ticketId,
    content: params.content,
    visitorId: params.visitorId,
    sessionToken: params.sessionToken,
  });

  return commentId;
}

export async function getTicketComments(
  ticketId: TicketId,
  visitorId?: VisitorId,
  sessionToken?: string
): Promise<TicketCommentData[]> {
  const client = getClient();
  const state = getVisitorState();
  const resolvedVisitorId = visitorId ?? state.visitorId ?? undefined;
  const token = sessionToken ?? state.sessionToken ?? undefined;

  const comments = await client.query(getQueryRef("tickets:getComments"), {
    ticketId,
    includeInternal: false,
    visitorId: resolvedVisitorId,
    sessionToken: token,
  });

  return comments as TicketCommentData[];
}
