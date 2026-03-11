import type { Id } from "@opencom/convex/dataModel";
import { sdkMutationRef, sdkQueryRef, useSdkMutation, useSdkQuery } from "../internal/convex";
import { hasVisitorWorkspaceTransport } from "../internal/runtime";
import { useSdkTransportContext } from "../internal/opencomContext";

const ELIGIBLE_CHECKLISTS_REF = sdkQueryRef("checklists:getEligible");
const COMPLETE_TASK_REF = sdkMutationRef("checklists:completeTask");

export type ChecklistId = Id<"checklists">;

export interface ChecklistTask {
  id: string;
  title: string;
  description?: string;
  action?: {
    type: "tour" | "url" | "event";
    url?: string;
  };
  completionType: "manual" | "auto_event" | "auto_attribute";
}

export interface ChecklistData {
  _id: ChecklistId;
  name: string;
  description?: string;
  tasks: ChecklistTask[];
}

export interface ChecklistProgress {
  completedTaskIds: string[];
  startedAt?: number;
  completedAt?: number;
}

export interface EligibleChecklist {
  checklist: ChecklistData;
  progress: ChecklistProgress | null;
}

export function useChecklists() {
  const transport = useSdkTransportContext();

  const eligibleChecklists = useSdkQuery<EligibleChecklist[]>(
    ELIGIBLE_CHECKLISTS_REF,
    hasVisitorWorkspaceTransport(transport)
      ? {
          workspaceId: transport.workspaceId,
          visitorId: transport.visitorId,
          sessionToken: transport.sessionToken,
        }
      : "skip"
  );

  const completeTaskMutation = useSdkMutation<Record<string, unknown>, unknown>(COMPLETE_TASK_REF);

  const completeTask = async (checklistId: ChecklistId, taskId: string): Promise<void> => {
    if (!hasVisitorWorkspaceTransport(transport)) return;

    await completeTaskMutation({
      visitorId: transport.visitorId,
      checklistId,
      taskId,
      workspaceId: transport.workspaceId,
      sessionToken: transport.sessionToken,
    });
  };

  const getProgress = (checklistId: ChecklistId): ChecklistProgress | null => {
    const checklist = eligibleChecklists?.find(
      (c: EligibleChecklist) => c.checklist._id === checklistId
    );
    return checklist?.progress ?? null;
  };

  const isTaskCompleted = (checklistId: ChecklistId, taskId: string): boolean => {
    const progress = getProgress(checklistId);
    return progress?.completedTaskIds.includes(taskId) ?? false;
  };

  return {
    checklists: (eligibleChecklists ?? []) as EligibleChecklist[],
    isLoading: eligibleChecklists === undefined,
    completeTask,
    getProgress,
    isTaskCompleted,
  };
}
