import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import { getClient, getConfig } from "./client";
import type { VisitorId } from "../types";
import { getVisitorState } from "../state/visitor";

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

  const results = await client.query(api.checklists.getEligible, {
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

  const progress = await client.query(api.checklists.getProgress, {
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

  await client.mutation(api.checklists.completeTask, {
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

  const checklists = await client.query(api.checklists.getEligible, {
    workspaceId: config.workspaceId as Id<"workspaces">,
    visitorId,
    sessionToken: token,
  });

  const checklist = checklists.find((c: EligibleChecklist) => c.checklist._id === checklistId);
  if (!checklist) return;

  // Complete all remaining tasks to dismiss
  for (const task of checklist.checklist.tasks) {
    if (!checklist.progress?.completedTaskIds.includes(task.id)) {
      await client.mutation(api.checklists.completeTask, {
        visitorId,
        checklistId,
        taskId: task.id,
        workspaceId: config.workspaceId as Id<"workspaces">,
        sessionToken: token,
      });
    }
  }
}
