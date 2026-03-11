import { makeFunctionReference, type FunctionReference } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";

type InternalFunctionRef<
  Type extends "query" | "mutation" | "action",
  Args extends Record<string, unknown>,
  Return = unknown,
> = FunctionReference<Type, "internal", Args, Return>;

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

export const SEND_PUSH_REF = makeFunctionReference<"action", PushSendArgs, PushSendResult>(
  "push:sendPush"
) as unknown as InternalFunctionRef<"action", PushSendArgs, PushSendResult>;

export const RECORD_PUSH_TOKEN_DELIVERY_FAILURE_REF = makeFunctionReference<
  "mutation",
  RecordDeliveryFailureArgs,
  unknown
>("pushTokens:recordDeliveryFailure") as unknown as InternalFunctionRef<
  "mutation",
  RecordDeliveryFailureArgs
>;

export const RECORD_VISITOR_PUSH_TOKEN_DELIVERY_FAILURE_REF = makeFunctionReference<
  "mutation",
  RecordDeliveryFailureArgs,
  unknown
>("visitorPushTokens:recordDeliveryFailure") as unknown as InternalFunctionRef<
  "mutation",
  RecordDeliveryFailureArgs
>;

export const GET_TOKENS_FOR_VISITORS_REF = makeFunctionReference<
  "query",
  GetTokensForVisitorsArgs,
  string[]
>("push:getTokensForVisitors") as unknown as InternalFunctionRef<
  "query",
  GetTokensForVisitorsArgs,
  string[]
>;

export const GET_TOKENS_FOR_WORKSPACE_REF = makeFunctionReference<
  "query",
  GetTokensForWorkspaceArgs,
  string[]
>("push:getTokensForWorkspace") as unknown as InternalFunctionRef<
  "query",
  GetTokensForWorkspaceArgs,
  string[]
>;

export const GET_TOKENS_FOR_VISITOR_REF = makeFunctionReference<
  "query",
  GetTokensForVisitorArgs,
  string[]
>("push:getTokensForVisitor") as unknown as InternalFunctionRef<
  "query",
  GetTokensForVisitorArgs,
  string[]
>;

export const GET_CONVERSATION_REF = makeFunctionReference<
  "query",
  GetConversationArgs,
  Doc<"conversations"> | null
>("push:getConversation") as unknown as InternalFunctionRef<
  "query",
  GetConversationArgs,
  Doc<"conversations"> | null
>;

export const GET_ELIGIBLE_VISITORS_REF = makeFunctionReference<
  "query",
  SendWithTargetingArgs,
  Id<"visitors">[]
>("push:getEligibleVisitors") as unknown as InternalFunctionRef<
  "query",
  SendWithTargetingArgs,
  Id<"visitors">[]
>;

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
