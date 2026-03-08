"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";

const SESSION_LIFETIME_OPTIONS = [
  { value: 1 * 60 * 60 * 1000, label: "1 hour" },
  { value: 4 * 60 * 60 * 1000, label: "4 hours" },
  { value: 12 * 60 * 60 * 1000, label: "12 hours" },
  { value: 24 * 60 * 60 * 1000, label: "24 hours (default)" },
  { value: 3 * 24 * 60 * 60 * 1000, label: "3 days" },
  { value: 7 * 24 * 60 * 60 * 1000, label: "7 days" },
];

export function SignedSessionsSettings({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}): React.JSX.Element {
  // @ts-expect-error Convex generated API refs can exceed TS instantiation depth in this component.
  const settings = useQuery(api.widgetSessions.getSettings, { workspaceId });
  // @ts-expect-error Convex generated API refs can exceed TS instantiation depth in this component.
  const updateSettings = useMutation(api.widgetSessions.updateSettings);

  const handleLifetimeChange = async (sessionLifetimeMs: number) => {
    try {
      await updateSettings({ workspaceId, sessionLifetimeMs });
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
            onChange={(event) => handleLifetimeChange(Number(event.target.value))}
            className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-background"
          >
            {SESSION_LIFETIME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
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
