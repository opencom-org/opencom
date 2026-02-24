import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { getVisitorState } from "@opencom/sdk-core";
import { useOpencomContext } from "../components/OpencomProvider";
import type { Id } from "@opencom/convex/dataModel";

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
  const { workspaceId } = useOpencomContext();
  const state = getVisitorState();
  const visitorId = state.visitorId;
  const sessionToken = state.sessionToken;

  const eligibleChecklists = useQuery(
    api.checklists.getEligible,
    visitorId && workspaceId && sessionToken
      ? { workspaceId: workspaceId as Id<"workspaces">, visitorId, sessionToken }
      : "skip"
  );

  const completeTaskMutation = useMutation(api.checklists.completeTask);

  const completeTask = async (checklistId: ChecklistId, taskId: string): Promise<void> => {
    if (!visitorId || !workspaceId || !sessionToken) return;

    await completeTaskMutation({
      visitorId,
      checklistId,
      taskId,
      workspaceId: workspaceId as Id<"workspaces">,
      sessionToken,
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
