"use client";

import type { Id } from "@opencom/convex/dataModel";
import {
  useWebMutation,
  useWebQuery,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";
import type { ChecklistListItem, ChecklistStatus, ChecklistTask } from "../checklistTypes";

type ChecklistsListArgs = {
  workspaceId: Id<"workspaces">;
  status?: ChecklistStatus;
};

type CreateChecklistArgs = {
  workspaceId: Id<"workspaces">;
  name: string;
  tasks: ChecklistTask[];
};

type DeleteChecklistArgs = {
  id: Id<"checklists">;
};

type UpdateChecklistArgs = {
  id: Id<"checklists">;
  status: ChecklistStatus;
};

const CHECKLISTS_LIST_QUERY_REF = webQueryRef<ChecklistsListArgs, ChecklistListItem[]>(
  "checklists:list"
);
const CREATE_CHECKLIST_REF = webMutationRef<CreateChecklistArgs, Id<"checklists">>(
  "checklists:create"
);
const DELETE_CHECKLIST_REF = webMutationRef<DeleteChecklistArgs, null>("checklists:remove");
const UPDATE_CHECKLIST_REF = webMutationRef<UpdateChecklistArgs, null>("checklists:update");

type UseChecklistsPageConvexOptions = {
  workspaceId?: Id<"workspaces"> | null;
  statusFilter: "all" | ChecklistStatus;
};

export function useChecklistsPageConvex({
  workspaceId,
  statusFilter,
}: UseChecklistsPageConvexOptions) {
  return {
    checklists: useWebQuery(
      CHECKLISTS_LIST_QUERY_REF,
      workspaceId
        ? {
            workspaceId,
            status: statusFilter === "all" ? undefined : statusFilter,
          }
        : "skip"
    ),
    createChecklist: useWebMutation(CREATE_CHECKLIST_REF),
    deleteChecklist: useWebMutation(DELETE_CHECKLIST_REF),
    updateChecklist: useWebMutation(UPDATE_CHECKLIST_REF),
  };
}
