"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@opencom/ui";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";

export function AuditLogViewer({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}): React.JSX.Element {
  const [actionFilter, setActionFilter] = useState<string>("");
  const [actorFilter, setActorFilter] = useState<string>("");
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>("");
  const [resourceIdFilter, setResourceIdFilter] = useState<string>("");
  const [timeRangeDays, setTimeRangeDays] = useState<number>(30);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [showViewer, setShowViewer] = useState(false);

  const { startTime, endTime } = useMemo(() => {
    const now = Date.now();
    return {
      startTime: now - timeRangeDays * 24 * 60 * 60 * 1000,
      endTime: now,
    };
  }, [timeRangeDays]);

  const auditAccess = useQuery(api.auditLogs.getAccess, showViewer ? { workspaceId } : "skip");

  const isAuditUnauthenticated = auditAccess?.status === "unauthenticated";
  const canReadAuditLogs = auditAccess?.status === "ok" ? auditAccess.canRead : false;
  const canExportAuditLogs = auditAccess?.status === "ok" ? auditAccess.canExport : false;

  const auditLogs = useQuery(
    api.auditLogs.list,
    showViewer && canReadAuditLogs
      ? {
          workspaceId,
          action: actionFilter || undefined,
          actorId: (actorFilter.trim() as Id<"users">) || undefined,
          resourceType: resourceTypeFilter.trim() || undefined,
          resourceId: resourceIdFilter.trim() || undefined,
          startTime,
          endTime,
          limit: 100,
        }
      : "skip"
  );

  const availableActions = useQuery(
    api.auditLogs.getActions,
    showViewer && canReadAuditLogs ? { workspaceId } : "skip"
  );

  const exportLogs = useQuery(
    api.auditLogs.exportLogs,
    isExporting && canReadAuditLogs && canExportAuditLogs
      ? {
          workspaceId,
          action: actionFilter || undefined,
          actorId: (actorFilter.trim() as Id<"users">) || undefined,
          resourceType: resourceTypeFilter.trim() || undefined,
          resourceId: resourceIdFilter.trim() || undefined,
          startTime,
          endTime,
          format: "json",
        }
      : "skip"
  );

  const logExportMutation = useMutation(api.auditLogs.logExport);

  const handleExport = async () => {
    if (isAuditUnauthenticated) {
      setExportNotice("Export unavailable: sign in required.");
      return;
    }
    if (!canReadAuditLogs) {
      setExportNotice("Export unavailable: missing audit.read permission.");
      return;
    }
    if (!canExportAuditLogs) {
      setExportNotice("Export unavailable: missing data.export permission.");
      return;
    }
    setExportNotice(null);
    setIsExporting(true);
  };

  useEffect(() => {
    if (exportLogs && isExporting) {
      const blob = new Blob([JSON.stringify(exportLogs.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `audit-logs-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      void logExportMutation({
        workspaceId,
        exportType: "auditLogs",
        recordCount: exportLogs.count,
      });
      setExportNotice(`Exported ${exportLogs.count} matching audit entries.`);
      setIsExporting(false);
    }
  }, [exportLogs, isExporting, workspaceId, logExportMutation]);

  const formatAction = (action: string) => {
    return action
      .split(".")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" → ");
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const selectedLog =
    selectedLogId && auditLogs
      ? (auditLogs.find((log) => log._id === selectedLogId) ?? null)
      : null;

  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-medium">Audit Logs</h3>
          <p className="text-sm text-muted-foreground">
            View security-relevant activity in your workspace
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowViewer(!showViewer)}>
          {showViewer ? "Hide Logs" : "View Logs"}
        </Button>
      </div>

      {showViewer && (
        <div className="space-y-4 mt-4">
          {auditAccess === undefined ? (
            <p className="text-sm text-muted-foreground">Loading audit permissions...</p>
          ) : isAuditUnauthenticated ? (
            <div className="border rounded-lg p-4" data-testid="audit-logs-read-unauthenticated">
              <p className="font-medium">Sign in required</p>
              <p className="text-sm text-muted-foreground mt-1">
                Authenticate to access audit logs.
              </p>
            </div>
          ) : !canReadAuditLogs ? (
            <div className="border rounded-lg p-4" data-testid="audit-logs-read-denied">
              <p className="font-medium">Permission denied</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your account does not have permission to read audit logs.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={actionFilter}
                  onChange={(event) => setActionFilter(event.target.value)}
                  className="px-3 py-2 border rounded-md text-sm bg-background"
                >
                  <option value="">All Actions</option>
                  {availableActions?.map((action) => (
                    <option key={action} value={action}>
                      {formatAction(action)}
                    </option>
                  ))}
                </select>

                <select
                  value={timeRangeDays}
                  onChange={(event) => setTimeRangeDays(Number(event.target.value))}
                  className="px-3 py-2 border rounded-md text-sm bg-background"
                >
                  <option value={1}>Last 24 hours</option>
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </select>

                <input
                  value={actorFilter}
                  onChange={(event) => setActorFilter(event.target.value)}
                  placeholder="Actor ID (optional)"
                  className="px-3 py-2 border rounded-md text-sm bg-background"
                />

                <div className="grid grid-cols-[1fr,1fr,auto] gap-2">
                  <input
                    value={resourceTypeFilter}
                    onChange={(event) => setResourceTypeFilter(event.target.value)}
                    placeholder="Resource type"
                    className="px-3 py-2 border rounded-md text-sm bg-background"
                  />
                  <input
                    value={resourceIdFilter}
                    onChange={(event) => setResourceIdFilter(event.target.value)}
                    placeholder="Resource ID"
                    className="px-3 py-2 border rounded-md text-sm bg-background"
                  />
                  <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
                    {isExporting ? "Exporting..." : "Export JSON"}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {canExportAuditLogs
                  ? (exportNotice ?? "Export requires data.export permission.")
                  : "You can view logs but cannot export without data.export permission."}
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-4">
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="text-left p-3 font-medium">Time</th>
                          <th className="text-left p-3 font-medium">Action</th>
                          <th className="text-left p-3 font-medium">Actor</th>
                          <th className="text-left p-3 font-medium">Resource</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs?.length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-muted-foreground">
                              No audit logs found
                            </td>
                          </tr>
                        )}
                        {auditLogs?.map((log) => (
                          <tr
                            key={log._id}
                            className={`border-t cursor-pointer hover:bg-muted/30 ${
                              selectedLogId === log._id ? "bg-muted/40" : ""
                            }`}
                            onClick={() => setSelectedLogId(log._id)}
                          >
                            <td className="p-3 text-muted-foreground whitespace-nowrap">
                              {formatTimestamp(log.timestamp)}
                            </td>
                            <td className="p-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                                {formatAction(log.action)}
                              </span>
                            </td>
                            <td className="p-3">
                              {log.actorType === "system" ? (
                                <span className="text-muted-foreground italic">System</span>
                              ) : log.actorName ? (
                                <span title={log.actorEmail ?? undefined}>{log.actorName}</span>
                              ) : (
                                <span className="text-muted-foreground">Unknown</span>
                              )}
                            </td>
                            <td className="p-3 text-muted-foreground">
                              {log.resourceType}
                              {log.resourceId && (
                                <span className="text-xs ml-1">({log.resourceId.slice(0, 8)}...)</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="border rounded-lg p-3 bg-muted/20">
                  <h4 className="text-sm font-semibold mb-2">Event details</h4>
                  {!selectedLog ? (
                    <p className="text-xs text-muted-foreground">
                      Select an event to inspect full metadata.
                    </p>
                  ) : (
                    <div className="space-y-2 text-xs">
                      <div>
                        <strong>Time:</strong> {formatTimestamp(selectedLog.timestamp)}
                      </div>
                      <div>
                        <strong>Action:</strong> {selectedLog.action}
                      </div>
                      <div>
                        <strong>Actor:</strong>{" "}
                        {selectedLog.actorName ?? selectedLog.actorId ?? selectedLog.actorType}
                      </div>
                      <div>
                        <strong>Resource:</strong> {selectedLog.resourceType}
                        {selectedLog.resourceId ? `:${selectedLog.resourceId}` : ""}
                      </div>
                      <pre className="bg-background border rounded p-2 overflow-x-auto max-h-56">
                        {JSON.stringify(selectedLog.metadata ?? {}, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {auditLogs && auditLogs.length >= 100 && (
                <p className="text-xs text-muted-foreground text-center">
                  Showing most recent 100 matching logs. Export for complete filtered history.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
