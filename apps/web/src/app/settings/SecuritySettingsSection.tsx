"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { Button, Card } from "@opencom/ui";
import { Shield, Copy, Check } from "lucide-react";
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
  }, [
    showViewer,
    isExporting,
    timeRangeDays,
    actionFilter,
    actorFilter,
    resourceTypeFilter,
    resourceIdFilter,
  ]);

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
      // Create and download the file
      const blob = new Blob([JSON.stringify(exportLogs.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Log the export action
      logExportMutation({ workspaceId, exportType: "auditLogs", recordCount: exportLogs.count });
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
              {/* Filters and Export */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
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
                  onChange={(e) => setTimeRangeDays(Number(e.target.value))}
                  className="px-3 py-2 border rounded-md text-sm bg-background"
                >
                  <option value={1}>Last 24 hours</option>
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </select>

                <input
                  value={actorFilter}
                  onChange={(e) => setActorFilter(e.target.value)}
                  placeholder="Actor ID (optional)"
                  className="px-3 py-2 border rounded-md text-sm bg-background"
                />

                <div className="grid grid-cols-[1fr,1fr,auto] gap-2">
                  <input
                    value={resourceTypeFilter}
                    onChange={(e) => setResourceTypeFilter(e.target.value)}
                    placeholder="Resource type"
                    className="px-3 py-2 border rounded-md text-sm bg-background"
                  />
                  <input
                    value={resourceIdFilter}
                    onChange={(e) => setResourceIdFilter(e.target.value)}
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
                {/* Log Table */}
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
                                <span className="text-xs ml-1">
                                  ({log.resourceId.slice(0, 8)}...)
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Detail panel */}
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

const SESSION_LIFETIME_OPTIONS = [
  { value: 1 * 60 * 60 * 1000, label: "1 hour" },
  { value: 4 * 60 * 60 * 1000, label: "4 hours" },
  { value: 12 * 60 * 60 * 1000, label: "12 hours" },
  { value: 24 * 60 * 60 * 1000, label: "24 hours (default)" },
  { value: 3 * 24 * 60 * 60 * 1000, label: "3 days" },
  { value: 7 * 24 * 60 * 60 * 1000, label: "7 days" },
];

function SignedSessionsSettings({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}): React.JSX.Element {
  const settings = useQuery(api.widgetSessions.getSettings, { workspaceId });

  const updateSettings = useMutation(api.widgetSessions.updateSettings);

  const handleLifetimeChange = async (ms: number) => {
    try {
      await updateSettings({ workspaceId, sessionLifetimeMs: ms });
    } catch (error) {
      console.error("Failed to update session lifetime:", error);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <div className="mb-3">
        <h3 className="font-medium">Signed Widget Sessions</h3>
        <p className="text-sm text-muted-foreground">
          All widget visitors authenticate via the signed session boot flow.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">Session Lifetime</label>
          <select
            value={settings?.sessionLifetimeMs ?? 24 * 60 * 60 * 1000}
            onChange={(e) => handleLifetimeChange(Number(e.target.value))}
            className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-background"
          >
            {SESSION_LIFETIME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Sessions are automatically refreshed before expiry. Shorter lifetimes are more secure.
          </p>
        </div>
        <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
          Signed sessions are always active. Widget visitors authenticate via the boot flow.
        </div>
      </div>
    </div>
  );
}

export function SecuritySettingsSection({
  workspaceId,
}: {
  workspaceId?: Id<"workspaces">;
}): React.JSX.Element | null {
  const auditAccess = useQuery(api.auditLogs.getAccess, workspaceId ? { workspaceId } : "skip");
  const isSecurityUnauthenticated = auditAccess?.status === "unauthenticated";
  const canManageSecurity = auditAccess?.status === "ok" ? auditAccess.canManageSecurity : false;

  const identitySettings = useQuery(
    api.identityVerification.getSettings,
    workspaceId && canManageSecurity ? { workspaceId } : "skip"
  );

  const identitySecret = useQuery(
    api.identityVerification.getSecret,
    workspaceId && canManageSecurity ? { workspaceId } : "skip"
  );

  const auditLogSettings = useQuery(
    api.auditLogs.getSettings,
    workspaceId && canManageSecurity ? { workspaceId } : "skip"
  );

  const enableIdentity = useMutation(api.identityVerification.enable);
  const disableIdentity = useMutation(api.identityVerification.disable);
  const updateMode = useMutation(api.identityVerification.updateMode);
  const rotateSecret = useMutation(api.identityVerification.rotateSecret);
  const updateAuditSettings = useMutation(api.auditLogs.updateSettings);

  const [showSecret, setShowSecret] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  if (!workspaceId) return null;

  if (auditAccess === undefined) {
    return (
      <Card className="p-6" data-testid="security-settings-loading">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Security Settings</h2>
        </div>
        <p className="text-sm text-muted-foreground">Loading security permissions...</p>
      </Card>
    );
  }

  if (isSecurityUnauthenticated) {
    return (
      <Card className="p-6" data-testid="security-settings-unauthenticated">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Security Settings</h2>
        </div>
        <p className="font-medium">Sign in required</p>
        <p className="text-sm text-muted-foreground mt-1">
          Authenticate to manage security settings.
        </p>
      </Card>
    );
  }

  if (!canManageSecurity) {
    return (
      <Card className="p-6" data-testid="security-settings-denied">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Security Settings</h2>
        </div>
        <p className="font-medium">Permission denied</p>
        <p className="text-sm text-muted-foreground mt-1">
          Your account does not have permission to manage security settings.
        </p>
      </Card>
    );
  }

  const handleEnableIdentity = async () => {
    setIsSaving(true);
    try {
      const result = await enableIdentity({ workspaceId });
      if (result.secret) {
        setNewSecret(result.secret);
        setShowSecret(true);
      }
    } catch (error) {
      console.error("Failed to enable identity verification:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisableIdentity = async () => {
    setIsSaving(true);
    try {
      await disableIdentity({ workspaceId, confirmDisable: true });
      setShowDisableConfirm(false);
    } catch (error) {
      console.error("Failed to disable identity verification:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRotateSecret = async () => {
    if (!confirm("Are you sure? Users with the old secret will no longer be verified.")) return;
    setIsSaving(true);
    try {
      const result = await rotateSecret({ workspaceId });
      if (result.secret) {
        setNewSecret(result.secret);
        setShowSecret(true);
      }
    } catch (error) {
      console.error("Failed to rotate secret:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleModeChange = async (mode: "optional" | "required") => {
    try {
      await updateMode({ workspaceId, mode });
    } catch (error) {
      console.error("Failed to update mode:", error);
    }
  };

  const handleRetentionChange = async (days: number) => {
    try {
      await updateAuditSettings({ workspaceId, retentionDays: days });
    } catch (error) {
      console.error("Failed to update retention:", error);
    }
  };

  const copySecret = () => {
    const secret = newSecret || identitySecret?.secret;
    if (secret) {
      navigator.clipboard.writeText(secret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Security Settings</h2>
      </div>

      {/* Identity Verification */}
      <div className="space-y-4">
        <div className="p-4 border rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-medium">Identity Verification (HMAC)</h3>
              <p className="text-sm text-muted-foreground">
                Verify user identity in the widget to prevent impersonation
              </p>
            </div>
            <button
              onClick={
                identitySettings?.enabled ? () => setShowDisableConfirm(true) : handleEnableIdentity
              }
              disabled={isSaving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                identitySettings?.enabled ? "bg-primary" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  identitySettings?.enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {!identitySettings?.enabled && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
              <strong>Warning:</strong> Without identity verification, users can be impersonated in
              the widget.
            </div>
          )}

          {identitySettings?.enabled && (
            <div className="space-y-4 mt-4">
              {/* Mode Selection */}
              <div>
                <label className="text-sm font-medium">Verification Mode</label>
                <select
                  value={identitySettings.mode}
                  onChange={(e) => handleModeChange(e.target.value as "optional" | "required")}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-background"
                >
                  <option value="optional">Optional (recommended for getting started)</option>
                  <option value="required">Required (reject unverified users)</option>
                </select>
              </div>

              {/* Secret Display */}
              <div>
                <label className="text-sm font-medium">HMAC Secret</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-muted px-3 py-2 rounded font-mono text-sm flex-1 overflow-hidden">
                    {showSecret
                      ? newSecret || identitySecret?.secret || "********"
                      : "••••••••••••••••••••••••"}
                  </code>
                  <Button variant="outline" size="sm" onClick={() => setShowSecret(!showSecret)}>
                    {showSecret ? "Hide" : "Show"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={copySecret}>
                    {secretCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Use this secret server-side to generate HMAC hashes for user IDs.
                </p>
              </div>

              {/* Integration Example */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-2">Integration Example (Node.js)</p>
                <pre className="text-xs bg-zinc-950 text-zinc-100 p-3 rounded overflow-x-auto">
                  {`const crypto = require('crypto');

function generateUserHash(userId, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(userId)
    .digest('hex');
}

// Pass to widget:
Opencom.identify({
  userId: user.id,
  userHash: generateUserHash(user.id, HMAC_SECRET)
});`}
                </pre>
              </div>

              {/* Rotate Secret */}
              <Button variant="outline" onClick={handleRotateSecret} disabled={isSaving}>
                Rotate Secret
              </Button>
            </div>
          )}
        </div>

        {/* Disable Confirmation Modal */}
        {showDisableConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background p-6 rounded-lg max-w-md">
              <h3 className="font-semibold text-lg mb-2">Disable Identity Verification?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                This will allow anyone to impersonate users in your widget. Are you sure?
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowDisableConfirm(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDisableIdentity} disabled={isSaving}>
                  {isSaving ? "Disabling..." : "Disable"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Signed Widget Sessions */}
        <SignedSessionsSettings workspaceId={workspaceId} />

        {/* Audit Log Retention */}
        <div className="p-4 border rounded-lg">
          <h3 className="font-medium mb-2">Audit Log Retention</h3>
          <p className="text-sm text-muted-foreground mb-3">How long to keep security audit logs</p>
          <select
            value={auditLogSettings?.retentionDays ?? 90}
            onChange={(e) => handleRetentionChange(Number(e.target.value))}
            className="w-full px-3 py-2 border rounded-md text-sm bg-background"
          >
            <option value={30}>30 days</option>
            <option value={90}>90 days (recommended)</option>
            <option value={365}>365 days</option>
          </select>
        </div>

        {/* Audit Log Viewer */}
        <AuditLogViewer workspaceId={workspaceId} />
      </div>
    </Card>
  );
}
