import { makeFunctionReference, type FunctionReference } from "convex/server";
import type { Id } from "@opencom/convex/dataModel";
import { getClient, getConfig } from "./client";
import type { ConversationId, VisitorId } from "../types";
import { getVisitorState } from "../state/visitor";

// Generated api.aiAgent.* refs trigger TS2589 in sdk-core, so keep the fallback
// localized to these explicit AI agent refs only.
const GET_PUBLIC_AI_SETTINGS_REF =
  makeFunctionReference("aiAgent:getPublicSettings") as FunctionReference<"query">;
const GET_RELEVANT_KNOWLEDGE_REF =
  makeFunctionReference("aiAgent:getRelevantKnowledge") as FunctionReference<"query">;
const GET_CONVERSATION_AI_RESPONSES_REF =
  makeFunctionReference("aiAgent:getConversationResponses") as FunctionReference<"query">;
const SUBMIT_AI_FEEDBACK_REF =
  makeFunctionReference("aiAgent:submitFeedback") as FunctionReference<"mutation">;
const HANDOFF_TO_HUMAN_REF =
  makeFunctionReference("aiAgent:handoffToHuman") as FunctionReference<"mutation">;
const SHOULD_AI_RESPOND_REF =
  makeFunctionReference("aiAgent:shouldRespond") as FunctionReference<"query">;

export type AIResponseId = Id<"aiResponses">;

export interface AIAgentSettings {
  enabled: boolean;
  knowledgeSources: Array<"articles" | "internalArticles" | "snippets">;
  confidenceThreshold: number;
  personality: string | null;
  handoffMessage: string;
  workingHours: {
    start: string;
    end: string;
    timezone: string;
  } | null;
  model: string;
  suggestionsEnabled: boolean;
}

export interface AIResponseData {
  _id: AIResponseId;
  conversationId: ConversationId;
  messageId: Id<"messages">;
  query: string;
  response: string;
  sources: Array<{
    type: string;
    id: string;
    title: string;
    articleId?: string;
  }>;
  confidence: number;
  handedOff: boolean;
  feedback?: "helpful" | "not_helpful";
  createdAt: number;
}

export interface KnowledgeResult {
  id: string;
  type: "article" | "internalArticle" | "snippet";
  title: string;
  content: string;
  relevanceScore: number;
}

export async function getAISettings(): Promise<AIAgentSettings> {
  const client = getClient();
  const config = getConfig();

  const settings = await client.query(GET_PUBLIC_AI_SETTINGS_REF, {
    workspaceId: config.workspaceId as Id<"workspaces">,
  });

  return settings as AIAgentSettings;
}

export async function getRelevantKnowledge(
  query: string,
  limit?: number
): Promise<KnowledgeResult[]> {
  const client = getClient();
  const config = getConfig();

  const results = await client.query(GET_RELEVANT_KNOWLEDGE_REF, {
    workspaceId: config.workspaceId as Id<"workspaces">,
    query,
    limit,
  });

  return results as KnowledgeResult[];
}

export async function getConversationAIResponses(
  conversationId: ConversationId,
  visitorId?: VisitorId,
  sessionToken?: string
): Promise<AIResponseData[]> {
  const client = getClient();
  const state = getVisitorState();
  const resolvedVisitorId = visitorId ?? state.visitorId ?? undefined;
  const token = sessionToken ?? state.sessionToken ?? undefined;

  const responses = await client.query(GET_CONVERSATION_AI_RESPONSES_REF, {
    conversationId,
    visitorId: resolvedVisitorId,
    sessionToken: token,
  });

  return responses as AIResponseData[];
}

export async function submitAIFeedback(
  responseId: AIResponseId,
  feedback: "helpful" | "not_helpful",
  visitorId?: VisitorId,
  sessionToken?: string
): Promise<void> {
  const client = getClient();
  const state = getVisitorState();
  const resolvedVisitorId = visitorId ?? state.visitorId ?? undefined;
  const token = sessionToken ?? state.sessionToken ?? undefined;

  await client.mutation(SUBMIT_AI_FEEDBACK_REF, {
    responseId,
    feedback,
    visitorId: resolvedVisitorId,
    sessionToken: token,
  });
}

export async function handoffToHuman(
  conversationId: ConversationId,
  reason?: string,
  visitorId?: VisitorId,
  sessionToken?: string
): Promise<{ messageId: Id<"messages">; handoffMessage: string }> {
  const client = getClient();
  const state = getVisitorState();
  const resolvedVisitorId = visitorId ?? state.visitorId ?? undefined;
  const token = sessionToken ?? state.sessionToken ?? undefined;

  const result = await client.mutation(HANDOFF_TO_HUMAN_REF, {
    conversationId,
    visitorId: resolvedVisitorId,
    sessionToken: token,
    reason,
  });

  return result;
}

export async function shouldAIRespond(): Promise<{
  shouldRespond: boolean;
  reason: string | null;
}> {
  const client = getClient();
  const config = getConfig();

  const result = await client.query(SHOULD_AI_RESPOND_REF, {
    workspaceId: config.workspaceId as Id<"workspaces">,
  });

  return result;
}
