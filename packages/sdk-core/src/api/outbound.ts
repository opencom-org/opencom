import type { Id } from "@opencom/convex/dataModel";
import type {
  ImpressionAction,
  PersistedOutboundMessage,
} from "@opencom/types";
import { getClient, getConfig } from "./client";
import type { VisitorId } from "../types";
import { getVisitorState } from "../state/visitor";
import { makeFunctionReference, type FunctionReference } from "convex/server";

// Generated api.outboundMessages.* refs trigger TS2589 in sdk-core, so keep the
// fallback localized to these explicit outbound refs only.
const GET_ELIGIBLE_OUTBOUND_MESSAGES_REF =
  makeFunctionReference("outboundMessages:getEligible") as FunctionReference<"query">;
const TRACK_OUTBOUND_IMPRESSION_REF =
  makeFunctionReference("outboundMessages:trackImpression") as FunctionReference<"mutation">;

export type OutboundMessageId = Id<"outboundMessages">;

export type OutboundMessageData = PersistedOutboundMessage<
  OutboundMessageId,
  Id<"workspaces">,
  Id<"users">,
  Id<"tours">,
  Id<"articles">
>;

export async function getActiveOutboundMessages(params: {
  visitorId: VisitorId;
  sessionToken?: string;
  currentUrl: string;
  sessionId?: string;
}): Promise<OutboundMessageData[]> {
  const client = getClient();
  const config = getConfig();
  const token = params.sessionToken ?? getVisitorState().sessionToken ?? undefined;

  const messages = await client.query(GET_ELIGIBLE_OUTBOUND_MESSAGES_REF, {
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
  action: ImpressionAction;
  buttonIndex?: number;
}): Promise<void> {
  const client = getClient();
  const token = params.sessionToken ?? getVisitorState().sessionToken ?? undefined;

  await client.mutation(TRACK_OUTBOUND_IMPRESSION_REF, {
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
