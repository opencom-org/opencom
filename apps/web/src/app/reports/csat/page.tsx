"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@opencom/convex";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from "@opencom/ui";
import { Star, Download, ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Link from "next/link";

function CsatReportContent() {
  const { activeWorkspace } = useAuth();
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("30d");
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("day");

  const now = useMemo(() => Date.now(), []);
  const startDate =
    now - (dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90) * 24 * 60 * 60 * 1000;

  const csatMetrics = useQuery(
    api.reporting.getCsatMetrics,
    activeWorkspace?._id
      ? { workspaceId: activeWorkspace._id, startDate, endDate: now, granularity }
      : "skip"
  );

  const csatByAgent = useQuery(
    api.reporting.getCsatByAgent,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id, startDate, endDate: now } : "skip"
  );

  const handleExportCSV = () => {
    if (!csatMetrics) return;

    const headers = ["Period", "Average Rating", "Responses"];
    const rows = csatMetrics.trendByPeriod.map(
      (item: { period: string; averageRating: number; count: number }) => [
        item.period,
        item.averageRating.toFixed(2),
        item.count,
      ]
    );

    const csv = [headers.join(","), ...rows.map((row: (string | number)[]) => row.join(","))].join(
      "\n"
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `csat-report-${dateRange}.csv`;
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

  const ratingLabels: Record<number, string> = {
    1: "Very Dissatisfied",
    2: "Dissatisfied",
    3: "Neutral",
    4: "Satisfied",
    5: "Very Satisfied",
  };

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
            <h1 className="text-3xl font-bold tracking-tight" data-testid="csat-report-heading">
              CSAT Report
            </h1>
            <p className="text-muted-foreground">Customer satisfaction scores and trends</p>
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
      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="csat-report-average-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average CSAT</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="csat-report-average-value">
              {csatMetrics ? `${csatMetrics.averageRating.toFixed(1)}/5` : "-"}
            </div>
            <div className="flex items-center mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-4 w-4 ${
                    star <= Math.round(csatMetrics?.averageRating ?? 0)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="csat-report-total-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="csat-report-total-value">
              {csatMetrics?.totalResponses ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Survey responses collected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfaction Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {csatMetrics ? `${(csatMetrics.satisfactionRate * 100).toFixed(0)}%` : "-"}
            </div>
            <p className="text-xs text-muted-foreground">Rated 4 or 5 stars</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Detractors</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {csatMetrics
                ? (csatMetrics.ratingDistribution[1] ?? 0) +
                  (csatMetrics.ratingDistribution[2] ?? 0)
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">Rated 1 or 2 stars</p>
          </CardContent>
        </Card>
      </div>

      {/* Rating Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Rating Distribution</CardTitle>
          <CardDescription>Breakdown of CSAT responses by rating</CardDescription>
        </CardHeader>
        <CardContent>
          {csatMetrics && csatMetrics.totalResponses > 0 ? (
            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = csatMetrics.ratingDistribution[rating] ?? 0;
                const percentage =
                  csatMetrics.totalResponses > 0 ? (count / csatMetrics.totalResponses) * 100 : 0;
                return (
                  <div key={rating} className="flex items-center gap-4">
                    <div className="w-32 flex items-center gap-2">
                      <span className="text-sm font-medium">{rating}</span>
                      <Star
                        className={`h-4 w-4 ${
                          rating >= 4
                            ? "fill-yellow-400 text-yellow-400"
                            : rating === 3
                              ? "fill-gray-400 text-gray-400"
                              : "fill-red-400 text-red-400"
                        }`}
                      />
                      <span className="text-xs text-muted-foreground">{ratingLabels[rating]}</span>
                    </div>
                    <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          rating >= 4
                            ? "bg-green-500"
                            : rating === 3
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-16 text-sm text-right">
                      {count} ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No CSAT data available for the selected period
            </p>
          )}
        </CardContent>
      </Card>

      {/* CSAT Trend */}
      <Card>
        <CardHeader>
          <CardTitle>CSAT Trend</CardTitle>
          <CardDescription>Average rating over time</CardDescription>
        </CardHeader>
        <CardContent>
          {csatMetrics?.trendByPeriod && csatMetrics.trendByPeriod.length > 0 ? (
            <div className="space-y-2">
              {csatMetrics.trendByPeriod.map(
                (item: { period: string; averageRating: number; count: number }) => (
                  <div key={item.period} className="flex items-center gap-4">
                    <span className="w-24 text-sm text-muted-foreground">{item.period}</span>
                    <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          item.averageRating >= 4
                            ? "bg-green-500"
                            : item.averageRating >= 3
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${(item.averageRating / 5) * 100}%` }}
                      />
                    </div>
                    <span className="w-20 text-sm font-medium text-right">
                      {item.averageRating.toFixed(1)} ({item.count})
                    </span>
                  </div>
                )
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No trend data available</p>
          )}
        </CardContent>
      </Card>

      {/* CSAT by Agent */}
      <Card>
        <CardHeader>
          <CardTitle>CSAT by Agent</CardTitle>
          <CardDescription>Customer satisfaction scores per agent</CardDescription>
        </CardHeader>
        <CardContent>
          {csatByAgent && csatByAgent.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Agent</th>
                    <th className="text-right py-3 px-2 font-medium">Average Rating</th>
                    <th className="text-right py-3 px-2 font-medium">Responses</th>
                    <th className="text-left py-3 px-2 font-medium">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {csatByAgent.map((agent: NonNullable<typeof csatByAgent>[number]) => (
                    <tr key={agent.agentId} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2">{agent.agentName}</td>
                      <td className="text-right py-3 px-2 font-medium">
                        {agent.averageRating.toFixed(1)}/5
                      </td>
                      <td className="text-right py-3 px-2">{agent.totalResponses}</td>
                      <td className="py-3 px-2">
                        <div className="flex items-center">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-4 w-4 ${
                                star <= Math.round(agent.averageRating)
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No agent CSAT data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CsatReportPage() {
  return (
    <AppLayout>
      <CsatReportContent />
    </AppLayout>
  );
}
