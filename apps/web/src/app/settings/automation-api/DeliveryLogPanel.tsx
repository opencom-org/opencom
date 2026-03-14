"use client";

import { useState } from "react";
import { Button } from "@opencom/ui";
import { Package } from "lucide-react";
import type { Id } from "@opencom/convex/dataModel";
import { useWebQuery } from "@/lib/convex/hooks";
import { appConfirm } from "@/lib/appConfirm";
import type { useAutomationApiConvex } from "../hooks/useAutomationApiConvex";

type Api = ReturnType<typeof useAutomationApiConvex>;

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function StatusBadge({ status }: { status: string }): React.JSX.Element {
  const colors: Record<string, string> = {
    pending: "bg-blue-100 text-blue-700",
    success: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    retrying: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${colors[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

export function DeliveryLogPanel({
  workspaceId,
  api,
}: {
  workspaceId: Id<"workspaces">;
  api: Api;
}): React.JSX.Element {
  const [filterSubscriptionId, setFilterSubscriptionId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  const subscriptions = api.subscriptions ?? [];

  const deliveryArgs: Record<string, unknown> = { workspaceId };
  if (filterSubscriptionId) {
    deliveryArgs.subscriptionId = filterSubscriptionId;
  }
  if (filterStatus) {
    deliveryArgs.status = filterStatus;
  }

  const deliveries = useWebQuery(api.deliveriesListRef, deliveryArgs as any);

  const subscriptionUrlMap = new Map(
    subscriptions.map((s) => [s._id, s.url])
  );

  const handleReplay = async (deliveryId: Id<"automationWebhookDeliveries">) => {
    if (!(await appConfirm({
      title: "Replay Delivery",
      message: "This will re-send this webhook delivery.",
      confirmText: "Replay",
    }))) return;

    try {
      await api.replayDelivery({ workspaceId, deliveryId });
    } catch (error) {
      console.error("Failed to replay delivery:", error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select
          value={filterSubscriptionId}
          onChange={(e) => setFilterSubscriptionId(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm bg-background"
        >
          <option value="">All webhooks</option>
          {subscriptions.map((sub) => (
            <option key={sub._id} value={sub._id}>
              {sub.url.length > 40 ? sub.url.slice(0, 40) + "..." : sub.url}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm bg-background"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="retrying">Retrying</option>
        </select>
      </div>

      {deliveries === undefined ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : deliveries.length === 0 ? (
        <div className="text-center py-8">
          <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No deliveries yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {deliveries.map((d) => (
            <div key={d._id} className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-sm">
              <div className="flex items-center gap-3 min-w-0">
                <StatusBadge status={d.status} />
                <span className="text-muted-foreground font-mono text-xs truncate max-w-[200px]">
                  {subscriptionUrlMap.get(d.subscriptionId) ?? d.subscriptionId}
                </span>
                <span className="text-xs text-muted-foreground">#{d.attemptNumber}</span>
                {d.httpStatus && (
                  <span className="text-xs text-muted-foreground">HTTP {d.httpStatus}</span>
                )}
                {d.error && (
                  <span className="text-xs text-red-600 truncate max-w-[200px]">{d.error}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(d.createdAt)}
                </span>
                {(d.status === "failed" || d.status === "retrying") && (
                  <Button size="sm" variant="outline" onClick={() => handleReplay(d._id)}>
                    Replay
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
