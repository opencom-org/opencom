import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import { getClient, getConfig } from "./client";
import type { VisitorId } from "../types";
import { getVisitorState } from "../state/visitor";

export type OutboundMessageId = Id<"outboundMessages">;

export type OutboundMessageType = "chat" | "post" | "banner";

export interface OutboundMessageContent {
  text?: string;
  senderId?: Id<"users">;
  title?: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  style?: "inline" | "floating";
  dismissible?: boolean;
  buttons?: Array<{
    text: string;
    action:
      | "url"
      | "dismiss"
      | "tour"
      | "open_new_conversation"
      | "open_help_article"
      | "open_widget_tab";
    url?: string;
    tourId?: Id<"tours">;
    articleId?: Id<"articles">;
    tabId?: string;
    prefillMessage?: string;
  }>;
  clickAction?: {
    type:
      | "open_messenger"
      | "open_new_conversation"
      | "open_widget_tab"
      | "open_help_article"
      | "open_url"
      | "dismiss";
    tabId?: string;
    articleId?: Id<"articles">;
    url?: string;
    prefillMessage?: string;
  };
}

export interface OutboundMessageData {
  _id: OutboundMessageId;
  workspaceId: Id<"workspaces">;
  type: OutboundMessageType;
  name: string;
  content: OutboundMessageContent;
  status: "draft" | "active" | "paused" | "archived";
  triggers?: {
    type: "immediate" | "page_visit" | "time_on_page" | "scroll_depth" | "event";
    pageUrl?: string;
    pageUrlMatch?: "exact" | "contains" | "regex";
    delaySeconds?: number;
    scrollPercent?: number;
    eventName?: string;
  };
  frequency?: "once" | "once_per_session" | "always";
  priority?: number;
  createdAt: number;
  updatedAt: number;
}

export async function getActiveOutboundMessages(params: {
  visitorId: VisitorId;
  sessionToken?: string;
  currentUrl: string;
  sessionId?: string;
}): Promise<OutboundMessageData[]> {
  const client = getClient();
  const config = getConfig();
  const token = params.sessionToken ?? getVisitorState().sessionToken ?? undefined;

  const messages = await client.query(api.outboundMessages.getEligible, {
    workspaceId: config.workspaceId as Id<"workspaces">,
    visitorId: params.visitorId,
    sessionToken: token,
    currentUrl: params.currentUrl,
    sessionId: params.sessionId,
  });

  return messages as OutboundMessageData[];
}

export async function trackOutboundImpression(params: {
  messageId: OutboundMessageId;
  visitorId: VisitorId;
  sessionToken?: string;
  sessionId?: string;
  action: "shown" | "clicked" | "dismissed";
  buttonIndex?: number;
}): Promise<void> {
  const client = getClient();
  const token = params.sessionToken ?? getVisitorState().sessionToken ?? undefined;

  await client.mutation(api.outboundMessages.trackImpression, {
    messageId: params.messageId,
    visitorId: params.visitorId,
    sessionToken: token,
    sessionId: params.sessionId,
    action: params.action,
    buttonIndex: params.buttonIndex,
  });
}

export async function markOutboundAsSeen(params: {
  messageId: OutboundMessageId;
  visitorId: VisitorId;
  sessionToken?: string;
  sessionId?: string;
}): Promise<void> {
  return trackOutboundImpression({
    messageId: params.messageId,
    visitorId: params.visitorId,
    sessionToken: params.sessionToken,
    sessionId: params.sessionId,
    action: "shown",
  });
}
