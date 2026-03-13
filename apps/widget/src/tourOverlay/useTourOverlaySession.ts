import { useCallback, useEffect, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { Id } from "@opencom/convex/dataModel";
import { getAdvanceGuidance } from "./messages";
import type { ElementPosition, TooltipPosition, TourData } from "./types";
import { useWidgetMutation, widgetMutationRef } from "../lib/convex/hooks";

const startTourProgressMutationRef = widgetMutationRef<
  {
    workspaceId: Id<"workspaces">;
    visitorId: Id<"visitors">;
    sessionToken?: string;
    tourId: Id<"tours">;
    force?: boolean;
    currentUrl: string;
  },
  null
>("tourProgress:start");

interface OverlayUiSetters {
  setElementPosition: Dispatch<SetStateAction<ElementPosition | null>>;
  setTooltipPosition: Dispatch<SetStateAction<TooltipPosition | null>>;
  setShowConfetti: Dispatch<SetStateAction<boolean>>;
  setShowMoreMenu: Dispatch<SetStateAction<boolean>>;
  setAdvanceHint: Dispatch<SetStateAction<string | null>>;
  setRouteHint: Dispatch<SetStateAction<string | null>>;
  setFailureHint: Dispatch<SetStateAction<string | null>>;
}

interface OverlayRefs {
  skipHandledStepRef: MutableRefObject<string | null>;
  routeCheckpointStepRef: MutableRefObject<string | null>;
  checkpointStepRef: MutableRefObject<string | null>;
  pendingStepScrollRef: MutableRefObject<boolean>;
  programmaticScrollInFlightRef: MutableRefObject<boolean>;
  scrollSettleTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  scrollForceRecomputeTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

interface UseTourOverlaySessionOptions extends OverlayUiSetters, OverlayRefs {
  workspaceId: Id<"workspaces">;
  visitorId: Id<"visitors">;
  sessionToken?: string | null;
  availableTours: TourData[];
  forcedTourId?: Id<"tours"> | null;
  allowBlockingTour: boolean;
  onBlockingActiveChange?: (isActive: boolean) => void;
  onTourComplete?: () => void;
  onTourDismiss?: () => void;
}

function clearScrollTimers(
  scrollSettleTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
  scrollForceRecomputeTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>
) {
  if (scrollSettleTimerRef.current) {
    clearTimeout(scrollSettleTimerRef.current);
    scrollSettleTimerRef.current = null;
  }
  if (scrollForceRecomputeTimerRef.current) {
    clearTimeout(scrollForceRecomputeTimerRef.current);
    scrollForceRecomputeTimerRef.current = null;
  }
}

export function useTourOverlaySession({
  workspaceId,
  visitorId,
  sessionToken,
  availableTours,
  forcedTourId,
  allowBlockingTour,
  onBlockingActiveChange,
  onTourComplete,
  onTourDismiss,
  setElementPosition,
  setTooltipPosition,
  setShowConfetti,
  setShowMoreMenu,
  setAdvanceHint,
  setRouteHint,
  setFailureHint,
  skipHandledStepRef,
  routeCheckpointStepRef,
  checkpointStepRef,
  pendingStepScrollRef,
  programmaticScrollInFlightRef,
  scrollSettleTimerRef,
  scrollForceRecomputeTimerRef,
}: UseTourOverlaySessionOptions) {
  const [activeTour, setActiveTour] = useState<TourData | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [suppressedTourIds, setSuppressedTourIds] = useState<Set<string>>(new Set());

  const startTour = useWidgetMutation(startTourProgressMutationRef);
  const currentStep = activeTour?.steps[currentStepIndex] ?? null;

  const resetFeedback = useCallback(() => {
    setAdvanceHint(null);
    setRouteHint(null);
    setFailureHint(null);
  }, [setAdvanceHint, setFailureHint, setRouteHint]);

  const suppressTour = useCallback((tourId: Id<"tours">) => {
    setSuppressedTourIds((prev) => {
      const key = String(tourId);
      if (prev.has(key)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const unsuppressTour = useCallback((tourId: Id<"tours">) => {
    setSuppressedTourIds((prev) => {
      const key = String(tourId);
      if (!prev.has(key)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  useEffect(() => {
    setSuppressedTourIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }

      const availableIds = new Set(availableTours.map((tourData) => String(tourData.tour._id)));
      const retained = Array.from(prev).filter((id) => availableIds.has(id));

      if (retained.length === prev.size) {
        return prev;
      }

      return new Set(retained);
    });
  }, [availableTours]);

  useEffect(() => {
    if (!allowBlockingTour && !activeTour) {
      return;
    }

    if (forcedTourId) {
      const forcedTour = availableTours.find((tourData) => tourData.tour._id === forcedTourId);
      if (forcedTour) {
        if (activeTour?.tour._id === forcedTourId) {
          return;
        }

        unsuppressTour(forcedTourId);
        setActiveTour(forcedTour);
        setCurrentStepIndex(0);
        resetFeedback();
        startTour({
          workspaceId,
          visitorId,
          sessionToken: sessionToken ?? undefined,
          tourId: forcedTour.tour._id,
          force: true,
          currentUrl: window.location.href,
        }).catch(console.error);
        return;
      }
    }

    if (availableTours.length > 0 && !activeTour && !forcedTourId) {
      const nextTour = availableTours.find(
        (tourData) => tourData.steps.length > 0 && !suppressedTourIds.has(String(tourData.tour._id))
      );
      if (!nextTour) {
        return;
      }

      const resumeIndex =
        nextTour.progress?.status === "in_progress"
          ? Math.max(0, Math.min(nextTour.progress.currentStep, nextTour.steps.length - 1))
          : 0;

      setActiveTour(nextTour);
      setCurrentStepIndex(resumeIndex);
      resetFeedback();
      startTour({
        workspaceId,
        visitorId,
        sessionToken: sessionToken ?? undefined,
        tourId: nextTour.tour._id,
        currentUrl: window.location.href,
      }).catch(console.error);
    }
  }, [
    activeTour,
    allowBlockingTour,
    availableTours,
    forcedTourId,
    resetFeedback,
    sessionToken,
    startTour,
    suppressedTourIds,
    unsuppressTour,
    visitorId,
    workspaceId,
  ]);

  useEffect(() => {
    onBlockingActiveChange?.(Boolean(activeTour));
  }, [activeTour, onBlockingActiveChange]);

  useEffect(() => {
    return () => {
      onBlockingActiveChange?.(false);
    };
  }, [onBlockingActiveChange]);

  const finalizeTourCompletion = useCallback(() => {
    if (!activeTour) {
      return;
    }

    if (activeTour.tour.showConfetti) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }

    setTimeout(
      () => {
        setActiveTour(null);
        setCurrentStepIndex(0);
        resetFeedback();
        onTourComplete?.();
      },
      activeTour.tour.showConfetti ? 3000 : 0
    );
  }, [activeTour, onTourComplete, resetFeedback, setShowConfetti]);

  const moveToStepOrComplete = useCallback(
    (nextStepIndex: number, status?: string) => {
      if (!activeTour) {
        return;
      }

      if (status === "completed" || nextStepIndex >= activeTour.steps.length) {
        finalizeTourCompletion();
        return;
      }

      if (nextStepIndex !== currentStepIndex) {
        pendingStepScrollRef.current = true;
        setElementPosition(null);
        setTooltipPosition(null);
      } else {
        pendingStepScrollRef.current = false;
      }

      setCurrentStepIndex(nextStepIndex);
      setAdvanceHint(getAdvanceGuidance(activeTour.steps[nextStepIndex]));
      setRouteHint(null);
      setFailureHint(null);
      setShowMoreMenu(false);
    },
    [
      activeTour,
      currentStepIndex,
      finalizeTourCompletion,
      pendingStepScrollRef,
      setAdvanceHint,
      setElementPosition,
      setFailureHint,
      setRouteHint,
      setShowMoreMenu,
      setTooltipPosition,
    ]
  );

  const closeTourLocally = useCallback(() => {
    clearScrollTimers(scrollSettleTimerRef, scrollForceRecomputeTimerRef);
    programmaticScrollInFlightRef.current = false;
    pendingStepScrollRef.current = false;
    setActiveTour(null);
    setCurrentStepIndex(0);
    setElementPosition(null);
    setTooltipPosition(null);
    resetFeedback();
    setShowMoreMenu(false);
    onTourDismiss?.();
  }, [
    onTourDismiss,
    pendingStepScrollRef,
    programmaticScrollInFlightRef,
    resetFeedback,
    scrollForceRecomputeTimerRef,
    scrollSettleTimerRef,
    setElementPosition,
    setShowMoreMenu,
    setTooltipPosition,
  ]);

  useEffect(() => {
    if (!currentStep) {
      skipHandledStepRef.current = null;
      routeCheckpointStepRef.current = null;
      checkpointStepRef.current = null;
      pendingStepScrollRef.current = false;
      programmaticScrollInFlightRef.current = false;
      clearScrollTimers(scrollSettleTimerRef, scrollForceRecomputeTimerRef);
      return;
    }

    if (skipHandledStepRef.current !== currentStep._id) {
      skipHandledStepRef.current = null;
    }
    if (routeCheckpointStepRef.current !== currentStep._id) {
      routeCheckpointStepRef.current = null;
    }

    setAdvanceHint(getAdvanceGuidance(currentStep));
    setFailureHint(null);
  }, [
    checkpointStepRef,
    currentStep,
    pendingStepScrollRef,
    programmaticScrollInFlightRef,
    routeCheckpointStepRef,
    scrollForceRecomputeTimerRef,
    scrollSettleTimerRef,
    setAdvanceHint,
    setFailureHint,
    skipHandledStepRef,
  ]);

  return {
    activeTour,
    currentStep,
    currentStepIndex,
    setCurrentStepIndex,
    suppressTour,
    unsuppressTour,
    moveToStepOrComplete,
    closeTourLocally,
  };
}
