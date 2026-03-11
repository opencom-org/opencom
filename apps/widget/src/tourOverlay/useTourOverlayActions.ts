import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { Id } from "@opencom/convex/dataModel";
import { useTourProgressConvex } from "../hooks/convex/useTourProgressConvex";
import { getAdvanceGuidance, getBlockedReasonMessage } from "./messages";
import type { AdvanceOn, DiagnosticReason, TourData, TourStep } from "./types";

interface UseTourOverlayActionsOptions {
  workspaceId: Id<"workspaces">;
  visitorId: Id<"visitors">;
  sessionToken?: string | null;
  activeTour: TourData | null;
  currentStep: TourStep | null;
  currentStepIndex: number;
  setCurrentStepIndex: Dispatch<SetStateAction<number>>;
  setAdvanceHint: Dispatch<SetStateAction<string | null>>;
  setRouteHint: Dispatch<SetStateAction<string | null>>;
  setFailureHint: Dispatch<SetStateAction<string | null>>;
  setShowMoreMenu: Dispatch<SetStateAction<boolean>>;
  suppressTour: (tourId: Id<"tours">) => void;
  unsuppressTour: (tourId: Id<"tours">) => void;
  moveToStepOrComplete: (nextStepIndex: number, status?: string) => void;
  closeTourLocally: () => void;
  checkpointStepRef: MutableRefObject<string | null>;
  pendingStepScrollRef: MutableRefObject<boolean>;
  skipInFlightRef: MutableRefObject<boolean>;
  skipHandledStepRef: MutableRefObject<string | null>;
  fieldListenerRef: MutableRefObject<(() => void) | null>;
}

