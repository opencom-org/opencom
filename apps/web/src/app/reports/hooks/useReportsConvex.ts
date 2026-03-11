"use client";

import type { Id } from "@opencom/convex/dataModel";
import { useWebQuery, webQueryRef } from "@/lib/convex/hooks";

type DateRangeArgs = {
  workspaceId: Id<"workspaces">;
  startDate: number;
  endDate: number;
};

type GranularDateRangeArgs = DateRangeArgs & {
  granularity: "day" | "week" | "month";
};

const DASHBOARD_SUMMARY_QUERY_REF = webQueryRef<
  DateRangeArgs,
  {
    totalConversations: number;
    openConversations: number;
    closedConversations: number;
    avgResponseTimeMs: number;
    avgResolutionTimeMs: number;
  } | null
>("reporting:getDashboardSummary");
const CSAT_METRICS_QUERY_REF = webQueryRef<
  GranularDateRangeArgs,
  {
    averageRating: number;
    totalResponses: number;
    satisfactionRate: number;
    ratingDistribution: Record<number, number>;
    trendByPeriod: Array<{ period: string; averageRating: number; count: number }>;
  } | null
>("reporting:getCsatMetrics");
const AI_AGENT_METRICS_QUERY_REF = webQueryRef<
  GranularDateRangeArgs,
  {
    totalResponses: number;
    resolvedByAI: number;
    handedOff: number;
    resolutionRate: number;
    avgResponseTimeMs: number;
    satisfactionRate: number;
    totalTokensUsed?: number;
    avgConfidence?: number;
    handoffRate: number;
    trendByPeriod: Array<{
      period: string;
      totalResponses: number;
      resolutionRate: number;
      satisfactionRate: number;
    }>;
  } | null
>("reporting:getAiAgentMetrics");
const CONVERSATION_METRICS_QUERY_REF = webQueryRef<
  GranularDateRangeArgs,
  {
    total: number;
    volumeByPeriod: Array<{ period: string; count: number }>;
    byStatus: { open: number; closed: number; snoozed: number };
    byChannel: { chat: number; email: number };
  } | null
>("reporting:getConversationMetrics");
const RESPONSE_TIME_METRICS_QUERY_REF = webQueryRef<
  DateRangeArgs,
  { averageMs: number; medianMs: number; p95Ms: number; p90Ms: number } | null
>("reporting:getResponseTimeMetrics");
const RESOLUTION_TIME_METRICS_QUERY_REF = webQueryRef<
  DateRangeArgs,
  { averageMs: number; medianMs: number } | null
>("reporting:getResolutionTimeMetrics");
const AI_VS_HUMAN_COMPARISON_QUERY_REF = webQueryRef<
  DateRangeArgs,
  {
    ai: {
      conversationCount: number;
      avgResponseTimeMs: number;
      csatResponseCount: number;
      avgCsatRating: number;
    };
    human: {
      conversationCount: number;
      avgResponseTimeMs: number;
      csatResponseCount: number;
      avgCsatRating: number;
    };
  } | null
>("reporting:getAiVsHumanComparison");
const KNOWLEDGE_GAPS_QUERY_REF = webQueryRef<
  DateRangeArgs & { limit: number },
  Array<{
    query: string;
    count: number;
    confidence: number;
  }>
>("reporting:getKnowledgeGaps");
const AGENT_METRICS_QUERY_REF = webQueryRef<
  DateRangeArgs,
  Array<{
    agentId: string;
    agentName: string;
    conversationsHandled: number;
    resolved: number;
    avgResponseTimeMs: number;
    avgResolutionTimeMs: number;
  }>
>("reporting:getAgentMetrics");
const AGENT_WORKLOAD_DISTRIBUTION_QUERY_REF = webQueryRef<
  { workspaceId: Id<"workspaces"> },
  {
    total: number;
    unassigned: number;
    distribution: Array<{ agentId: string; agentName: string; openConversations: number }>;
  } | null
