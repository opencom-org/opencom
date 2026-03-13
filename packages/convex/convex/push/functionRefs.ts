import { makeFunctionReference, type FunctionReference } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";

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

type PushSendArgs = {
  tokens: string[];
  title?: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: boolean;
  priority?: "default" | "normal" | "high";
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

type RecordDeliveryFailureArgs = {
  token: string;
  error: string;
  removeToken: boolean;
};

type GetTokensForVisitorsArgs = {
  workspaceId: Id<"workspaces">;
  visitorIds: Id<"visitors">[];
};

type GetTokensForWorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type GetTokensForVisitorArgs = {
  visitorId: Id<"visitors">;
};

type GetConversationArgs = {
  conversationId: Id<"conversations">;
};

type SendWithTargetingArgs = {
  workspaceId: Id<"workspaces">;
  targeting?: {
    hasEmail?: boolean;
    hasExternalUserId?: boolean;
    customAttribute?: {
      key: string;
      value: unknown;
    };
  };
};

export const SEND_PUSH_REF = makeInternalActionRef<PushSendArgs, PushSendResult>("push:sendPush");

export const RECORD_PUSH_TOKEN_DELIVERY_FAILURE_REF = makeInternalMutationRef<RecordDeliveryFailureArgs>(
  "pushTokens:recordDeliveryFailure"
);

export const RECORD_VISITOR_PUSH_TOKEN_DELIVERY_FAILURE_REF =
  makeInternalMutationRef<RecordDeliveryFailureArgs>("visitorPushTokens:recordDeliveryFailure");

export const GET_TOKENS_FOR_VISITORS_REF = makeInternalQueryRef<GetTokensForVisitorsArgs, string[]>(
  "push:getTokensForVisitors"
);

export const GET_TOKENS_FOR_WORKSPACE_REF = makeInternalQueryRef<GetTokensForWorkspaceArgs, string[]>(
  "push:getTokensForWorkspace"
);

export const GET_TOKENS_FOR_VISITOR_REF = makeInternalQueryRef<GetTokensForVisitorArgs, string[]>(
  "push:getTokensForVisitor"
);

export const GET_CONVERSATION_REF = makeInternalQueryRef<GetConversationArgs, Doc<"conversations"> | null>(
  "push:getConversation"
);

export const GET_ELIGIBLE_VISITORS_REF = makeInternalQueryRef<SendWithTargetingArgs, Id<"visitors">[]>(
  "push:getEligibleVisitors"
);

export function getShallowRunQuery(ctx: { runQuery: unknown }) {
  return ctx.runQuery as unknown as <Args extends Record<string, unknown>, Return>(
    queryRef: InternalFunctionRef<"query", Args, Return>,
    queryArgs: Args
  ) => Promise<Return>;
}

export function getShallowRunAction(ctx: { runAction: unknown }) {
  return ctx.runAction as unknown as <Args extends Record<string, unknown>, Return>(
    actionRef: InternalFunctionRef<"action", Args, Return>,
    actionArgs: Args
  ) => Promise<Return>;
}

export function getShallowRunMutation(ctx: { runMutation: unknown }) {
  return ctx.runMutation as unknown as <Args extends Record<string, unknown>, Return = unknown>(
    mutationRef: InternalFunctionRef<"mutation", Args, Return>,
    mutationArgs: Args
  ) => Promise<Return>;
}
