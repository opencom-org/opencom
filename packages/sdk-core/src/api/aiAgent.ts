import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import { getClient, getConfig } from "./client";
import type { ConversationId, VisitorId } from "../types";
import { getVisitorState } from "../state/visitor";

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

  const settings = await client.query(api.aiAgent.getPublicSettings, {
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

  const results = await client.query(api.aiAgent.getRelevantKnowledge, {
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

  const responses = await client.query(api.aiAgent.getConversationResponses, {
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

  await client.mutation(api.aiAgent.submitFeedback, {
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

  const result = await client.mutation(api.aiAgent.handoffToHuman, {
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

  const result = await client.query(api.aiAgent.shouldRespond, {
    workspaceId: config.workspaceId as Id<"workspaces">,
  });

  return result;
}
