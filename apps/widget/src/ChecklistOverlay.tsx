import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { CheckSquare, ChevronDown, ChevronUp, ExternalLink } from "./icons";
import type { Id } from "@opencom/convex/dataModel";
import { safeOpenUrl } from "./utils/safeOpenUrl";

interface ChecklistTask {
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
}

interface Checklist {
  _id: Id<"checklists">;
  name: string;
  description?: string;
  tasks: ChecklistTask[];
}

interface ChecklistOverlayProps {
  workspaceId: Id<"workspaces">;
  visitorId: Id<"visitors">;
  sessionToken?: string | null;
  onStartTour?: (tourId: Id<"tours">) => void;
}

export function ChecklistOverlay({
  workspaceId,
  visitorId,
  sessionToken,
  onStartTour,
}: ChecklistOverlayProps) {
  const [expandedChecklist, setExpandedChecklist] = useState<Id<"checklists"> | null>(null);

  const eligibleChecklists = useQuery(api.checklists.getEligible, {
    workspaceId,
    visitorId,
    sessionToken: sessionToken ?? undefined,
  });

  const completeTask = useMutation(api.checklists.completeTask);
  const uncompleteTask = useMutation(api.checklists.uncompleteTask);

  const handleTaskClick = useCallback(
    async (checklist: Checklist, task: ChecklistTask, isCompleted: boolean) => {
      // Handle action first
      if (task.action) {
        if (task.action.type === "tour" && task.action.tourId && onStartTour) {
          onStartTour(task.action.tourId);
        } else if (task.action.type === "url" && task.action.url) {
          safeOpenUrl(task.action.url);
        }
      }

      // Toggle completion for manual tasks
      if (task.completionType === "manual") {
        if (isCompleted) {
          await uncompleteTask({
            visitorId,
            checklistId: checklist._id,
            taskId: task.id,
            workspaceId,
            sessionToken: sessionToken ?? undefined,
          });
        } else {
          await completeTask({
            visitorId,
            checklistId: checklist._id,
            taskId: task.id,
            workspaceId,
            sessionToken: sessionToken ?? undefined,
          });
        }
      }
    },
    [visitorId, workspaceId, sessionToken, completeTask, uncompleteTask, onStartTour]
  );

  if (!eligibleChecklists || eligibleChecklists.length === 0) {
    return null;
  }

  return (
    <div className="opencom-checklists">
      {eligibleChecklists.map(
        ({
          checklist,
          progress,
        }: {
          checklist: Checklist;
          progress: { completedTaskIds: string[] } | null;
        }) => {
          const completedTaskIds = progress?.completedTaskIds || [];
          const completedCount = completedTaskIds.length;
          const totalCount = checklist.tasks.length;
          const progressPercent =
            totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
          const isExpanded = expandedChecklist === checklist._id;
          const isComplete = completedCount === totalCount;

          return (
            <div
              key={checklist._id}
              className={`opencom-checklist ${isComplete ? "complete" : ""}`}
            >
              <button
                className="opencom-checklist-header"
                onClick={() => setExpandedChecklist(isExpanded ? null : checklist._id)}
              >
                <div className="opencom-checklist-header-content">
                  <CheckSquare className={isComplete ? "complete" : ""} />
                  <div className="opencom-checklist-info">
                    <span className="opencom-checklist-name">{checklist.name}</span>
                    <span className="opencom-checklist-progress-text">
                      {completedCount}/{totalCount} completed
                    </span>
                  </div>
                </div>
                <div className="opencom-checklist-header-right">
                  <div className="opencom-checklist-progress-ring">
                    <svg viewBox="0 0 36 36">
                      <path
                        className="opencom-progress-bg"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="opencom-progress-fill"
                        strokeDasharray={`${progressPercent}, 100`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="opencom-progress-text">{progressPercent}%</span>
                  </div>
                  {isExpanded ? <ChevronUp /> : <ChevronDown />}
                </div>
              </button>

              {isExpanded && (
                <div className="opencom-checklist-tasks">
                  {checklist.description && (
                    <p className="opencom-checklist-description">{checklist.description}</p>
                  )}
                  {checklist.tasks.map((task: ChecklistTask) => {
                    const isTaskCompleted = completedTaskIds.includes(task.id);
                    const hasAction = task.action && (task.action.tourId || task.action.url);

                    return (
                      <button
                        key={task.id}
                        className={`opencom-checklist-task ${isTaskCompleted ? "completed" : ""}`}
                        onClick={() =>
                          handleTaskClick(checklist as Checklist, task, isTaskCompleted)
                        }
                      >
                        <div
                          className={`opencom-task-checkbox ${isTaskCompleted ? "checked" : ""}`}
                        >
                          {isTaskCompleted && (
                            <svg viewBox="0 0 12 12" fill="none">
                              <path
                                d="M2 6L5 9L10 3"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                        <div className="opencom-task-content">
                          <span className="opencom-task-title">{task.title}</span>
                          {task.description && (
                            <span className="opencom-task-description">{task.description}</span>
                          )}
                        </div>
                        {hasAction && <ExternalLink className="opencom-task-action-icon" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }
      )}
    </div>
  );
}
