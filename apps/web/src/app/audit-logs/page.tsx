"use client";

import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { AuditLogViewer } from "../settings/SecuritySettingsSection";

function AuditLogsContent(): React.JSX.Element {
  const { activeWorkspace } = useAuth();

  if (!activeWorkspace?._id) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Select a workspace to view security audit history.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">
          Investigate security-relevant events with filters, detail inspection, and export.
        </p>
      </div>
      <AuditLogViewer workspaceId={activeWorkspace._id} />
    </div>
  );
}

export default function AuditLogsPage(): React.JSX.Element {
  return (
    <AppLayout>
      <AuditLogsContent />
    </AppLayout>
  );
}
