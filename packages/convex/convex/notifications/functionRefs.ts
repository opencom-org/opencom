import { makeFunctionReference, type FunctionReference } from "convex/server";
import type { Id } from "../_generated/dataModel";
import type { NotificationPushAttempt, NotificationRecipientType, NotifyNewMessageMode } from "./contracts";

type InternalFunctionRef<
  Type extends "query" | "mutation" | "action",
  Args extends Record<string, unknown>,
  Return = unknown,
> = FunctionReference<Type, "internal", Args, Return>;

function makeInternalQueryRef<Args extends Record<string, unknown>, Return>(
  name: string
): InternalFunctionRef<"query", Args, Return> {
  return makeFunctionReference<"query", Args, Return>(name) as unknown as InternalFunctionRef<
    "query",
    Args,
    Return
  >;
}

function makeInternalMutationRef<Args extends Record<string, unknown>, Return = unknown>(
  name: string
): InternalFunctionRef<"mutation", Args, Return> {
  return makeFunctionReference<"mutation", Args, Return>(name) as unknown as InternalFunctionRef<
    "mutation",
    Args,
    Return
  >;
}

function makeInternalActionRef<Args extends Record<string, unknown>, Return>(
  name: string
): InternalFunctionRef<"action", Args, Return> {
  return makeFunctionReference<"action", Args, Return>(name) as unknown as InternalFunctionRef<
    "action",
    Args,
    Return
  >;
}

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

type NotifyNewConversationArgs = {
  conversationId: Id<"conversations">;
};

type NotifyAssignmentArgs = {
  conversationId: Id<"conversations">;
  assignedAgentId: Id<"users">;
  actorUserId?: Id<"users">;
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
  makeInternalQueryRef<MemberRecipientArgs, MemberRecipientResult>(
    "notifications:getMemberRecipientsForNewVisitorMessage"
  );

export const getVisitorRecipientsForSupportReplyRef =
  makeInternalQueryRef<VisitorReplyRecipientArgs, VisitorReplyRecipientResult>(
    "notifications:getVisitorRecipientsForSupportReply"
  );

export const routeEventRef = makeInternalMutationRef<RouteEventArgs>("notifications:routeEvent");

export const notifyNewMessageRef = makeInternalMutationRef<NotifyNewMessageArgs>(
  "notifications:notifyNewMessage"
);

export const notifyNewConversationRef = makeInternalMutationRef<NotifyNewConversationArgs>(
  "notifications:notifyNewConversation"
);

export const notifyAssignmentRef = makeInternalMutationRef<NotifyAssignmentArgs>(
  "notifications:notifyAssignment"
);

export const sendNotificationEmailRef = makeInternalActionRef<SendNotificationEmailArgs, unknown>(
  "notifications:sendNotificationEmail"
);

export const dispatchPushAttemptsRef = makeInternalActionRef<DispatchPushAttemptsArgs, unknown>(
  "notifications:dispatchPushAttempts"
);

export const logDeliveryOutcomeRef = makeInternalMutationRef<LogDeliveryOutcomeArgs>(
  "notifications:logDeliveryOutcome"
);

export const sendPushRef = makeInternalActionRef<PushSendArgs, PushSendResult>("push:sendPush");

export const recordPushTokenDeliveryFailureRef = makeInternalMutationRef<PushTokenDeliveryFailureArgs>(
  "pushTokens:recordDeliveryFailure"
);

export const recordVisitorPushTokenDeliveryFailureRef = makeInternalMutationRef<
  PushTokenDeliveryFailureArgs
>("visitorPushTokens:recordDeliveryFailure");

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
