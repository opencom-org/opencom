import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { getPortalTarget } from "./portal";
import {
  TourConfettiLayer,
  TourEmergencyCloseButton,
  TourPointerBackdrop,
  TourPointerStepCard,
  TourPostBackdrop,
  TourPostStepCard,
  TourRecoveryModal,
  TourRouteHintModal,
} from "./tourOverlay/components";
import type {
  ElementPosition,
  TooltipPosition,
  TourOverlayProps,
} from "./tourOverlay/types";
import { useTourOverlayActions } from "./tourOverlay/useTourOverlayActions";
import { useTourOverlayPositioning } from "./tourOverlay/useTourOverlayPositioning";
import { useTourOverlaySession } from "./tourOverlay/useTourOverlaySession";

export function TourOverlay({
  workspaceId,
  visitorId,
  sessionToken,
  availableTours,
  forcedTourId,
  allowBlockingTour = true,
  onBlockingActiveChange,
  onTourComplete,
  onTourDismiss,
}: TourOverlayProps) {
  const [elementPosition, setElementPosition] = useState<ElementPosition | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [advanceHint, setAdvanceHint] = useState<string | null>(null);
  const [routeHint, setRouteHint] = useState<string | null>(null);
  const [failureHint, setFailureHint] = useState<string | null>(null);
  const fieldListenerRef = useRef<(() => void) | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const skipInFlightRef = useRef(false);
  const skipHandledStepRef = useRef<string | null>(null);
  const routeCheckpointStepRef = useRef<string | null>(null);
  const checkpointStepRef = useRef<string | null>(null);
  const pendingStepScrollRef = useRef(false);
  const programmaticScrollInFlightRef = useRef(false);
  const scrollSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollForceRecomputeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    activeTour,
    currentStep,
    currentStepIndex,
    setCurrentStepIndex,
    suppressTour,
    unsuppressTour,
    moveToStepOrComplete,
    closeTourLocally,
  } = useTourOverlaySession({
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
  });
  const isPointerStep = currentStep?.type === "pointer" || currentStep?.type === "video";
  const {
    checkpointCurrentStep,
    handleDismiss,
    handleDismissPermanentlyWithClose,
    handleNext,
    handleRestart,
    handleSkipCurrentStep,
    handleSnoozeWithClose,
  } = useTourOverlayActions({
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
  });
  const { updateElementPosition } = useTourOverlayPositioning({
    currentStep,
    isPointerStep,
    setElementPosition,
    setTooltipPosition,
    setRouteHint,
    setFailureHint,
    checkpointCurrentStep,
    handleNext,
    handleSkipCurrentStep,
    fieldListenerRef,
    routeCheckpointStepRef,
    skipHandledStepRef,
    pendingStepScrollRef,
    programmaticScrollInFlightRef,
    scrollSettleTimerRef,
    scrollForceRecomputeTimerRef,
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMoreMenu]);

  const hasSecondaryActions =
    activeTour?.tour.displayMode === "until_dismissed" ||
    activeTour?.tour.allowSnooze ||
    (activeTour?.tour.allowRestart && currentStepIndex > 0);

  if (!activeTour || !currentStep) return null;

  const totalSteps = activeTour.steps.length;
  const buttonColor = activeTour.tour.buttonColor || "#792cd4";
  const isPostStep = currentStep.type === "post";
  const buttonText =
    currentStep.customButtonText || (currentStepIndex === totalSteps - 1 ? "Done" : "Next");
  const canUseClickButton = (currentStep.advanceOn ?? "click") === "click";
  const showRecoveryModal = Boolean(
    !routeHint && (failureHint || (isPointerStep && elementPosition && !tooltipPosition))
  );
  const showDontShowAgain = activeTour.tour.displayMode === "until_dismissed";
  const showSnooze = Boolean(activeTour.tour.allowSnooze);
  const showRestart = Boolean(activeTour.tour.allowRestart && currentStepIndex > 0);

  return createPortal(
    <div className="opencom-tour-overlay" data-testid="tour-overlay">
      <TourEmergencyCloseButton onDismiss={handleDismiss} />

      {showRecoveryModal && (
        <TourRecoveryModal
          failureHint={failureHint}
          currentStepIndex={currentStepIndex}
          totalSteps={totalSteps}
          buttonColor={buttonColor}
          onRetry={() => {
            setFailureHint(null);
            updateElementPosition();
          }}
          onSkipStep={() => handleSkipCurrentStep("selector_missing")}
          onDismiss={handleDismiss}
        />
      )}

      {routeHint && (
        <TourRouteHintModal
          routeHint={routeHint}
          currentStepIndex={currentStepIndex}
          totalSteps={totalSteps}
          onDismiss={handleDismiss}
        />
      )}

      {!routeHint && isPointerStep && elementPosition && (
        <TourPointerBackdrop elementPosition={elementPosition} buttonColor={buttonColor} />
      )}

      {!routeHint && isPostStep && <TourPostBackdrop />}

      {!routeHint && isPointerStep && tooltipPosition && (
        <TourPointerStepCard
          currentStep={currentStep}
          currentStepIndex={currentStepIndex}
          totalSteps={totalSteps}
          tooltipPosition={tooltipPosition}
          advanceHint={advanceHint}
          hasSecondaryActions={Boolean(hasSecondaryActions)}
          showMoreMenu={showMoreMenu}
          moreMenuRef={moreMenuRef}
          buttonColor={buttonColor}
          buttonText={buttonText}
          canUseClickButton={canUseClickButton}
          showDontShowAgain={showDontShowAgain}
          showSnooze={showSnooze}
          showRestart={showRestart}
          onToggleMoreMenu={() => setShowMoreMenu((prev) => !prev)}
          onDismissPermanentlyWithClose={handleDismissPermanentlyWithClose}
          onSnoozeWithClose={handleSnoozeWithClose}
          onRestart={handleRestart}
          onNextClick={() => handleNext({ mode: "click" })}
          onDismiss={handleDismiss}
        />
      )}

      {!routeHint && isPostStep && (
        <TourPostStepCard
          currentStep={currentStep}
          currentStepIndex={currentStepIndex}
          totalSteps={totalSteps}
          advanceHint={advanceHint}
          hasSecondaryActions={Boolean(hasSecondaryActions)}
          showMoreMenu={showMoreMenu}
          moreMenuRef={moreMenuRef}
          buttonColor={buttonColor}
          buttonText={buttonText}
          canUseClickButton={canUseClickButton}
          showDontShowAgain={showDontShowAgain}
          showSnooze={showSnooze}
          onToggleMoreMenu={() => setShowMoreMenu((prev) => !prev)}
          onDismissPermanentlyWithClose={handleDismissPermanentlyWithClose}
          onSnoozeWithClose={handleSnoozeWithClose}
          onNextClick={() => handleNext({ mode: "click" })}
          onDismiss={handleDismiss}
        />
      )}

      {showConfetti && <TourConfettiLayer />}
    </div>,
    getPortalTarget()
  );
}
