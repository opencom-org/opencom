import type { Id } from "@opencom/convex/dataModel";
import { CheckSquare } from "../icons";
import { ChecklistOverlay } from "../ChecklistOverlay";

interface TasksListProps {
  visitorId: Id<"visitors"> | null;
  activeWorkspaceId: string | undefined;
  sessionToken?: string | null;
  isValidIdFormat: boolean;
  eligibleChecklists: unknown[] | undefined;
  onStartTour: (tourId: string) => void;
}

export function TasksList({
  visitorId,
  activeWorkspaceId,
  sessionToken,
  isValidIdFormat,
  eligibleChecklists,
  onStartTour,
}: TasksListProps) {
  // Show empty state if no checklists available
  if (
    !visitorId ||
    !activeWorkspaceId ||
    !isValidIdFormat ||
    !eligibleChecklists ||
    eligibleChecklists.length === 0
  ) {
    return (
      <div className="opencom-empty-list">
        <div className="opencom-empty-icon">
          <CheckSquare />
        </div>
        <h3>No Tasks</h3>
        <p>Complete tasks to track your progress and unlock new features.</p>
      </div>
    );
  }

  return (
    <ChecklistOverlay
      workspaceId={activeWorkspaceId as Id<"workspaces">}
      visitorId={visitorId}
      sessionToken={sessionToken}
      onStartTour={onStartTour}
    />
  );
}
