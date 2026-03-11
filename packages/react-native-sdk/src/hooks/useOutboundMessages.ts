import type {
  EligibleOutboundMessage,
  OutboundClickAction,
} from "@opencom/types";
import type { Id } from "@opencom/convex/dataModel";
import { sdkMutationRef, sdkQueryRef, useSdkMutation, useSdkQuery } from "../internal/convex";
import { hasVisitorWorkspaceTransport } from "../internal/runtime";
import { useSdkTransportContext } from "../internal/opencomContext";

const ELIGIBLE_MESSAGES_REF = sdkQueryRef("outboundMessages:getEligible");
const TRACK_IMPRESSION_REF = sdkMutationRef("outboundMessages:trackImpression");

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
  const transport = useSdkTransportContext();

  const messages = useSdkQuery<OutboundMessageData[]>(
    ELIGIBLE_MESSAGES_REF,
    hasVisitorWorkspaceTransport(transport)
      ? {
          workspaceId: transport.workspaceId,
          visitorId: transport.visitorId,
          sessionToken: transport.sessionToken,
          currentUrl,
          sessionId: transport.sessionId,
        }
      : "skip"
  );

  const trackImpressionMutation = useSdkMutation<Record<string, unknown>, unknown>(
    TRACK_IMPRESSION_REF
  );

  const markAsSeen = async (messageId: OutboundMessageId): Promise<void> => {
    if (!transport.visitorId || !transport.sessionToken) return;

    await trackImpressionMutation({
      messageId,
      visitorId: transport.visitorId,
      sessionToken: transport.sessionToken,
      sessionId: transport.sessionId,
      action: "shown",
    });
  };

  const trackClick = async (messageId: OutboundMessageId, buttonIndex?: number): Promise<void> => {
    if (!transport.visitorId || !transport.sessionToken) return;

    await trackImpressionMutation({
      messageId,
      visitorId: transport.visitorId,
      sessionToken: transport.sessionToken,
      sessionId: transport.sessionId,
      action: "clicked",
      buttonIndex,
    });
  };

  const trackDismiss = async (messageId: OutboundMessageId): Promise<void> => {
    if (!transport.visitorId || !transport.sessionToken) return;

    await trackImpressionMutation({
      messageId,
      visitorId: transport.visitorId,
      sessionToken: transport.sessionToken,
      sessionId: transport.sessionId,
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
