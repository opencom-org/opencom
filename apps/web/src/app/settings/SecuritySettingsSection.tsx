"use client";

import { Card } from "@opencom/ui";
import { Shield } from "lucide-react";
import type { Id } from "@opencom/convex/dataModel";
import { AuditLogViewer } from "./AuditLogViewer";
import { useSecuritySettingsSectionConvex } from "./hooks/useSettingsSectionsConvex";
import { SecurityIdentitySettingsCard } from "./SecurityIdentitySettingsCard";
import { SignedSessionsSettings } from "./SignedSessionsSettings";

export function SecuritySettingsSection({
  workspaceId,
}: {
  workspaceId?: Id<"workspaces">;
}): React.JSX.Element | null {
  const { auditAccess, auditLogSettings, updateAuditSettings } =
    useSecuritySettingsSectionConvex(workspaceId);
  const isSecurityUnauthenticated = auditAccess?.status === "unauthenticated";
  const canManageSecurity = auditAccess?.status === "ok" ? auditAccess.canManageSecurity : false;

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
