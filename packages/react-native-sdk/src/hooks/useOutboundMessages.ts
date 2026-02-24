import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { getVisitorState } from "@opencom/sdk-core";
import { useOpencomContext } from "../components/OpencomProvider";
import type { Id } from "@opencom/convex/dataModel";

export type OutboundMessageId = Id<"outboundMessages">;

export type ClickActionType =
  | "open_messenger"
  | "open_new_conversation"
  | "open_widget_tab"
  | "open_help_article"
  | "open_url"
  | "dismiss";

export interface ClickAction {
  type: ClickActionType;
  tabId?: string;
  articleId?: Id<"articles">;
  url?: string;
  prefillMessage?: string;
}

export interface OutboundMessageContent {
  text?: string;
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
      | "reply"
      | "chat"
      | "open_new_conversation"
      | "open_help_article"
      | "open_widget_tab";
    url?: string;
    articleId?: Id<"articles">;
    tabId?: string;
    prefillMessage?: string;
  }>;
  clickAction?: ClickAction;
}

export interface OutboundMessageData {
  _id: OutboundMessageId;
  type: "chat" | "post" | "banner";
  name: string;
  content: OutboundMessageContent;
  triggers?: {
    type: "immediate" | "page_visit" | "time_on_page" | "scroll_depth" | "event";
    delaySeconds?: number;
  };
  priority?: number;
}

export function useOutboundMessages(currentUrl: string = "") {
  const { workspaceId } = useOpencomContext();
  const state = getVisitorState();
  const visitorId = state.visitorId;
  const sessionId = state.sessionId;
  const sessionToken = state.sessionToken;

  const messages = useQuery(
    api.outboundMessages.getEligible,
    visitorId && workspaceId && sessionToken
      ? {
          workspaceId: workspaceId as Id<"workspaces">,
          visitorId,
          sessionToken,
          currentUrl,
          sessionId,
        }
      : "skip"
  );

  const trackImpressionMutation = useMutation(api.outboundMessages.trackImpression);

  const markAsSeen = async (messageId: OutboundMessageId): Promise<void> => {
    if (!visitorId || !sessionToken) return;

    await trackImpressionMutation({
      messageId,
      visitorId,
      sessionToken,
      sessionId,
      action: "shown",
    });
  };

  const trackClick = async (messageId: OutboundMessageId, buttonIndex?: number): Promise<void> => {
    if (!visitorId || !sessionToken) return;

    await trackImpressionMutation({
      messageId,
      visitorId,
      sessionToken,
      sessionId,
      action: "clicked",
      buttonIndex,
    });
  };

  const trackDismiss = async (messageId: OutboundMessageId): Promise<void> => {
    if (!visitorId || !sessionToken) return;

    await trackImpressionMutation({
      messageId,
      visitorId,
      sessionToken,
      sessionId,
      action: "dismissed",
    });
  };

  return {
    messages: (messages ?? []) as OutboundMessageData[],
    isLoading: messages === undefined,
    markAsSeen,
    trackClick,
    trackDismiss,
  };
}
