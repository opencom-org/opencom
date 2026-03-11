"use client";

import type { Id } from "@opencom/convex/dataModel";
import {
  useWebMutation,
  useWebQuery,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type TicketStatus = "submitted" | "in_progress" | "waiting_on_customer" | "resolved";
type TicketPriority = "low" | "normal" | "high" | "urgent";

type TicketArgs = {
  id: Id<"tickets">;
};

type TicketFormArgs = {
  id: Id<"ticketForms">;
};

const VISITORS_SEARCH_QUERY_REF = webQueryRef<
  WorkspaceArgs & { query: string; limit?: number },
  Array<{
    _id: Id<"visitors">;
    readableId?: string;
    name?: string;
    email?: string;
  }>
>("visitors:search");
const VISITORS_LIST_QUERY_REF = webQueryRef<
  WorkspaceArgs & { limit?: number },
  Array<{
    _id: Id<"visitors">;
    readableId?: string;
    name?: string;
    email?: string;
  }>
>("visitors:list");
const TICKETS_LIST_FOR_ADMIN_VIEW_QUERY_REF = webQueryRef<
  WorkspaceArgs & { status?: TicketStatus },
  | {
      status: "ok";
      tickets: Array<{
        _id: Id<"tickets">;
        visitorId?: Id<"visitors">;
        assigneeId?: Id<"users">;
        subject: string;
        description?: string;
        status: TicketStatus;
        priority: TicketPriority;
        createdAt: number;
        visitor?: {
          _id: Id<"visitors">;
          readableId?: string;
          name?: string;
          email?: string;
        } | null;
        assignee?: { _id: Id<"users">; name?: string; email?: string } | null;
      }>;
    }
  | { status: "unauthenticated" | "forbidden"; tickets: [] }
>("tickets:listForAdminView");
const CREATE_TICKET_REF = webMutationRef<
  WorkspaceArgs & {
    visitorId?: Id<"visitors">;
    subject: string;
    description?: string;
    priority?: TicketPriority;
  },
  Id<"tickets">
>("tickets:create");
const TICKET_FORMS_LIST_QUERY_REF = webQueryRef<
  WorkspaceArgs,
  Array<{
    _id: Id<"ticketForms">;
    name: string;
    description?: string;
    fields: Array<{
      id: string;
      type: "text" | "textarea" | "select" | "multi-select" | "number" | "date";
      label: string;
      placeholder?: string;
      required: boolean;
      options?: string[];
    }>;
    isDefault: boolean;
  }>
>("ticketForms:list");
const TICKET_FORM_GET_QUERY_REF = webQueryRef<
  TicketFormArgs,
  {
    _id: Id<"ticketForms">;
    name: string;
    description?: string;
    fields: Array<{
      id: string;
      type: "text" | "textarea" | "select" | "multi-select" | "number" | "date";
      label: string;
      placeholder?: string;
      required: boolean;
      options?: string[];
    }>;
    isDefault: boolean;
  } | null
>("ticketForms:get");
const CREATE_TICKET_FORM_REF = webMutationRef<
  WorkspaceArgs & {
    name: string;
    description?: string;
    fields: Array<{
      id: string;
      type: "text" | "textarea" | "select" | "multi-select" | "number" | "date";
      label: string;
      placeholder?: string;
      required: boolean;
      options?: string[];
    }>;
    isDefault?: boolean;
  },
  Id<"ticketForms">
>("ticketForms:create");
const UPDATE_TICKET_FORM_REF = webMutationRef<
  {
    id: Id<"ticketForms">;
    name?: string;
    description?: string;
    fields?: Array<{
      id: string;
      type: "text" | "textarea" | "select" | "multi-select" | "number" | "date";
      label: string;
      placeholder?: string;
      required: boolean;
      options?: string[];
    }>;
    isDefault?: boolean;
  },
  Id<"ticketForms">
>("ticketForms:update");
const DELETE_TICKET_FORM_REF = webMutationRef<TicketFormArgs, null>("ticketForms:remove");
const TICKET_DETAIL_QUERY_REF = webQueryRef<
  TicketArgs,
  | {
      status: "ok";
      ticket: {
        _id: Id<"tickets">;
        visitorId?: Id<"visitors">;
        assigneeId?: Id<"users">;
        conversationId?: Id<"conversations">;
        subject: string;
        description?: string;
        status: TicketStatus;
        priority: TicketPriority;
        createdAt: number;
        updatedAt: number;
        resolvedAt?: number;
        resolutionSummary?: string;
        visitor?: {
          _id: Id<"visitors">;
          readableId?: string;
          name?: string;
          email?: string;
        } | null;
        assignee?: { _id: Id<"users">; name?: string; email?: string } | null;
        conversation?: { _id: Id<"conversations"> } | null;
        comments?: Array<{
          _id: Id<"ticketComments">;
          authorType: "agent" | "visitor" | "system";
          content: string;
          isInternal: boolean;
          createdAt: number;
        }>;
      };
    }
  | { status: "not_found" | "unauthenticated" | "forbidden"; ticket: null }
>("tickets:getForAdminView");
const WORKSPACE_USERS_QUERY_REF = webQueryRef<
  WorkspaceArgs,
  Array<{
    _id: Id<"workspaceMembers">;
    userId: Id<"users">;
    name?: string;
    email?: string;
  }>
>("workspaceMembers:listByWorkspace");
const UPDATE_TICKET_REF = webMutationRef<
  {
    id: Id<"tickets">;
    status?: TicketStatus;
    priority?: TicketPriority;
    assigneeId?: Id<"users">;
    teamId?: string;
  },
  Id<"tickets">
>("tickets:update");
const ADD_COMMENT_REF = webMutationRef<
  {
    ticketId: Id<"tickets">;
    visitorId?: Id<"visitors">;
    content: string;
    isInternal?: boolean;
    authorId?: string;
    authorType?: "agent" | "visitor" | "system";
    sessionToken?: string;
  },
  Id<"ticketComments">
>("tickets:addComment");
const RESOLVE_TICKET_REF = webMutationRef<
  { id: Id<"tickets">; resolutionSummary?: string },
  Id<"tickets">
>("tickets:resolve");

export function useTicketsPageConvex(
  workspaceId?: Id<"workspaces"> | null,
  status?: TicketStatus,
  visitorSearchQuery?: string
) {
  return {
    createTicket: useWebMutation(CREATE_TICKET_REF),
    recentVisitors: useWebQuery(
      VISITORS_LIST_QUERY_REF,
      workspaceId && !visitorSearchQuery ? { workspaceId, limit: 10 } : "skip"
    ),
    tickets: useWebQuery(
      TICKETS_LIST_FOR_ADMIN_VIEW_QUERY_REF,
      workspaceId ? { workspaceId, ...(status ? { status } : {}) } : "skip"
    ),
    visitors: useWebQuery(
      VISITORS_SEARCH_QUERY_REF,
      workspaceId && visitorSearchQuery && visitorSearchQuery.length >= 2
        ? { workspaceId, query: visitorSearchQuery, limit: 10 }
        : "skip"
    ),
  };
}

export function useTicketFormsPageConvex(workspaceId?: Id<"workspaces"> | null) {
  return {
    createForm: useWebMutation(CREATE_TICKET_FORM_REF),
    deleteForm: useWebMutation(DELETE_TICKET_FORM_REF),
    forms: useWebQuery(TICKET_FORMS_LIST_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
  };
}

export function useTicketFormEditorConvex(formId: Id<"ticketForms">) {
  return {
    form: useWebQuery(TICKET_FORM_GET_QUERY_REF, { id: formId }),
    updateForm: useWebMutation(UPDATE_TICKET_FORM_REF),
  };
}

export function useTicketDetailConvex(
  ticketId: Id<"tickets">,
  workspaceId?: Id<"workspaces"> | null
) {
  return {
    addComment: useWebMutation(ADD_COMMENT_REF),
    resolveTicket: useWebMutation(RESOLVE_TICKET_REF),
    ticketResult: useWebQuery(TICKET_DETAIL_QUERY_REF, ticketId ? { id: ticketId } : "skip"),
    updateTicket: useWebMutation(UPDATE_TICKET_REF),
    workspaceUsers: useWebQuery(
      WORKSPACE_USERS_QUERY_REF,
      workspaceId ? { workspaceId } : "skip"
    ),
  };
}
