import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { getVisitorState } from "@opencom/sdk-core";
import type {
  EligibleOutboundMessage,
  OutboundClickAction,
} from "@opencom/types";
import { useOpencomContext } from "../components/OpencomProvider";
import type { Id } from "@opencom/convex/dataModel";

export type OutboundMessageId = Id<"outboundMessages">;

export type ClickActionType = OutboundClickAction<Id<"articles">>["type"];
export type ClickAction = OutboundClickAction<Id<"articles">>;

export type OutboundMessageData = EligibleOutboundMessage<
  OutboundMessageId,
  Id<"users">,
  Id<"tours">,
  Id<"articles">
>;

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
