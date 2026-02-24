"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@opencom/convex";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from "@opencom/ui";
import { MessageSquare, Clock, CheckCircle, Download, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Link from "next/link";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

function ConversationsReportContent() {
  const { activeWorkspace } = useAuth();
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("30d");
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("day");

  const dateWindow = useMemo(() => {
    const endDate = Date.now();
    const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
    const startDate = endDate - days * 24 * 60 * 60 * 1000;
    return { startDate, endDate };
  }, [dateRange]);

  const conversationMetrics = useQuery(
    api.reporting.getConversationMetrics,
    activeWorkspace?._id
      ? {
          workspaceId: activeWorkspace._id,
          startDate: dateWindow.startDate,
          endDate: dateWindow.endDate,
          granularity,
        }
      : "skip"
  );

  const responseTimeMetrics = useQuery(
    api.reporting.getResponseTimeMetrics,
    activeWorkspace?._id
      ? {
          workspaceId: activeWorkspace._id,
          startDate: dateWindow.startDate,
          endDate: dateWindow.endDate,
        }
      : "skip"
  );

  const resolutionTimeMetrics = useQuery(
    api.reporting.getResolutionTimeMetrics,
    activeWorkspace?._id
      ? {
          workspaceId: activeWorkspace._id,
          startDate: dateWindow.startDate,
          endDate: dateWindow.endDate,
        }
      : "skip"
  );

  const handleExportCSV = () => {
    if (!conversationMetrics) return;

    const headers = ["Period", "Conversations"];
    const rows = conversationMetrics.volumeByPeriod.map(
      (item: { period: string; count: number }) => [item.period, item.count]
    );

    const csv = [headers.join(","), ...rows.map((row: (string | number)[]) => row.join(","))].join(
      "\n"
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversations-report-${dateRange}.csv`;
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
            <h1 className="text-3xl font-bold tracking-tight">Conversations Report</h1>
            <p className="text-muted-foreground">Volume, response times, and resolution metrics</p>
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
            <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversationMetrics?.total ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {responseTimeMetrics ? formatDuration(responseTimeMetrics.averageMs) : "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              Median: {responseTimeMetrics ? formatDuration(responseTimeMetrics.medianMs) : "-"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Resolution Time</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {resolutionTimeMetrics ? formatDuration(resolutionTimeMetrics.averageMs) : "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              Median: {resolutionTimeMetrics ? formatDuration(resolutionTimeMetrics.medianMs) : "-"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time P95</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {responseTimeMetrics ? formatDuration(responseTimeMetrics.p95Ms) : "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              P90: {responseTimeMetrics ? formatDuration(responseTimeMetrics.p90Ms) : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By Status</CardTitle>
            <CardDescription>Conversation status distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Open</span>
                </div>
                <span className="font-medium">{conversationMetrics?.byStatus.open ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-500" />
                  <span>Closed</span>
                </div>
                <span className="font-medium">{conversationMetrics?.byStatus.closed ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span>Snoozed</span>
                </div>
                <span className="font-medium">{conversationMetrics?.byStatus.snoozed ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By Channel</CardTitle>
            <CardDescription>Conversation channel distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary/50" />
                  <span>Chat</span>
                </div>
                <span className="font-medium">{conversationMetrics?.byChannel.chat ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span>Email</span>
                </div>
                <span className="font-medium">{conversationMetrics?.byChannel.email ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Volume Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Conversation Volume</CardTitle>
          <CardDescription>Number of conversations over time</CardDescription>
        </CardHeader>
        <CardContent>
          {conversationMetrics?.volumeByPeriod && conversationMetrics.volumeByPeriod.length > 0 ? (
            <div className="space-y-2">
              {conversationMetrics.volumeByPeriod.map((item: { period: string; count: number }) => {
                const maxCount = Math.max(
                  ...conversationMetrics.volumeByPeriod.map(
                    (i: { period: string; count: number }) => i.count
                  )
                );
                const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                return (
                  <div key={item.period} className="flex items-center gap-4">
                    <span className="w-24 text-sm text-muted-foreground">{item.period}</span>
                    <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-12 text-sm font-medium text-right">{item.count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No data available for the selected period
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ConversationsReportPage() {
  return (
    <AppLayout>
      <ConversationsReportContent />
    </AppLayout>
  );
}
