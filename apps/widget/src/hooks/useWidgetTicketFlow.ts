import { useCallback, useState, type MutableRefObject } from "react";
import type { Id } from "@opencom/convex/dataModel";
import { normalizeUnknownError, type ErrorFeedbackMessage } from "@opencom/web-shared";
import { normalizeTicketFormData } from "../widgetShell/helpers";
import type { TicketFormData, WidgetView } from "../widgetShell/types";
import {
  useWidgetMutation,
  useWidgetQuery,
  widgetMutationRef,
  widgetQueryRef,
} from "../lib/convex/hooks";

interface UseWidgetTicketFlowOptions {
  activeWorkspaceId?: string;
  isValidIdFormat: boolean;
  visitorId: Id<"visitors"> | null;
  sessionToken: string | null;
  sessionTokenRef: MutableRefObject<string | null | undefined>;
  onViewChange: (view: WidgetView) => void;
  onTabChange: (tab: "tickets") => void;
}

type TicketField = {
  id: string;
  type: "text" | "textarea" | "select" | "multi-select" | "number" | "date";
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
};

type VisitorTicketRecord = {
  _id: Id<"tickets">;
  subject: string;
  status: string;
  createdAt: number;
};

type TicketDetailRecord = {
  _id: Id<"tickets">;
  subject: string;
  status: string;
  description?: string;
  resolutionSummary?: string;
  comments?: Array<{
    _id: string;
    authorType: string;
    content: string;
    createdAt: number;
    isInternal: boolean;
  }>;
};

type TicketFormRecord = {
  _id: string;
  description?: string;
  fields: TicketField[];
} | null;

const visitorTicketsQueryRef = widgetQueryRef<
  { visitorId: Id<"visitors">; sessionToken: string; workspaceId: Id<"workspaces"> },
  VisitorTicketRecord[]
>("tickets:listByVisitor");

const ticketGetQueryRef = widgetQueryRef<
  { id: Id<"tickets">; visitorId?: Id<"visitors">; sessionToken?: string },
  TicketDetailRecord | null
>("tickets:get");

const defaultTicketFormQueryRef = widgetQueryRef<
  { workspaceId: Id<"workspaces"> },
  TicketFormRecord
>("ticketForms:getDefaultForVisitor");

const addTicketCommentMutationRef = widgetMutationRef<
  { ticketId: Id<"tickets">; visitorId: Id<"visitors">; content: string; sessionToken?: string },
  null
>("tickets:addComment");

const createTicketMutationRef = widgetMutationRef<
  {
    workspaceId: Id<"workspaces">;
    visitorId: Id<"visitors">;
    sessionToken?: string;
    subject: string;
    description?: string;
    formId?: string;
    formData: TicketFormData;
  },
  Id<"tickets">
>("tickets:create");