export function useTourOverlayActions({
  workspaceId,
  visitorId,
  sessionToken,
  activeTour,
  currentStep,
  currentStepIndex,
  setCurrentStepIndex,
  setAdvanceHint,
  setRouteHint,
  setFailureHint,
  setShowMoreMenu,
  suppressTour,
  unsuppressTour,
  moveToStepOrComplete,
  closeTourLocally,
  checkpointStepRef,
  pendingStepScrollRef,
  skipInFlightRef,
  skipHandledStepRef,
  fieldListenerRef,
}: UseTourOverlayActionsOptions) {
  const {
    advanceTour,
    checkpointTour,
    dismissPermanently,
    dismissTour,
    restartTour,
    skipTourStep,
    snoozeTour,
  } = useTourProgressConvex();

  const checkpointCurrentStep = useCallback(
    (opts?: {
      blockedReason?: DiagnosticReason;
      mode?: AdvanceOn;
      selector?: string;
    }) => {
      if (!activeTour || !currentStep) {
        return;
      }

      checkpointTour({
        workspaceId,
        visitorId,
        sessionToken: sessionToken ?? undefined,
        tourId: activeTour.tour._id,
        currentUrl: window.location.href,
        selector: opts?.selector ?? currentStep.elementSelector,
        blockedReason: opts?.blockedReason,
        mode: opts?.mode,
      }).catch(console.error);
    },
    [activeTour, checkpointTour, currentStep, sessionToken, visitorId, workspaceId]
  );

  const handleSkipCurrentStep = useCallback(
    async (reason: DiagnosticReason) => {
      if (!activeTour || !currentStep || skipInFlightRef.current) {
        return;
      }

      skipInFlightRef.current = true;
      skipHandledStepRef.current = currentStep._id;

      try {
        const result = await skipTourStep({
          workspaceId,
          visitorId,
          sessionToken: sessionToken ?? undefined,
          tourId: activeTour.tour._id,
          reason,
          selector: currentStep.elementSelector,
          currentUrl: window.location.href,
        });

        const fallbackNextStep = currentStepIndex + 1;
        const nextStep =
          result && typeof result.nextStep === "number" ? result.nextStep : fallbackNextStep;
        const status = result && typeof result.status === "string" ? result.status : undefined;
        setAdvanceHint(getBlockedReasonMessage(result?.reason ?? reason));
        moveToStepOrComplete(nextStep, status);
      } catch (error) {
        console.error("Failed to skip tour step", error);
        setFailureHint(
          "We couldn't recover this tour step automatically. You can retry, skip again, or close the tour."
        );
      } finally {
        skipInFlightRef.current = false;
      }
    },
    [
      activeTour,
      currentStep,
      currentStepIndex,
      moveToStepOrComplete,
      sessionToken,
      setAdvanceHint,
      setFailureHint,
      skipHandledStepRef,
      skipInFlightRef,
      skipTourStep,
      visitorId,
      workspaceId,
    ]
  );

  const handleNext = useCallback(
    async (opts?: {
      mode?: AdvanceOn;
      targetMatched?: boolean;
      fieldValue?: string;
      selector?: string;
    }) => {
      if (!activeTour || !currentStep) {
        return;
      }

      fieldListenerRef.current?.();

      try {
        const mode = opts?.mode ?? "click";
        const result = await advanceTour({
          workspaceId,
          visitorId,
          sessionToken: sessionToken ?? undefined,
          tourId: activeTour.tour._id,
          mode,
          targetMatched: opts?.targetMatched,
          fieldValue: opts?.fieldValue,
          selector: opts?.selector,
          currentUrl: window.location.href,
        });

        if (!result.advanced) {
          setAdvanceHint(
            getBlockedReasonMessage(result.blockedReason) ?? getAdvanceGuidance(currentStep)
          );
          return;
        }

        setAdvanceHint(null);
        setFailureHint(null);
        moveToStepOrComplete(result.nextStep, result.status);
      } catch (error) {
        console.error("Failed to advance tour step", error);
        setFailureHint(
          "Something went wrong while moving to the next step. You can retry, skip this step, or close the tour."
        );
      }
    },
    [
      activeTour,
      advanceTour,
      currentStep,
      fieldListenerRef,
      moveToStepOrComplete,
      sessionToken,
      setAdvanceHint,
      setFailureHint,
      visitorId,
      workspaceId,
    ]
  );

  useEffect(() => {
    if (!activeTour || !currentStep) {
      return;
    }

    if (checkpointStepRef.current === currentStep._id) {
      return;
    }

    checkpointStepRef.current = currentStep._id;
    checkpointCurrentStep();
  }, [activeTour, checkpointCurrentStep, checkpointStepRef, currentStep]);

  const closeAndPersistTour = useCallback(
    async (
      persistAction: (tourId: Id<"tours">) => Promise<unknown>,
      errorMessage: string
    ) => {
      if (!activeTour) {
        return;
      }

      const tourId = activeTour.tour._id;
      suppressTour(tourId);
      closeTourLocally();
      try {
        await persistAction(tourId);
      } catch (error) {
        console.error(errorMessage, error);
      }
    },
    [activeTour, closeTourLocally, suppressTour]
  );

  const handleDismiss = useCallback(async () => {
    await closeAndPersistTour(
      (tourId) =>
        dismissTour({
          workspaceId,
          visitorId,
          sessionToken: sessionToken ?? undefined,
          tourId,
        }),
      "Failed to dismiss tour"
    );
  }, [closeAndPersistTour, dismissTour, sessionToken, visitorId, workspaceId]);

  const handleDismissPermanently = useCallback(async () => {
    await closeAndPersistTour(
      (tourId) =>
        dismissPermanently({
          workspaceId,
          visitorId,
          sessionToken: sessionToken ?? undefined,
          tourId,
        }),
      "Failed to dismiss tour permanently"
    );
  }, [closeAndPersistTour, dismissPermanently, sessionToken, visitorId, workspaceId]);

  const handleSnooze = useCallback(async () => {
    await closeAndPersistTour(
      (tourId) =>
        snoozeTour({
          workspaceId,
          visitorId,
          sessionToken: sessionToken ?? undefined,
          tourId,
        }),
      "Failed to snooze tour"
    );
  }, [closeAndPersistTour, sessionToken, snoozeTour, visitorId, workspaceId]);

  const handleRestart = useCallback(async () => {
    if (!activeTour) {
      return;
    }

    try {
      unsuppressTour(activeTour.tour._id);
      await restartTour({
        workspaceId,
        visitorId,
        sessionToken: sessionToken ?? undefined,
        tourId: activeTour.tour._id,
      });
      pendingStepScrollRef.current = false;
      setCurrentStepIndex(0);
      setAdvanceHint(null);
      setRouteHint(null);
      setFailureHint(null);
      setShowMoreMenu(false);
    } catch (error) {
      console.error("Failed to restart tour", error);
      setFailureHint("We couldn't restart this tour right now. You can close it and try again.");
    }
  }, [
    activeTour,
    pendingStepScrollRef,
    restartTour,
    sessionToken,
    setAdvanceHint,
    setCurrentStepIndex,
    setFailureHint,
    setRouteHint,
    setShowMoreMenu,
    unsuppressTour,
    visitorId,
    workspaceId,
  ]);

  const handleDismissPermanentlyWithClose = useCallback(async () => {
    setShowMoreMenu(false);
    await handleDismissPermanently();
  }, [handleDismissPermanently, setShowMoreMenu]);

  const handleSnoozeWithClose = useCallback(async () => {
    setShowMoreMenu(false);
    await handleSnooze();
  }, [handleSnooze, setShowMoreMenu]);

  return {
    checkpointCurrentStep,
    handleDismiss,
    handleDismissPermanentlyWithClose,
    handleNext,
    handleRestart,
    handleSkipCurrentStep,
    handleSnoozeWithClose,
  };
}
