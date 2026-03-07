import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { getPortalTarget } from "./portal";
import { evaluateRouteMatch } from "@opencom/types";
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
import { useTourOverlaySession } from "./tourOverlay/useTourOverlaySession";
import {
  clamp,
  getVisualViewportBounds,
  SCROLL_SETTLE_DELAY_MS,
  SCROLL_SETTLE_MAX_WAIT_MS,
} from "./tourOverlay/viewport";

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
  const observerRef = useRef<MutationObserver | null>(null);
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

  const updateElementPosition = useCallback(
    (opts?: { force?: boolean }) => {
      const force = opts?.force ?? false;

      if (programmaticScrollInFlightRef.current && !force) {
        return;
      }

      if (!activeTour || !currentStep) {
        setElementPosition(null);
        setTooltipPosition(null);
        setRouteHint(null);
        return;
      }

      const routeResult = evaluateRouteMatch(currentStep.routePath, window.location.href);
      if (!routeResult.matches) {
        setElementPosition(null);
        setTooltipPosition(null);

        const hintTarget = currentStep.routePath?.trim() || "the required page";
        setRouteHint(`Continue this tour on ${hintTarget}.`);

        if (routeCheckpointStepRef.current !== currentStep._id) {
          routeCheckpointStepRef.current = currentStep._id;
          checkpointCurrentStep({
            blockedReason: routeResult.invalidRoute ? "checkpoint_invalid_route" : "route_mismatch",
            mode: "system",
          });
        }

        if (routeResult.invalidRoute && skipHandledStepRef.current !== currentStep._id) {
          void handleSkipCurrentStep("checkpoint_invalid_route");
        }

        return;
      }

      setRouteHint(null);
      routeCheckpointStepRef.current = null;

      if (!isPointerStep) {
        pendingStepScrollRef.current = false;
        setElementPosition(null);
        setTooltipPosition(null);
        return;
      }

      if (!currentStep.elementSelector) {
        if (skipHandledStepRef.current !== currentStep._id) {
          void handleSkipCurrentStep("selector_missing");
        }
        return;
      }

      let element: Element | null = null;
      try {
        element = document.querySelector(currentStep.elementSelector);
      } catch (error) {
        console.error("Invalid tour selector", currentStep.elementSelector, error);
        setFailureHint(
          "This tour step targets an invalid element selector. You can skip this step or close the tour."
        );
        if (skipHandledStepRef.current !== currentStep._id) {
          void handleSkipCurrentStep("selector_missing");
        }
        return;
      }

      if (!element) {
        if (skipHandledStepRef.current !== currentStep._id) {
          void handleSkipCurrentStep("selector_missing");
        }
        return;
      }

      const rect = element.getBoundingClientRect();
      const viewport = getVisualViewportBounds();
      const highlightPadding = 8;
      const safePadding = 12;
      const viewportBottom = viewport.top + viewport.height;
      const requiresScroll = rect.top < viewport.top || rect.bottom > viewportBottom;

      if (pendingStepScrollRef.current && requiresScroll && !force) {
        setElementPosition(null);
        setTooltipPosition(null);
        if (!programmaticScrollInFlightRef.current) {
          programmaticScrollInFlightRef.current = true;
          if (scrollSettleTimerRef.current) {
            clearTimeout(scrollSettleTimerRef.current);
            scrollSettleTimerRef.current = null;
          }
          if (scrollForceRecomputeTimerRef.current) {
            clearTimeout(scrollForceRecomputeTimerRef.current);
          }
          scrollForceRecomputeTimerRef.current = setTimeout(() => {
            programmaticScrollInFlightRef.current = false;
            scrollForceRecomputeTimerRef.current = null;
            if (scrollSettleTimerRef.current) {
              clearTimeout(scrollSettleTimerRef.current);
              scrollSettleTimerRef.current = null;
            }
            updateElementPosition({ force: true });
          }, SCROLL_SETTLE_MAX_WAIT_MS);
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      setElementPosition({
        top: rect.top - highlightPadding,
        left: rect.left - highlightPadding,
        width: rect.width + highlightPadding * 2,
        height: rect.height + highlightPadding * 2,
      });

      const preferredTooltipWidth = currentStep.size === "large" ? 400 : 300;
      const tooltipWidth = Math.max(
        240,
        Math.min(preferredTooltipWidth, viewport.width - safePadding * 2)
      );
      const tooltipMaxHeight = Math.max(180, viewport.height - safePadding * 2);
      const estimatedTooltipHeight = Math.max(180, Math.min(260, tooltipMaxHeight));
      const position = currentStep.position || "auto";

      const viewportRight = viewport.left + viewport.width;
      const spaceBelow = viewportBottom - rect.bottom;
      const spaceAbove = rect.top - viewport.top;
      const spaceRight = viewportRight - rect.right;
      const spaceLeft = rect.left - viewport.left;

      let tooltipTop = 0;
      let tooltipLeft = 0;

      if (position === "auto") {
        if (spaceBelow >= estimatedTooltipHeight + 20) {
          tooltipTop = rect.bottom + 12;
          tooltipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
        } else if (spaceAbove >= estimatedTooltipHeight + 20) {
          tooltipTop = rect.top - estimatedTooltipHeight - 12;
          tooltipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
        } else if (spaceRight >= tooltipWidth + 20) {
          tooltipTop = rect.top + rect.height / 2 - estimatedTooltipHeight / 2;
          tooltipLeft = rect.right + 12;
        } else {
          tooltipTop = rect.top + rect.height / 2 - estimatedTooltipHeight / 2;
          tooltipLeft = rect.left - tooltipWidth - 12;
        }
      } else {
        switch (position) {
          case "below":
            tooltipTop = rect.bottom + 12;
            tooltipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
            break;
          case "above":
            tooltipTop = rect.top - estimatedTooltipHeight - 12;
            tooltipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
            break;
          case "right":
            tooltipTop = rect.top + rect.height / 2 - estimatedTooltipHeight / 2;
            tooltipLeft = rect.right + 12;
            break;
          case "left":
            tooltipTop = rect.top + rect.height / 2 - estimatedTooltipHeight / 2;
            tooltipLeft = rect.left - tooltipWidth - 12;
            break;
        }
      }

      const minLeft = viewport.left + safePadding;
      const maxLeft = viewportRight - tooltipWidth - safePadding;
      const minTop = viewport.top + safePadding;
      const maxTop = viewportBottom - estimatedTooltipHeight - safePadding;

      const shouldFallbackToViewport =
        viewport.width < 280 ||
        viewport.height < 240 ||
        maxLeft < minLeft ||
        maxTop < minTop ||
        (spaceBelow < 120 && spaceAbove < 120 && spaceRight < 160 && spaceLeft < 160);

      if (shouldFallbackToViewport) {
        const fallbackWidth = Math.max(
          220,
          Math.min(preferredTooltipWidth, viewport.width - safePadding * 2)
        );
        setTooltipPosition({
          top: minTop,
          left: clamp(
            viewport.left + (viewport.width - fallbackWidth) / 2,
            minLeft,
            viewportRight - fallbackWidth - safePadding
          ),
          width: fallbackWidth,
          maxHeight: tooltipMaxHeight,
          layout: "fallback",
        });
      } else {
        setTooltipPosition({
          top: clamp(tooltipTop, minTop, maxTop),
          left: clamp(tooltipLeft, minLeft, maxLeft),
          width: tooltipWidth,
          maxHeight: tooltipMaxHeight,
          layout: "anchored",
        });
      }
      pendingStepScrollRef.current = false;

      if (requiresScroll) {
        if (!force && !programmaticScrollInFlightRef.current) {
          programmaticScrollInFlightRef.current = true;
          if (scrollSettleTimerRef.current) {
            clearTimeout(scrollSettleTimerRef.current);
            scrollSettleTimerRef.current = null;
          }
          if (scrollForceRecomputeTimerRef.current) {
            clearTimeout(scrollForceRecomputeTimerRef.current);
          }
          scrollForceRecomputeTimerRef.current = setTimeout(() => {
            programmaticScrollInFlightRef.current = false;
            scrollForceRecomputeTimerRef.current = null;
            if (scrollSettleTimerRef.current) {
              clearTimeout(scrollSettleTimerRef.current);
              scrollSettleTimerRef.current = null;
            }
            updateElementPosition({ force: true });
          }, SCROLL_SETTLE_MAX_WAIT_MS);
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    },
    [
      activeTour,
      checkpointCurrentStep,
      currentStep,
      handleSkipCurrentStep,
      isPointerStep,
      sessionToken,
      visitorId,
      workspaceId,
    ]
  );

  useEffect(() => {
    updateElementPosition();

    const handleResize = () => {
      updateElementPosition();
    };

    const handleMutation: MutationCallback = () => {
      updateElementPosition();
    };

    window.addEventListener("resize", handleResize);

    const handleScroll = () => {
      if (programmaticScrollInFlightRef.current) {
        if (scrollSettleTimerRef.current) {
          clearTimeout(scrollSettleTimerRef.current);
        }
        scrollSettleTimerRef.current = setTimeout(() => {
          programmaticScrollInFlightRef.current = false;
          scrollSettleTimerRef.current = null;
          if (scrollForceRecomputeTimerRef.current) {
            clearTimeout(scrollForceRecomputeTimerRef.current);
            scrollForceRecomputeTimerRef.current = null;
          }
          updateElementPosition({ force: true });
        }, SCROLL_SETTLE_DELAY_MS);
        return;
      }

      updateElementPosition();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    observerRef.current = new MutationObserver(handleMutation);
    observerRef.current.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
      observerRef.current?.disconnect();
      if (scrollSettleTimerRef.current) {
        clearTimeout(scrollSettleTimerRef.current);
        scrollSettleTimerRef.current = null;
      }
      if (scrollForceRecomputeTimerRef.current) {
        clearTimeout(scrollForceRecomputeTimerRef.current);
        scrollForceRecomputeTimerRef.current = null;
      }
      programmaticScrollInFlightRef.current = false;
    };
  }, [updateElementPosition]);

  useEffect(() => {
    if (!currentStep?.elementSelector || currentStep.advanceOn !== "elementClick") return;

    let element: Element | null = null;
    try {
      element = document.querySelector(currentStep.elementSelector);
    } catch (error) {
      console.error("Invalid tour selector", currentStep.elementSelector, error);
      setFailureHint(
        "This tour step targets an invalid element selector. You can skip this step or close the tour."
      );
      return;
    }

    if (!element) return;

    const handleClick = () => {
      void handleNext({
        mode: "elementClick",
        targetMatched: true,
        selector: currentStep.elementSelector,
      });
    };

    element.addEventListener("click", handleClick);
    return () => element.removeEventListener("click", handleClick);
  }, [currentStep, handleNext]);

  useEffect(() => {
    if (!currentStep?.elementSelector || currentStep.advanceOn !== "fieldFill") return;

    let element: Element | null = null;
    try {
      element = document.querySelector(currentStep.elementSelector);
    } catch (error) {
      console.error("Invalid tour selector", currentStep.elementSelector, error);
      setFailureHint(
        "This tour step targets an invalid element selector. You can skip this step or close the tour."
      );
      return;
    }

    const fieldElement = element as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
      | HTMLElement
      | null;
    if (!fieldElement) return;

    let handled = false;
    const checkValue = () => {
      if (handled) return;
      const value =
        "value" in fieldElement
          ? String(fieldElement.value ?? "")
          : (fieldElement.textContent ?? "");
      if (value.trim().length > 0) {
        handled = true;
        void handleNext({
          mode: "fieldFill",
          fieldValue: value,
          selector: currentStep.elementSelector,
        });
      }
    };

    fieldElement.addEventListener("input", checkValue);
    fieldElement.addEventListener("change", checkValue);

    fieldListenerRef.current = () => {
      fieldElement.removeEventListener("input", checkValue);
      fieldElement.removeEventListener("change", checkValue);
    };

    return () => fieldListenerRef.current?.();
  }, [currentStep, handleNext]);

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
