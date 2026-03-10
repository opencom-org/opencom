import { makeFunctionReference, type FunctionReference } from "convex/server";
import type { Id } from "../_generated/dataModel";
import type { NotificationPushAttempt, NotificationRecipientType, NotifyNewMessageMode } from "./contracts";

type InternalFunctionRef<
  Type extends "query" | "mutation" | "action",
  Args extends Record<string, unknown>,
  Return = unknown,
> = FunctionReference<Type, "internal", Args, Return>;

type MemberRecipientArgs = {
  workspaceId: Id<"workspaces">;
};

type MemberRecipientResult = {
  emailRecipients: string[];
  pushRecipients: unknown[];
};

type VisitorReplyRecipientArgs = {
  conversationId: Id<"conversations">;
  channel?: "chat" | "email";
};

type VisitorReplyRecipientResult = {
  emailRecipient?: string | null;
};

type RouteEventArgs = {
  eventType:
    | "chat_message"
    | "new_conversation"
    | "assignment"
    | "ticket_created"
    | "ticket_status_changed"
    | "ticket_assigned"
    | "ticket_comment"
    | "ticket_customer_reply"
    | "ticket_resolved"
    | "outbound_message"
    | "carousel_trigger"
    | "push_campaign";
  domain: "chat" | "ticket" | "outbound" | "campaign";
  audience: "agent" | "visitor" | "both";
  workspaceId: Id<"workspaces">;
  actorType: "agent" | "visitor" | "bot" | "system";
  actorUserId?: Id<"users">;
  actorVisitorId?: Id<"visitors">;
  conversationId?: Id<"conversations">;
  ticketId?: Id<"tickets">;
  outboundMessageId?: Id<"outboundMessages">;
  campaignId?: Id<"pushCampaigns">;
  title?: string;
  body: string;
  data?: Record<string, unknown>;
  recipientUserIds?: Id<"users">[];
  recipientVisitorIds?: Id<"visitors">[];
  excludeUserIds?: Id<"users">[];
  excludeVisitorIds?: Id<"visitors">[];
  eventKey?: string;
};

type NotifyNewMessageArgs = {
  conversationId: Id<"conversations">;
  messageContent: string;
  senderType: string;
  messageId?: Id<"messages">;
  senderId?: string;
  sentAt?: number;
  channel?: "chat" | "email";
  mode?: NotifyNewMessageMode;
};

type SendNotificationEmailArgs = {
  to: string;
  subject: string;
  html: string;
};

type DispatchPushAttemptsArgs = {
  workspaceId: Id<"workspaces">;
  eventId?: Id<"notificationEvents">;
  eventKey: string;
  title?: string;
  body: string;
  data?: Record<string, unknown>;
  attempts: NotificationPushAttempt[];
};

