"use client";

import type { Id } from "@opencom/convex/dataModel";
import { useWebMutation, webMutationRef } from "@/lib/convex/hooks";

type CreateWorkspaceArgs = {
  name: string;
};

const CREATE_WORKSPACE_REF = webMutationRef<CreateWorkspaceArgs, Id<"workspaces">>(
  "workspaces:create"
);

export function useWorkspaceSelectorConvex() {
  return {
    createWorkspace: useWebMutation(CREATE_WORKSPACE_REF),
  };
}
