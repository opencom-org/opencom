"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@opencom/convex";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from "@opencom/ui";
import { Users, Clock, CheckCircle, Download, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Link from "next/link";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

function TeamReportContent() {
  const { activeWorkspace } = useAuth();
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("30d");

  const now = Date.now();
  const startDate =
    now - (dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90) * 24 * 60 * 60 * 1000;

  const agentMetrics = useQuery(
    api.reporting.getAgentMetrics,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id, startDate, endDate: now } : "skip"
  );

  const workloadDistribution = useQuery(
    api.reporting.getAgentWorkloadDistribution,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const csatByAgent = useQuery(
    api.reporting.getCsatByAgent,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id, startDate, endDate: now } : "skip"
  );

  const handleExportCSV = () => {
    if (!agentMetrics) return;

    const headers = [
      "Agent",
      "Conversations",
      "Resolved",
      "Avg Response Time",
      "Avg Resolution Time",
    ];
    const rows = agentMetrics.map((agent: NonNullable<typeof agentMetrics>[number]) => [
      agent.agentName,
      agent.conversationsHandled,
      agent.resolved,
      formatDuration(agent.avgResponseTimeMs),
      formatDuration(agent.avgResolutionTimeMs),
    ]);

    const csv = [headers.join(","), ...rows.map((row: (string | number)[]) => row.join(","))].join(
      "\n"
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-report-${dateRange}.csv`;
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

  const totalConversations =
    agentMetrics?.reduce(
      (sum: number, a: NonNullable<typeof agentMetrics>[number]) => sum + a.conversationsHandled,
      0
    ) ?? 0;
  const totalResolved =
    agentMetrics?.reduce(
      (sum: number, a: NonNullable<typeof agentMetrics>[number]) => sum + a.resolved,
      0
    ) ?? 0;

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
            <h1 className="text-3xl font-bold tracking-tight">Team Performance</h1>
            <p className="text-muted-foreground">Agent workload and performance metrics</p>
          </div>
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
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agentMetrics?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">Agents with assigned conversations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Handled</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConversations}</div>
            <p className="text-xs text-muted-foreground">{totalResolved} resolved</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Workload</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workloadDistribution?.total ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {workloadDistribution?.unassigned ?? 0} unassigned
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Current Workload Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Current Workload Distribution</CardTitle>
          <CardDescription>Open conversations per agent</CardDescription>
        </CardHeader>
        <CardContent>
          {workloadDistribution?.distribution && workloadDistribution.distribution.length > 0 ? (
            <div className="space-y-3">
              {workloadDistribution.distribution.map(
                (agent: { agentId: string; agentName: string; openConversations: number }) => {
                  const maxCount = Math.max(
                    ...workloadDistribution.distribution.map(
                      (a: { agentId: string; agentName: string; openConversations: number }) =>
                        a.openConversations
                    )
                  );
                  const percentage = maxCount > 0 ? (agent.openConversations / maxCount) * 100 : 0;
                  return (
                    <div key={agent.agentId} className="flex items-center gap-4">
                      <span className="w-32 text-sm truncate">{agent.agentName}</span>
                      <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                        <div
                          className="h-full bg-primary/50 transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-12 text-sm font-medium text-right">
                        {agent.openConversations}
                      </span>
                    </div>
                  );
                }
              )}
              {workloadDistribution.unassigned > 0 && (
                <div className="flex items-center gap-4">
                  <span className="w-32 text-sm text-muted-foreground">Unassigned</span>
                  <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 transition-all"
                      style={{
                        width: `${(workloadDistribution.unassigned / Math.max(...workloadDistribution.distribution.map((a: { agentId: string; agentName: string; openConversations: number }) => a.openConversations), workloadDistribution.unassigned)) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-12 text-sm font-medium text-right">
                    {workloadDistribution.unassigned}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No open conversations</p>
          )}
        </CardContent>
      </Card>

      {/* Agent Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Performance</CardTitle>
          <CardDescription>Performance metrics by agent for the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {agentMetrics && agentMetrics.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Agent</th>
                    <th className="text-right py-3 px-2 font-medium">Conversations</th>
                    <th className="text-right py-3 px-2 font-medium">Resolved</th>
                    <th className="text-right py-3 px-2 font-medium">Avg Response</th>
                    <th className="text-right py-3 px-2 font-medium">Avg Resolution</th>
                    <th className="text-right py-3 px-2 font-medium">CSAT</th>
                  </tr>
                </thead>
                <tbody>
                  {agentMetrics.map((agent: NonNullable<typeof agentMetrics>[number]) => {
                    const agentCsat = csatByAgent?.find(
                      (c: { agentId: string; averageRating: number }) => c.agentId === agent.agentId
                    );
                    return (
                      <tr key={agent.agentId} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-2">{agent.agentName}</td>
                        <td className="text-right py-3 px-2">{agent.conversationsHandled}</td>
                        <td className="text-right py-3 px-2">{agent.resolved}</td>
                        <td className="text-right py-3 px-2">
                          {formatDuration(agent.avgResponseTimeMs)}
                        </td>
                        <td className="text-right py-3 px-2">
                          {formatDuration(agent.avgResolutionTimeMs)}
                        </td>
                        <td className="text-right py-3 px-2">
                          {agentCsat ? `${agentCsat.averageRating.toFixed(1)}/5` : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No agent data available for the selected period
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function TeamReportPage() {
  return (
    <AppLayout>
      <TeamReportContent />
    </AppLayout>
  );
}
