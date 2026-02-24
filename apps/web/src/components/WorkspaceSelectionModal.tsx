"use client";

import { Building2 } from "lucide-react";
import type { Id } from "@opencom/convex/dataModel";
import { useAuth } from "@/contexts/AuthContext";

export function WorkspaceSelectionModal(): React.JSX.Element | null {
  const { workspaces, needsWorkspaceSelection, selectInitialWorkspace } = useAuth();

  if (!needsWorkspaceSelection || workspaces.length === 0) {
    return null;
  }

  const handleSelect = (workspaceId: Id<"workspaces">) => {
    selectInitialWorkspace(workspaceId);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold mb-2">Select a Workspace</h2>
        <p className="text-muted-foreground mb-6">
          You belong to multiple workspaces. Please select one to continue.
        </p>

        <div className="space-y-2">
          {workspaces.map((workspace) => (
            <button
              key={workspace._id}
              onClick={() => handleSelect(workspace._id)}
              className="w-full flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors text-left"
            >
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{workspace.name}</p>
                <p className="text-sm text-muted-foreground capitalize">{workspace.role}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