>("reporting:getAgentWorkloadDistribution");
const CSAT_BY_AGENT_QUERY_REF = webQueryRef<
  DateRangeArgs,
  Array<{
    agentId: string;
    agentName: string;
    averageRating: number;
    totalResponses: number;
  }>
>("reporting:getCsatByAgent");

export function useReportsPageConvex(
  workspaceId?: Id<"workspaces">,
  startDate?: number,
  endDate?: number
) {
  const args = workspaceId && startDate !== undefined && endDate !== undefined
    ? { workspaceId, startDate, endDate }
    : null;

  return {
    aiMetrics: useWebQuery(AI_AGENT_METRICS_QUERY_REF, args ? { ...args, granularity: "day" } : "skip"),
    csatMetrics: useWebQuery(CSAT_METRICS_QUERY_REF, args ? { ...args, granularity: "day" } : "skip"),
    summary: useWebQuery(DASHBOARD_SUMMARY_QUERY_REF, args ?? "skip"),
  };
}

export function useAiReportConvex(
  workspaceId?: Id<"workspaces">,
  startDate?: number,
  endDate?: number,
  granularity: "day" | "week" | "month" = "day"
) {
  const rangeArgs =
    workspaceId && startDate !== undefined && endDate !== undefined
      ? { workspaceId, startDate, endDate }
      : null;

  return {
    aiMetrics: useWebQuery(
      AI_AGENT_METRICS_QUERY_REF,
      rangeArgs ? { ...rangeArgs, granularity } : "skip"
    ),
    comparison: useWebQuery(AI_VS_HUMAN_COMPARISON_QUERY_REF, rangeArgs ?? "skip"),
    knowledgeGaps: useWebQuery(
      KNOWLEDGE_GAPS_QUERY_REF,
      rangeArgs ? { ...rangeArgs, limit: 20 } : "skip"
    ),
  };
}

export function useConversationsReportConvex(
  workspaceId?: Id<"workspaces">,
  startDate?: number,
  endDate?: number,
  granularity: "day" | "week" | "month" = "day"
) {
  const rangeArgs =
    workspaceId && startDate !== undefined && endDate !== undefined
      ? { workspaceId, startDate, endDate }
      : null;

  return {
    conversationMetrics: useWebQuery(
      CONVERSATION_METRICS_QUERY_REF,
      rangeArgs ? { ...rangeArgs, granularity } : "skip"
    ),
    resolutionTimeMetrics: useWebQuery(RESOLUTION_TIME_METRICS_QUERY_REF, rangeArgs ?? "skip"),
    responseTimeMetrics: useWebQuery(RESPONSE_TIME_METRICS_QUERY_REF, rangeArgs ?? "skip"),
  };
}

export function useTeamReportConvex(
  workspaceId?: Id<"workspaces">,
  startDate?: number,
  endDate?: number
) {
  const rangeArgs =
    workspaceId && startDate !== undefined && endDate !== undefined
      ? { workspaceId, startDate, endDate }
      : null;

  return {
    agentMetrics: useWebQuery(AGENT_METRICS_QUERY_REF, rangeArgs ?? "skip"),
    csatByAgent: useWebQuery(CSAT_BY_AGENT_QUERY_REF, rangeArgs ?? "skip"),
    workloadDistribution: useWebQuery(
      AGENT_WORKLOAD_DISTRIBUTION_QUERY_REF,
      workspaceId ? { workspaceId } : "skip"
    ),
  };
}

export function useCsatReportConvex(
  workspaceId?: Id<"workspaces">,
  startDate?: number,
  endDate?: number,
  granularity: "day" | "week" | "month" = "day"
) {
  const rangeArgs =
    workspaceId && startDate !== undefined && endDate !== undefined
      ? { workspaceId, startDate, endDate }
      : null;

  return {
    csatByAgent: useWebQuery(CSAT_BY_AGENT_QUERY_REF, rangeArgs ?? "skip"),
    csatMetrics: useWebQuery(
      CSAT_METRICS_QUERY_REF,
      rangeArgs ? { ...rangeArgs, granularity } : "skip"
    ),
  };
}