export function useWidgetTicketFlow({
  activeWorkspaceId,
  isValidIdFormat,
  visitorId,
  sessionToken,
  sessionTokenRef,
  onViewChange,
  onTabChange,
}: UseWidgetTicketFlowOptions) {
  const [selectedTicketId, setSelectedTicketId] = useState<Id<"tickets"> | null>(null);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [ticketErrorFeedback, setTicketErrorFeedback] = useState<ErrorFeedbackMessage | null>(null);

  const visitorTickets = useWidgetQuery(
    visitorTicketsQueryRef,
    isValidIdFormat && visitorId && sessionToken
      ? { visitorId, sessionToken, workspaceId: activeWorkspaceId as Id<"workspaces"> }
      : "skip"
  ) as VisitorTicketRecord[] | undefined;

  const selectedTicket = useWidgetQuery(
    ticketGetQueryRef,
    selectedTicketId
      ? {
          id: selectedTicketId,
          visitorId: visitorId ?? undefined,
          sessionToken: sessionToken ?? undefined,
        }
      : "skip"
  ) as TicketDetailRecord | null | undefined;

  const ticketForm = useWidgetQuery(
    defaultTicketFormQueryRef,
    isValidIdFormat ? { workspaceId: activeWorkspaceId as Id<"workspaces"> } : "skip"
  ) as TicketFormRecord | undefined;

  const addTicketComment = useWidgetMutation(addTicketCommentMutationRef);
  const createTicket = useWidgetMutation(createTicketMutationRef);

  const handleBackFromTickets = useCallback(() => {
    setTicketErrorFeedback(null);
    setSelectedTicketId(null);
    onTabChange("tickets");
    onViewChange("conversation-list");
  }, [onTabChange, onViewChange]);

  const openTicketCreate = useCallback(() => {
    setTicketErrorFeedback(null);
    setSelectedTicketId(null);
    onViewChange("ticket-create");
  }, [onViewChange]);

  const handleSelectTicket = useCallback(
    (ticketId: Id<"tickets">) => {
      setSelectedTicketId(ticketId);
      onViewChange("ticket-detail");
    },
    [onViewChange]
  );

  const handleSubmitTicket = useCallback(
    async (formData: Record<string, unknown>) => {
      if (!visitorId || !activeWorkspaceId || isSubmittingTicket) return;
      setTicketErrorFeedback(null);

      const ticketFields = (ticketForm?.fields ?? []) as TicketField[];
      const getFieldValueByHint = (hints: string[]): string | undefined => {
        const matchingField = ticketFields.find((field) => {
          const fieldKey = `${field.label ?? ""} ${field.id}`.toLowerCase();
          return hints.some((hint) => fieldKey.includes(hint));
        });
        if (!matchingField) return undefined;

        const value = formData[matchingField.id];
        return typeof value === "string" ? value : undefined;
      };

      const subject =
        (formData.subject as string) ||
        (formData.Subject as string) ||
        getFieldValueByHint(["subject", "title"]) ||
        "Support Request";
      const description =
        (formData.description as string) ||
        (formData.Description as string) ||
        getFieldValueByHint(["description", "details", "message"]);

      if (!subject.trim()) {
        setTicketErrorFeedback({
          message: "Please provide a subject for your ticket.",
          nextAction: "Add a short subject, then submit again.",
        });
        return;
      }

      setIsSubmittingTicket(true);
      try {
        const ticketId = await createTicket({
          workspaceId: activeWorkspaceId as Id<"workspaces">,
          visitorId,
          sessionToken: sessionTokenRef.current ?? undefined,
          subject: subject.trim(),
          description: description?.trim(),
          formId: ticketForm?._id,
          formData: normalizeTicketFormData(formData) as TicketFormData,
        });
        setSelectedTicketId(ticketId);
        onViewChange("ticket-detail");
      } catch (error) {
        console.error("Failed to create ticket:", error);
        setTicketErrorFeedback(
          normalizeUnknownError(error, {
            fallbackMessage: "Failed to submit ticket.",
            nextAction: "Please try again.",
          })
        );
      } finally {
        setIsSubmittingTicket(false);
      }
    },
    [
      activeWorkspaceId,
      createTicket,
      isSubmittingTicket,
      onViewChange,
      sessionTokenRef,
      ticketForm,
      visitorId,
    ]
  );

  const handleAddTicketComment = useCallback(
    async (content: string) => {
      if (!selectedTicketId || !visitorId) return;
      try {
        await addTicketComment({
          ticketId: selectedTicketId,
          visitorId,
          content,
          sessionToken: sessionTokenRef.current ?? undefined,
        });
      } catch (error) {
        console.error("Failed to add comment:", error);
      }
    },
    [addTicketComment, selectedTicketId, sessionTokenRef, visitorId]
  );

  return {
    visitorTickets,
    selectedTicket,
    ticketForm,
    isSubmittingTicket,
    ticketErrorFeedback,
    handleBackFromTickets,
    openTicketCreate,
    handleSelectTicket,
    handleSubmitTicket,
    handleAddTicketComment,
  };
}
