import type { UserIdentification } from "../main";

export type WidgetView =
  | "launcher"
  | "conversation-list"
  | "conversation"
  | "article-search"
  | "article-detail"
  | "tour-picker"
  | "checklist"
  | "tickets"
  | "ticket-detail"
  | "ticket-create";

export interface WidgetProps {
  workspaceId?: string;
  initialUser?: UserIdentification;
  convexUrl?: string;
  trackPageViews?: boolean;
  onboardingVerificationToken?: string;
  verificationToken?: string;
  clientVersion?: string;
  clientIdentifier?: string;
}

export type TicketFormValue = string | number | boolean | string[] | null;
export type TicketFormData = Record<string, TicketFormValue>;

export interface WidgetTabHeader {
  title: string;
  showNew: boolean;
}
