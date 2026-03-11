import type { Id } from "@opencom/convex/dataModel";
import { useWidgetMutation, widgetMutationRef } from "../../lib/convex/hooks";
import type { AdvanceOn, DiagnosticReason } from "../../tourOverlay/types";

type TourProgressBaseArgs = {
  workspaceId: Id<"workspaces">;
  visitorId: Id<"visitors">;
  sessionToken?: string;
  tourId: Id<"tours">;
};

type AdvanceTourArgs = TourProgressBaseArgs & {
  mode: AdvanceOn;
  targetMatched?: boolean;
  fieldValue?: string;
  selector?: string;
  currentUrl: string;
};

type AdvanceTourResult = {
  advanced: boolean;
  blockedReason?: string | null;
  nextStep: number;
  status: string;
};

type SkipTourStepArgs = TourProgressBaseArgs & {
  reason: DiagnosticReason;
  selector?: string;
  currentUrl: string;
};

type SkipTourStepResult = {
  nextStep?: number;
  status?: string;
  reason?: string;
} | null;

type CheckpointTourArgs = TourProgressBaseArgs & {
  blockedReason?: DiagnosticReason;
  currentUrl: string;
  mode?: AdvanceOn;
  selector?: string;
};

const ADVANCE_TOUR_MUTATION_REF = widgetMutationRef<AdvanceTourArgs, AdvanceTourResult>(
  "tourProgress:advance"
);
const DISMISS_TOUR_MUTATION_REF = widgetMutationRef<TourProgressBaseArgs, unknown>(
  "tourProgress:dismiss"
);
const DISMISS_TOUR_PERMANENTLY_MUTATION_REF = widgetMutationRef<TourProgressBaseArgs, unknown>(
  "tourProgress:dismissPermanently"
);
const SNOOZE_TOUR_MUTATION_REF = widgetMutationRef<TourProgressBaseArgs, unknown>(
  "tourProgress:snooze"
);
const RESTART_TOUR_MUTATION_REF = widgetMutationRef<TourProgressBaseArgs, unknown>(
  "tourProgress:restart"
);
const SKIP_TOUR_STEP_MUTATION_REF = widgetMutationRef<SkipTourStepArgs, SkipTourStepResult>(
  "tourProgress:skipStep"
);
const CHECKPOINT_TOUR_MUTATION_REF = widgetMutationRef<CheckpointTourArgs, unknown>(
  "tourProgress:checkpoint"
);

export function useTourProgressConvex() {
  const advanceTour = useWidgetMutation(ADVANCE_TOUR_MUTATION_REF);
  const dismissTour = useWidgetMutation(DISMISS_TOUR_MUTATION_REF);
  const dismissPermanently = useWidgetMutation(DISMISS_TOUR_PERMANENTLY_MUTATION_REF);
  const snoozeTour = useWidgetMutation(SNOOZE_TOUR_MUTATION_REF);
  const restartTour = useWidgetMutation(RESTART_TOUR_MUTATION_REF);
  const skipTourStep = useWidgetMutation(SKIP_TOUR_STEP_MUTATION_REF);
  const checkpointTour = useWidgetMutation(CHECKPOINT_TOUR_MUTATION_REF);

  return {
    advanceTour,
    checkpointTour,
    dismissPermanently,
    dismissTour,
    restartTour,
    skipTourStep,
    snoozeTour,
  };
}
