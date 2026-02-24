"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@opencom/convex";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@opencom/ui";
import {
  MessageSquare,
  Users,
  Star,
  Bot,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout, AppPageShell } from "@/components/AppLayout";
import Link from "next/link";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendValue,
  testId,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  testId?: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        {trend && trendValue && (
          <div
            className={`flex items-center text-xs mt-1 ${
              trend === "up"
                ? "text-green-600"
                : trend === "down"
                  ? "text-red-600"
                  : "text-muted-foreground"
            }`}
          >
            {trend === "up" ? (
              <TrendingUp className="h-3 w-3 mr-1" />
            ) : trend === "down" ? (
              <TrendingDown className="h-3 w-3 mr-1" />
            ) : null}
            {trendValue}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReportsContent() {
  const { activeWorkspace } = useAuth();
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("30d");

  const now = useMemo(() => Date.now(), []);
  const startDate =
    now - (dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90) * 24 * 60 * 60 * 1000;

  const summary = useQuery(
    api.reporting.getDashboardSummary,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id, startDate, endDate: now } : "skip"
  );

  const csatMetrics = useQuery(
    api.reporting.getCsatMetrics,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id, startDate, endDate: now } : "skip"
  );

  const aiMetrics = useQuery(
    api.reporting.getAiAgentMetrics,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id, startDate, endDate: now } : "skip"
  );

  if (!activeWorkspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Select a workspace to view reports</p>
      </div>
    );
  }

  return (
    <AppPageShell className="h-full overflow-y-auto" data-testid="reports-responsive-shell">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Analytics and insights for your support operations
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Conversations"
          value={summary?.totalConversations ?? 0}
          description={`${summary?.openConversations ?? 0} open, ${summary?.closedConversations ?? 0} closed`}
          icon={MessageSquare}
        />
        <MetricCard
          title="Avg Response Time"
          value={summary ? formatDuration(summary.avgResponseTimeMs) : "-"}
          description="Time to first response"
          icon={Clock}
        />
        <MetricCard
          title="Avg Resolution Time"
          value={summary ? formatDuration(summary.avgResolutionTimeMs) : "-"}
          description="Time to close conversation"
          icon={CheckCircle}
        />
        <MetricCard
          title="CSAT Score"
          value={csatMetrics ? `${csatMetrics.averageRating.toFixed(1)}/5` : "-"}
          description={`${csatMetrics?.totalResponses ?? 0} responses`}
          icon={Star}
          testId="reports-csat-score-card"
        />
      </div>

      {/* AI Agent Summary */}
      {aiMetrics && aiMetrics.totalResponses > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Agent Performance
            </CardTitle>
            <CardDescription>Automated support metrics for the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Total AI Responses</p>
                <p className="text-2xl font-bold">{aiMetrics.totalResponses}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Resolution Rate</p>
                <p className="text-2xl font-bold">{(aiMetrics.resolutionRate * 100).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Handoff Rate</p>
                <p className="text-2xl font-bold">{(aiMetrics.handoffRate * 100).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Satisfaction Rate</p>
                <p className="text-2xl font-bold">
                  {(aiMetrics.satisfactionRate * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links to Detailed Reports */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/reports/conversations">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Conversations
              </CardTitle>
              <CardDescription>Volume, response times, and resolution metrics</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/reports/team">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Performance
              </CardTitle>
              <CardDescription>Agent workload and performance metrics</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/reports/csat">
          <Card
            className="hover:bg-muted/50 transition-colors cursor-pointer"
            data-testid="reports-csat-link-card"
          >
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Star className="h-5 w-5" />
                CSAT
              </CardTitle>
              <CardDescription>Customer satisfaction scores and trends</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/reports/ai">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI Agent
              </CardTitle>
              <CardDescription>AI performance and knowledge gaps</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </AppPageShell>
  );
}

export default function ReportsPage() {
  return (
    <AppLayout>
      <ReportsContent />
    </AppLayout>
  );
}
