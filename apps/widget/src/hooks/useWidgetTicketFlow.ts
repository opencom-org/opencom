import { useCallback, useState, type MutableRefObject } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import { normalizeUnknownError, type ErrorFeedbackMessage } from "@opencom/web-shared";
import { normalizeTicketFormData } from "../widgetShell/helpers";
import type { TicketFormData, WidgetView } from "../widgetShell/types";

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
  label?: string;
};

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

  const visitorTickets = useQuery(
    api.tickets.listByVisitor,
    isValidIdFormat && visitorId && sessionToken
      ? { visitorId, sessionToken, workspaceId: activeWorkspaceId as Id<"workspaces"> }
      : "skip"
  );

  const selectedTicket = useQuery(
    api.tickets.get,
    selectedTicketId
      ? {
          id: selectedTicketId,
          visitorId: visitorId ?? undefined,
          sessionToken: sessionToken ?? undefined,
        }
      : "skip"
  );

  const ticketForm = useQuery(
    api.ticketForms.getDefaultForVisitor,
    isValidIdFormat ? { workspaceId: activeWorkspaceId as Id<"workspaces"> } : "skip"
  );

  const addTicketComment = useMutation(api.tickets.addComment);
  const createTicket = useMutation(api.tickets.create);

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
