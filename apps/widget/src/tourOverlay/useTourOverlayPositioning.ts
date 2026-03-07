import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type {
  AdvanceOn,
  DiagnosticReason,
  ElementPosition,
  TooltipPosition,
  TourStep,
  VisualViewportBounds,
} from "./types";
import {
  clamp,
  getVisualViewportBounds,
  SCROLL_SETTLE_DELAY_MS,
  SCROLL_SETTLE_MAX_WAIT_MS,
} from "./viewport";
import { evaluateRouteMatch } from "@opencom/types";

interface UseTourOverlayPositioningOptions {
  currentStep: TourStep | null;
  isPointerStep: boolean;
  setElementPosition: Dispatch<SetStateAction<ElementPosition | null>>;
  setTooltipPosition: Dispatch<SetStateAction<TooltipPosition | null>>;
  setRouteHint: Dispatch<SetStateAction<string | null>>;
  setFailureHint: Dispatch<SetStateAction<string | null>>;
  checkpointCurrentStep: (opts?: {
    blockedReason?: DiagnosticReason;
    mode?: AdvanceOn;
    selector?: string;
  }) => void;
  handleNext: (opts?: {
    mode?: AdvanceOn;
    targetMatched?: boolean;
    fieldValue?: string;
    selector?: string;
  }) => void | Promise<void>;
  handleSkipCurrentStep: (reason: DiagnosticReason) => void | Promise<void>;
  fieldListenerRef: MutableRefObject<(() => void) | null>;
  routeCheckpointStepRef: MutableRefObject<string | null>;
  skipHandledStepRef: MutableRefObject<string | null>;
  pendingStepScrollRef: MutableRefObject<boolean>;
  programmaticScrollInFlightRef: MutableRefObject<boolean>;
  scrollSettleTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  scrollForceRecomputeTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

function clearTimer(timerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>) {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

function buildElementPosition(rect: DOMRect): ElementPosition {
  const highlightPadding = 8;
  return {
    top: rect.top - highlightPadding,
    left: rect.left - highlightPadding,
    width: rect.width + highlightPadding * 2,
    height: rect.height + highlightPadding * 2,
  };
}

function buildTooltipPosition(
  rect: DOMRect,
  viewport: VisualViewportBounds,
  step: TourStep
): TooltipPosition {
  const safePadding = 12;
  const viewportBottom = viewport.top + viewport.height;
  const viewportRight = viewport.left + viewport.width;
  const preferredTooltipWidth = step.size === "large" ? 400 : 300;
  const tooltipWidth = Math.max(
    240,
    Math.min(preferredTooltipWidth, viewport.width - safePadding * 2)
  );
  const tooltipMaxHeight = Math.max(180, viewport.height - safePadding * 2);
  const estimatedTooltipHeight = Math.max(180, Math.min(260, tooltipMaxHeight));
  const position = step.position || "auto";

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
    return {
      top: minTop,
      left: clamp(
        viewport.left + (viewport.width - fallbackWidth) / 2,
        minLeft,
        viewportRight - fallbackWidth - safePadding
      ),
      width: fallbackWidth,
      maxHeight: tooltipMaxHeight,
      layout: "fallback",
    };
  }

  return {
    top: clamp(tooltipTop, minTop, maxTop),
    left: clamp(tooltipLeft, minLeft, maxLeft),
    width: tooltipWidth,
    maxHeight: tooltipMaxHeight,
    layout: "anchored",
  };
}

function resolveTargetElement(selector: string): {
  element: Element | null;
  invalidSelector: boolean;
  error?: unknown;
} {
  try {
    return {
      element: document.querySelector(selector),
      invalidSelector: false,
    };
  } catch (error) {
    return {
      element: null,
      invalidSelector: true,
      error,
    };
  }
}

function scheduleForcedPositionUpdate(
  element: Element,
  programmaticScrollInFlightRef: MutableRefObject<boolean>,
  scrollSettleTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
  scrollForceRecomputeTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
  updateElementPosition: (opts?: { force?: boolean }) => void
) {
  programmaticScrollInFlightRef.current = true;
  clearTimer(scrollSettleTimerRef);
  clearTimer(scrollForceRecomputeTimerRef);
  scrollForceRecomputeTimerRef.current = setTimeout(() => {
    programmaticScrollInFlightRef.current = false;
    scrollForceRecomputeTimerRef.current = null;
    clearTimer(scrollSettleTimerRef);
    updateElementPosition({ force: true });
  }, SCROLL_SETTLE_MAX_WAIT_MS);
  element.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function useTourOverlayPositioning({
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
}: UseTourOverlayPositioningOptions) {
  const observerRef = useRef<MutationObserver | null>(null);

  const reportInvalidSelector = useCallback(
    (selector?: string, error?: unknown) => {
      if (selector) {
        console.error("Invalid tour selector", selector, error);
      }
      setFailureHint(
        "This tour step targets an invalid element selector. You can skip this step or close the tour."
      );
    },
    [setFailureHint]
  );

  const updateElementPosition = useCallback(
    (opts?: { force?: boolean }) => {
      const force = opts?.force ?? false;

      if (programmaticScrollInFlightRef.current && !force) {
        return;
      }

      if (!currentStep) {
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

      const target = resolveTargetElement(currentStep.elementSelector);
      if (target.invalidSelector) {
        reportInvalidSelector(currentStep.elementSelector, target.error);
        if (skipHandledStepRef.current !== currentStep._id) {
          void handleSkipCurrentStep("selector_missing");
        }
        return;
      }

      if (!target.element) {
        if (skipHandledStepRef.current !== currentStep._id) {
          void handleSkipCurrentStep("selector_missing");
        }
        return;
      }

      const rect = target.element.getBoundingClientRect();
      const viewport = getVisualViewportBounds();
      const viewportBottom = viewport.top + viewport.height;
      const requiresScroll = rect.top < viewport.top || rect.bottom > viewportBottom;

      if (pendingStepScrollRef.current && requiresScroll && !force) {
        setElementPosition(null);
        setTooltipPosition(null);
        if (!programmaticScrollInFlightRef.current) {
          scheduleForcedPositionUpdate(
            target.element,
            programmaticScrollInFlightRef,
            scrollSettleTimerRef,
            scrollForceRecomputeTimerRef,
            updateElementPosition
          );
        }
        return;
      }

      setElementPosition(buildElementPosition(rect));
      setTooltipPosition(buildTooltipPosition(rect, viewport, currentStep));
      pendingStepScrollRef.current = false;

      if (requiresScroll && !force && !programmaticScrollInFlightRef.current) {
        scheduleForcedPositionUpdate(
          target.element,
          programmaticScrollInFlightRef,
          scrollSettleTimerRef,
          scrollForceRecomputeTimerRef,
          updateElementPosition
        );
      }
    },
    [
      checkpointCurrentStep,
      currentStep,
      handleSkipCurrentStep,
      isPointerStep,
      pendingStepScrollRef,
      programmaticScrollInFlightRef,
      reportInvalidSelector,
      routeCheckpointStepRef,
      scrollForceRecomputeTimerRef,
      scrollSettleTimerRef,
      setElementPosition,
      setRouteHint,
      setTooltipPosition,
      skipHandledStepRef,
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

    const handleScroll = () => {
      if (programmaticScrollInFlightRef.current) {
        clearTimer(scrollSettleTimerRef);
        scrollSettleTimerRef.current = setTimeout(() => {
          programmaticScrollInFlightRef.current = false;
          scrollSettleTimerRef.current = null;
          clearTimer(scrollForceRecomputeTimerRef);
          updateElementPosition({ force: true });
        }, SCROLL_SETTLE_DELAY_MS);
        return;
      }

      updateElementPosition();
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, { passive: true });

    observerRef.current = new MutationObserver(handleMutation);
    observerRef.current.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
      observerRef.current?.disconnect();
      clearTimer(scrollSettleTimerRef);
      clearTimer(scrollForceRecomputeTimerRef);
      programmaticScrollInFlightRef.current = false;
    };
  }, [
    programmaticScrollInFlightRef,
    scrollForceRecomputeTimerRef,
    scrollSettleTimerRef,
    updateElementPosition,
  ]);

  useEffect(() => {
    if (!currentStep?.elementSelector || currentStep.advanceOn !== "elementClick") {
      return;
    }

    const target = resolveTargetElement(currentStep.elementSelector);
    if (target.invalidSelector) {
      reportInvalidSelector(currentStep.elementSelector, target.error);
      return;
    }
    if (!target.element) {
      return;
    }

    const handleClick = () => {
      void handleNext({
        mode: "elementClick",
        targetMatched: true,
        selector: currentStep.elementSelector,
      });
    };

    target.element.addEventListener("click", handleClick);
    return () => target.element?.removeEventListener("click", handleClick);
  }, [currentStep, handleNext, reportInvalidSelector]);

  useEffect(() => {
    if (!currentStep?.elementSelector || currentStep.advanceOn !== "fieldFill") {
      return;
    }

    const target = resolveTargetElement(currentStep.elementSelector);
    if (target.invalidSelector) {
      reportInvalidSelector(currentStep.elementSelector, target.error);
      return;
    }

    const fieldElement = target.element as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
      | HTMLElement
      | null;
    if (!fieldElement) {
      return;
    }

    let handled = false;
    const checkValue = () => {
      if (handled) {
        return;
      }
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

    const removeListeners = () => {
      fieldElement.removeEventListener("input", checkValue);
      fieldElement.removeEventListener("change", checkValue);
      if (fieldListenerRef.current === removeListeners) {
        fieldListenerRef.current = null;
      }
    };

    fieldElement.addEventListener("input", checkValue);
    fieldElement.addEventListener("change", checkValue);
    fieldListenerRef.current = removeListeners;

    return removeListeners;
  }, [currentStep, fieldListenerRef, handleNext, reportInvalidSelector]);

  return {
    updateElementPosition,
  };
}
