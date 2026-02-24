"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { Button, Input } from "@opencom/ui";
import { ChevronDown, Plus, Check, Building2 } from "lucide-react";
import type { Id } from "@opencom/convex/dataModel";
import { useAuth } from "@/contexts/AuthContext";

export function WorkspaceSelector(): React.JSX.Element | null {
  const { workspaces, activeWorkspace, switchWorkspace } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const createWorkspace = useMutation(api.workspaces.create);
  const handleSelect = async (workspaceId: Id<"workspaces">) => {
    if (workspaceId !== activeWorkspace?._id) {
      await switchWorkspace(workspaceId);
    }
    setIsOpen(false);
  };

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;

    setIsCreating(true);
    try {
      const workspaceId = await createWorkspace({ name: newWorkspaceName.trim() });
      await switchWorkspace(workspaceId);
      setNewWorkspaceName("");
      setShowCreateForm(false);
      setIsOpen(false);
      window.location.reload();
    } catch (error) {
      console.error("Failed to create workspace:", error);
    } finally {
      setIsCreating(false);
    }
  };

  if (!activeWorkspace) {
    return null;
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <Building2 className="h-4 w-4" />
        <span className="max-w-[150px] truncate">{activeWorkspace.name}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false);
              setShowCreateForm(false);
            }}
          />
          <div className="absolute top-full left-0 mt-1 w-64 bg-white border rounded-lg shadow-lg z-50">
            <div className="p-2">
              <p className="text-xs text-muted-foreground px-2 py-1">Workspaces</p>
              {workspaces.map((workspace) => (
                <button
                  key={workspace._id}
                  onClick={() => handleSelect(workspace._id)}
                  className="w-full flex items-center justify-between px-2 py-2 rounded hover:bg-muted text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{workspace.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6 font-mono truncate">
                      {workspace._id}
                    </p>
                  </div>
                  {workspace._id === activeWorkspace._id && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>

            <div className="border-t p-2">
              {showCreateForm ? (
                <div className="space-y-2">
                  <Input
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="Workspace name"
                    className="h-8 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleCreateWorkspace();
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleCreateWorkspace}
                      disabled={isCreating || !newWorkspaceName.trim()}
                    >
                      {isCreating ? "Creating..." : "Create"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewWorkspaceName("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-muted text-left text-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create workspace</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
