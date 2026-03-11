"use client";

import { useMutation, useQuery } from "convex/react";
import { Card } from "@opencom/ui";
import { Shield } from "lucide-react";
import { makeFunctionReference } from "convex/server";
import type { Id } from "@opencom/convex/dataModel";
import { AuditLogViewer } from "./AuditLogViewer";
import { SecurityIdentitySettingsCard } from "./SecurityIdentitySettingsCard";
import { SignedSessionsSettings } from "./SignedSessionsSettings";

const auditAccessQuery = makeFunctionReference<
  "query",
  { workspaceId: Id<"workspaces"> },
  { status: "unauthenticated" | "forbidden" | "ok"; canManageSecurity?: boolean } | null
>("auditLogs:getAccess");

const auditLogSettingsQuery = makeFunctionReference<
  "query",
  { workspaceId: Id<"workspaces"> },
  { retentionDays: number } | null
>("auditLogs:getSettings");

const updateAuditSettingsRef = makeFunctionReference<
  "mutation",
  { workspaceId: Id<"workspaces">; retentionDays: number },
  null
>("auditLogs:updateSettings");

export function SecuritySettingsSection({
  workspaceId,
}: {
  workspaceId?: Id<"workspaces">;
}): React.JSX.Element | null {
  const auditAccess = useQuery(auditAccessQuery, workspaceId ? { workspaceId } : "skip");
  const isSecurityUnauthenticated = auditAccess?.status === "unauthenticated";
  const canManageSecurity = auditAccess?.status === "ok" ? auditAccess.canManageSecurity : false;

  const auditLogSettings = useQuery(
    auditLogSettingsQuery,
    workspaceId && canManageSecurity ? { workspaceId } : "skip"
  );
  const updateAuditSettings = useMutation(updateAuditSettingsRef);

  if (!workspaceId) {
    return null;
  }

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

  const handleRetentionChange = async (retentionDays: number) => {
    try {
      await updateAuditSettings({ workspaceId, retentionDays });
    } catch (error) {
      console.error("Failed to update retention:", error);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Security Settings</h2>
      </div>

      <div className="space-y-4">
        <SecurityIdentitySettingsCard workspaceId={workspaceId} />

        <SignedSessionsSettings workspaceId={workspaceId} />

        <div className="p-4 border rounded-lg">
          <h3 className="font-medium mb-2">Audit Log Retention</h3>
          <p className="text-sm text-muted-foreground mb-3">How long to keep security audit logs</p>
          <select
            value={auditLogSettings?.retentionDays ?? 90}
            onChange={(event) => handleRetentionChange(Number(event.target.value))}
            className="w-full px-3 py-2 border rounded-md text-sm bg-background"
          >
            <option value={30}>30 days</option>
            <option value={90}>90 days (recommended)</option>
            <option value={365}>365 days</option>
          </select>
        </div>

        <div className="p-4 border rounded-lg">
          <h3 className="font-medium mb-2">Audit Logs</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Investigate security events with advanced filtering and export in the dedicated viewer.
          </p>
          <a
            href="/audit-logs"
            className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            View Full Audit Logs
          </a>
        </div>

        <AuditLogViewer workspaceId={workspaceId} />
      </div>
    </Card>
  );
}
