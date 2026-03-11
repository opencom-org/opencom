"use client";

import type { Id } from "@opencom/convex/dataModel";
import {
  useWebMutation,
  useWebQuery,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";
import type { InlineAudienceRule } from "@/lib/audienceRules";
import type {
  ChecklistDetailRecord,
  ChecklistStatus,
  ChecklistTask,
} from "../checklistTypes";

type ChecklistArgs = {
  id: Id<"checklists">;
};

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type TourOption = {
  _id: Id<"tours">;
  name: string;
};

type UpdateChecklistArgs = {
  id: Id<"checklists">;
  name?: string;
  description?: string;
  tasks?: ChecklistTask[];
  status?: ChecklistStatus;
  targeting?: InlineAudienceRule;
};

const CHECKLIST_QUERY_REF = webQueryRef<ChecklistArgs, ChecklistDetailRecord | null>(
  "checklists:get"
);
const TOURS_QUERY_REF = webQueryRef<WorkspaceArgs, TourOption[]>("tours:list");
const EVENT_NAMES_QUERY_REF = webQueryRef<WorkspaceArgs, string[]>("events:getDistinctNames");
const UPDATE_CHECKLIST_REF = webMutationRef<UpdateChecklistArgs, null>("checklists:update");

type UseChecklistBuilderConvexOptions = {
  checklistId: Id<"checklists">;
  workspaceId?: Id<"workspaces"> | null;
};

export function useChecklistBuilderConvex({
  checklistId,
  workspaceId,
}: UseChecklistBuilderConvexOptions) {
  return {
    checklist: useWebQuery(CHECKLIST_QUERY_REF, { id: checklistId }),
    eventNames: useWebQuery(EVENT_NAMES_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
    tours: useWebQuery(TOURS_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
    updateChecklist: useWebMutation(UPDATE_CHECKLIST_REF),
  };
}
