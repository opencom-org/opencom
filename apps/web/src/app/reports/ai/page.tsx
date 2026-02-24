"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@opencom/convex";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from "@opencom/ui";
import { Bot, Download, ArrowLeft, TrendingUp, Clock, AlertTriangle, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Link from "next/link";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

function AiReportContent() {
  const { activeWorkspace } = useAuth();
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("30d");
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("day");

  const { now, startDate } = useMemo(() => {
    const n = Date.now();
    const s = n - (dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90) * 24 * 60 * 60 * 1000;
    return { now: n, startDate: s };
  }, [dateRange]);

  const aiMetrics = useQuery(
    api.reporting.getAiAgentMetrics,
    activeWorkspace?._id
      ? { workspaceId: activeWorkspace._id, startDate, endDate: now, granularity }
      : "skip"
  );

  const comparison = useQuery(
    api.reporting.getAiVsHumanComparison,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id, startDate, endDate: now } : "skip"
  );

  const knowledgeGaps = useQuery(
    api.reporting.getKnowledgeGaps,
    activeWorkspace?._id
      ? { workspaceId: activeWorkspace._id, startDate, endDate: now, limit: 20 }
      : "skip"
  );

  const handleExportCSV = () => {
    if (!aiMetrics) return;

    const headers = ["Period", "Total Responses", "Resolution Rate", "Satisfaction Rate"];
    const rows = aiMetrics.trendByPeriod.map(
      (item: {
        period: string;
        totalResponses: number;
        resolutionRate: number;
        satisfactionRate: number;
      }) => [
        item.period,
        item.totalResponses,
        (item.resolutionRate * 100).toFixed(1) + "%",
        (item.satisfactionRate * 100).toFixed(1) + "%",
      ]
    );

    const csv = [headers.join(","), ...rows.map((row: (string | number)[]) => row.join(","))].join(
      "\n"
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-agent-report-${dateRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!activeWorkspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Select a workspace to view reports</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/reports">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Agent Report</h1>
            <p className="text-muted-foreground">
              AI performance, resolution rates, and knowledge gaps
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as "day" | "week" | "month")}
            className="border rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
          <div className="flex items-center border rounded-lg">
            {(["7d", "30d", "90d"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-sm ${
                  dateRange === range ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                } ${range === "7d" ? "rounded-l-lg" : range === "90d" ? "rounded-r-lg" : ""}`}
              >
                {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "90 Days"}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total AI Responses</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aiMetrics?.totalResponses ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {aiMetrics?.resolvedByAI ?? 0} resolved, {aiMetrics?.handedOff ?? 0} handed off
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {aiMetrics ? `${(aiMetrics.resolutionRate * 100).toFixed(1)}%` : "-"}
            </div>
            <p className="text-xs text-muted-foreground">Resolved without human handoff</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {aiMetrics ? formatDuration(aiMetrics.avgResponseTimeMs) : "-"}
            </div>
            <p className="text-xs text-muted-foreground">AI generation time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfaction Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {aiMetrics ? `${(aiMetrics.satisfactionRate * 100).toFixed(1)}%` : "-"}
            </div>
            <p className="text-xs text-muted-foreground">Marked as helpful</p>
          </CardContent>
        </Card>
      </div>

      {/* AI vs Human Comparison */}
      {comparison && (
        <Card>
          <CardHeader>
            <CardTitle>AI vs Human Comparison</CardTitle>
            <CardDescription>Performance comparison between AI and human agents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Bot className="h-5 w-5 text-primary-foreground0" />
                  <h3 className="font-semibold">AI Agent</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Conversations</span>
                    <span className="font-medium">{comparison.ai.conversationCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Response Time</span>
                    <span className="font-medium">
                      {formatDuration(comparison.ai.avgResponseTimeMs)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg CSAT</span>
                    <span className="font-medium">
                      {comparison.ai.csatResponseCount > 0
                        ? `${comparison.ai.avgCsatRating.toFixed(1)}/5`
                        : "-"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">
                    H
                  </div>
                  <h3 className="font-semibold">Human Agents</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Conversations</span>
                    <span className="font-medium">{comparison.human.conversationCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Response Time</span>
                    <span className="font-medium">
                      {formatDuration(comparison.human.avgResponseTimeMs)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg CSAT</span>
                    <span className="font-medium">
                      {comparison.human.csatResponseCount > 0
                        ? `${comparison.human.avgCsatRating.toFixed(1)}/5`
                        : "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Performance Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Trend</CardTitle>
          <CardDescription>AI resolution rate over time</CardDescription>
        </CardHeader>
        <CardContent>
          {aiMetrics?.trendByPeriod && aiMetrics.trendByPeriod.length > 0 ? (
            <div className="space-y-2">
              {aiMetrics?.trendByPeriod.map(
                (item: {
                  period: string;
                  totalResponses: number;
                  resolutionRate: number;
                  satisfactionRate: number;
                }) => (
                  <div key={item.period} className="flex items-center gap-4">
                    <span className="w-24 text-sm text-muted-foreground">{item.period}</span>
                    <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-primary/50 transition-all"
                        style={{ width: `${item.resolutionRate * 100}%` }}
                      />
                    </div>
                    <span className="w-24 text-sm text-right">
                      {(item.resolutionRate * 100).toFixed(0)}% ({item.totalResponses})
                    </span>
                  </div>
                )
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No AI data available for the selected period
            </p>
          )}
        </CardContent>
      </Card>

      {/* Usage Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Usage Statistics</CardTitle>
            <CardDescription>AI resource consumption</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Tokens Used</span>
                <span className="font-medium">
                  {(aiMetrics?.totalTokensUsed ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Avg Confidence</span>
                <span className="font-medium">
                  {aiMetrics ? `${(aiMetrics.avgConfidence * 100).toFixed(0)}%` : "-"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Handoff Rate</span>
                <span className="font-medium">
                  {aiMetrics ? `${(aiMetrics.handoffRate * 100).toFixed(1)}%` : "-"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Knowledge Gaps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Knowledge Gaps
            </CardTitle>
            <CardDescription>Questions AI couldn&apos;t answer confidently</CardDescription>
          </CardHeader>
          <CardContent>
            {knowledgeGaps && knowledgeGaps.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {knowledgeGaps?.map(
                  (gap: NonNullable<typeof knowledgeGaps>[number], index: number) => (
                    <div key={index} className="flex items-start gap-2 p-2 bg-muted/50 rounded">
                      <span className="text-xs text-muted-foreground w-6">{gap.count}x</span>
                      <span className="text-sm flex-1 line-clamp-2">{gap.query}</span>
                      <span className="text-xs text-muted-foreground">
                        {(gap.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No knowledge gaps identified</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AiReportPage() {
  return (
    <AppLayout>
      <AiReportContent />
    </AppLayout>
  );
}
