"use client";

import { useQuery } from "convex/react";
import { Card } from "@opencom/ui";
import { Smartphone } from "lucide-react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import { formatVisitorIdentityLabel } from "@/lib/visitorIdentity";

export function MobileDevicesSection({
  workspaceId,
}: {
  workspaceId?: Id<"workspaces">;
}): React.JSX.Element | null {
  const stats = useQuery(api.visitorPushTokens.getStats, workspaceId ? { workspaceId } : "skip");

  const devices = useQuery(
    api.visitorPushTokens.listWithVisitorInfo,
    workspaceId ? { workspaceId } : "skip"
  );

  if (!workspaceId) return null;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Smartphone className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Connected Mobile Devices</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Mobile devices with the SDK installed that have registered for push notifications.
      </p>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Devices</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-2xl font-bold">{stats.ios}</p>
            <p className="text-xs text-muted-foreground">iOS</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-2xl font-bold">{stats.android}</p>
            <p className="text-xs text-muted-foreground">Android</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-2xl font-bold">{stats.uniqueVisitors}</p>
            <p className="text-xs text-muted-foreground">Unique Visitors</p>
          </div>
        </div>
      )}

      {/* Device List */}
      {devices && devices.length > 0 ? (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {devices.slice(0, 10).map((device: NonNullable<typeof devices>[number]) => (
            <div
              key={device._id}
              className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    device.platform === "ios"
                      ? "bg-primary/10 text-primary"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {device.platform.toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-medium">
                    {formatVisitorIdentityLabel({
                      visitorId: device.visitorId,
                      readableId: device.visitorReadableId,
                      name: device.visitorName,
                      email: device.visitorEmail,
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last active: {new Date(device.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <code className="text-xs text-muted-foreground truncate max-w-[120px]">
                {device.token.slice(0, 20)}...
              </code>
            </div>
          ))}
          {devices.length > 10 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              And {devices.length - 10} more devices...
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic text-center py-4">
          No mobile devices connected yet. Install the SDK in your app to see connected devices.
        </p>
      )}
    </Card>
  );
}
