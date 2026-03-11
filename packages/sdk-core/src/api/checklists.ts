import type { Id } from "@opencom/convex/dataModel";
import { getClient, getConfig } from "./client";
import type { VisitorId } from "../types";
import { getVisitorState } from "../state/visitor";
import { makeFunctionReference, type FunctionReference } from "convex/server";

const GET_ELIGIBLE_CHECKLISTS_REF =
  makeFunctionReference("checklists:getEligible") as FunctionReference<"query">;
const GET_CHECKLIST_PROGRESS_REF =
  makeFunctionReference("checklists:getProgress") as FunctionReference<"query">;
const COMPLETE_CHECKLIST_TASK_REF =
  makeFunctionReference("checklists:completeTask") as FunctionReference<"mutation">;

export type ChecklistId = Id<"checklists">;

export interface ChecklistTask {
  id: string;
  title: string;
  description?: string;
  action?: {
    type: "tour" | "url" | "event";
    tourId?: Id<"tours">;
    url?: string;
    eventName?: string;
  };
  completionType: "manual" | "auto_event" | "auto_attribute";
  completionEvent?: string;
  completionAttribute?: {
    key: string;
    operator: string;
    value?: unknown;
  };
}

export interface ChecklistData {
  _id: ChecklistId;
  workspaceId: Id<"workspaces">;
  name: string;
  description?: string;
  tasks: ChecklistTask[];
  status: "draft" | "active" | "archived";
  createdAt: number;
  updatedAt: number;
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

export async function getEligibleChecklists(
  visitorId: VisitorId,
  sessionToken?: string
): Promise<EligibleChecklist[]> {
  const client = getClient();
  const config = getConfig();
  const token = sessionToken ?? getVisitorState().sessionToken ?? undefined;

  const results = await client.query(GET_ELIGIBLE_CHECKLISTS_REF, {
    workspaceId: config.workspaceId as Id<"workspaces">,
    visitorId,
    sessionToken: token,
  });

  return results as EligibleChecklist[];
}

export async function getChecklistProgress(
  visitorId: VisitorId,
  checklistId: ChecklistId,
  sessionToken?: string
): Promise<ChecklistProgress | null> {
  const client = getClient();
  const config = getConfig();
  const token = sessionToken ?? getVisitorState().sessionToken ?? undefined;

  const progress = await client.query(GET_CHECKLIST_PROGRESS_REF, {
    visitorId,
    checklistId,
    workspaceId: config.workspaceId as Id<"workspaces">,
    sessionToken: token,
  });

  if (!progress) return null;

  return {
    completedTaskIds: progress.completedTaskIds,
    startedAt: progress.startedAt,
    completedAt: progress.completedAt,
  };
}

export async function completeChecklistItem(
  visitorId: VisitorId,
  checklistId: ChecklistId,
  taskId: string,
  sessionToken?: string
): Promise<void> {
  const client = getClient();
  const config = getConfig();
  const token = sessionToken ?? getVisitorState().sessionToken ?? undefined;

  await client.mutation(COMPLETE_CHECKLIST_TASK_REF, {
    visitorId,
    checklistId,
    taskId,
    workspaceId: config.workspaceId as Id<"workspaces">,
    sessionToken: token,
  });
}

export async function dismissChecklist(
  visitorId: VisitorId,
  checklistId: ChecklistId,
  sessionToken?: string
): Promise<void> {
  // Mark all tasks as complete to effectively dismiss
  const client = getClient();
  const config = getConfig();
  const token = sessionToken ?? getVisitorState().sessionToken ?? undefined;

  const checklists = await client.query(GET_ELIGIBLE_CHECKLISTS_REF, {
    workspaceId: config.workspaceId as Id<"workspaces">,
    visitorId,
    sessionToken: token,
  });

  const checklist = checklists.find((c: EligibleChecklist) => c.checklist._id === checklistId);
  if (!checklist) return;

  // Complete all remaining tasks to dismiss
  for (const task of checklist.checklist.tasks) {
    if (!checklist.progress?.completedTaskIds.includes(task.id)) {
      await client.mutation(COMPLETE_CHECKLIST_TASK_REF, {
        visitorId,
        checklistId,
        taskId: task.id,
        workspaceId: config.workspaceId as Id<"workspaces">,
        sessionToken: token,
      });
    }
  }
}