type LogDeliveryOutcomeArgs = {
  workspaceId: Id<"workspaces">;
  eventId?: Id<"notificationEvents">;
  eventKey: string;
  dedupeKey: string;
  channel: "push" | "email" | "web" | "widget";
  recipientType: NotificationRecipientType;
  userId?: Id<"users">;
  visitorId?: Id<"visitors">;
  tokenCount?: number;
  status: "delivered" | "suppressed" | "failed";
  reason?: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

type PushSendArgs = {
  tokens: string[];
  title?: string;
  body: string;
  data?: Record<string, unknown>;
};

type PushSendResult = {
  success: boolean;
  sent: number;
  failed?: number;
  error?: string;
  tickets: Array<{
    status: string;
    id?: string;
    error?: string;
    errorCode?: string;
    token?: string;
  }>;
};

type PushTokenDeliveryFailureArgs = {
  token: string;
  error: string;
  removeToken: boolean;
};

export const getMemberRecipientsForNewVisitorMessageRef =
  makeFunctionReference<"query", MemberRecipientArgs, MemberRecipientResult>(
    "notifications:getMemberRecipientsForNewVisitorMessage"
  ) as unknown as InternalFunctionRef<"query", MemberRecipientArgs, MemberRecipientResult>;

export const getVisitorRecipientsForSupportReplyRef =
  makeFunctionReference<"query", VisitorReplyRecipientArgs, VisitorReplyRecipientResult>(
    "notifications:getVisitorRecipientsForSupportReply"
  ) as unknown as InternalFunctionRef<"query", VisitorReplyRecipientArgs, VisitorReplyRecipientResult>;

export const routeEventRef = makeFunctionReference<"mutation", RouteEventArgs, unknown>(
  "notifications:routeEvent"
) as unknown as InternalFunctionRef<"mutation", RouteEventArgs>;

export const notifyNewMessageRef = makeFunctionReference<"mutation", NotifyNewMessageArgs, unknown>(
  "notifications:notifyNewMessage"
) as unknown as InternalFunctionRef<"mutation", NotifyNewMessageArgs>;

export const sendNotificationEmailRef = makeFunctionReference<
  "action",
  SendNotificationEmailArgs,
  unknown
>("notifications:sendNotificationEmail") as unknown as InternalFunctionRef<
  "action",
  SendNotificationEmailArgs
>;

export const dispatchPushAttemptsRef = makeFunctionReference<
  "action",
  DispatchPushAttemptsArgs,
  unknown
>("notifications:dispatchPushAttempts") as unknown as InternalFunctionRef<
  "action",
  DispatchPushAttemptsArgs
>;

export const logDeliveryOutcomeRef = makeFunctionReference<
  "mutation",
  LogDeliveryOutcomeArgs,
  unknown
>("notifications:logDeliveryOutcome") as unknown as InternalFunctionRef<
  "mutation",
  LogDeliveryOutcomeArgs
>;

export const sendPushRef = makeFunctionReference<"action", PushSendArgs, PushSendResult>(
  "push:sendPush"
) as unknown as InternalFunctionRef<"action", PushSendArgs, PushSendResult>;

export const recordPushTokenDeliveryFailureRef = makeFunctionReference<
  "mutation",
  PushTokenDeliveryFailureArgs,
  unknown
>("pushTokens:recordDeliveryFailure") as unknown as InternalFunctionRef<
  "mutation",
  PushTokenDeliveryFailureArgs
>;

export const recordVisitorPushTokenDeliveryFailureRef = makeFunctionReference<
  "mutation",
  PushTokenDeliveryFailureArgs,
  unknown
>("visitorPushTokens:recordDeliveryFailure") as unknown as InternalFunctionRef<
  "mutation",
  PushTokenDeliveryFailureArgs
>;

export function getShallowRunQuery(ctx: { runQuery: unknown }) {
  return ctx.runQuery as unknown as <Args extends Record<string, unknown>, Return>(
    queryRef: InternalFunctionRef<"query", Args, Return>,
    queryArgs: Args
  ) => Promise<Return>;
}

export function getShallowRunMutation(ctx: { runMutation: unknown }) {
  return ctx.runMutation as unknown as <Args extends Record<string, unknown>, Return = unknown>(
    mutationRef: InternalFunctionRef<"mutation", Args, Return>,
    mutationArgs: Args
  ) => Promise<Return>;
}

export function getShallowRunAction(ctx: { runAction: unknown }) {
  return ctx.runAction as unknown as <Args extends Record<string, unknown>, Return>(
    actionRef: InternalFunctionRef<"action", Args, Return>,
    actionArgs: Args
  ) => Promise<Return>;
}

export function getShallowRunAfter(ctx: { scheduler: { runAfter: unknown } }) {
  return ctx.scheduler.runAfter as unknown as <
    Type extends "mutation" | "action",
    Args extends Record<string, unknown>,
    Return = unknown,
  >(
    delayMs: number,
    functionRef: InternalFunctionRef<Type, Args, Return>,
    runArgs: Args
  ) => Promise<unknown>;
}
