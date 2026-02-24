import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { getPortalTarget } from "./portal";
import { useMutation } from "convex/react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";

type StepType = "pointer" | "post" | "video";
type Position = "auto" | "left" | "right" | "above" | "below";
type Size = "small" | "large";
type AdvanceOn = "click" | "elementClick" | "fieldFill";
type DiagnosticReason =
  | "mode_mismatch"
  | "element_click_required"
  | "field_fill_required"
  | "field_fill_invalid"
  | "route_mismatch"
  | "checkpoint_invalid_route"
  | "selector_missing";

interface TourStep {
  _id: Id<"tourSteps">;
  tourId: Id<"tours">;
  type: StepType;
  order: number;
  title?: string;
  content: string;
  elementSelector?: string;
  routePath?: string;
  position?: Position;
  size?: Size;
  advanceOn?: AdvanceOn;
  customButtonText?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
}

interface Tour {
  _id: Id<"tours">;
  name: string;
  displayMode?: "first_time_only" | "until_dismissed";
  buttonColor?: string;
  showConfetti?: boolean;
  allowSnooze?: boolean;
  allowRestart?: boolean;
}

interface TourData {
  tour: Tour;
  steps: TourStep[];
  progress?: {
    currentStep: number;
    status: string;
    checkpointRoute?: string;
    checkpointSelector?: string;
  };
}

interface TourOverlayProps {
  workspaceId: Id<"workspaces">;
  visitorId: Id<"visitors">;
  sessionToken?: string | null;
  availableTours: TourData[];
  forcedTourId?: Id<"tours"> | null;
  onTourComplete?: () => void;
  onTourDismiss?: () => void;
}

interface ElementPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TooltipPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  layout: "anchored" | "fallback";
}

interface VisualViewportBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

const SCROLL_SETTLE_DELAY_MS = 150;
const SCROLL_SETTLE_MAX_WAIT_MS = 1400;

function getVisualViewportBounds(): VisualViewportBounds {
  if (typeof window === "undefined") {
    return {
      top: 0,
      left: 0,
      width: 0,
      height: 0,
    };
  }

  const visualViewport = window.visualViewport;
  return {
    top: visualViewport?.offsetTop ?? 0,
    left: visualViewport?.offsetLeft ?? 0,
    width: visualViewport?.width ?? window.innerWidth,
    height: visualViewport?.height ?? window.innerHeight,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wildcardMatch(pattern: string, value: string): boolean {
  const regex = new RegExp(`^${escapeRegex(pattern).replace(/\\\*/g, ".*")}$`);
  return regex.test(value);
}

function evaluateRouteMatch(
  routePath: string | undefined,
  currentUrl: string
): { matches: boolean; invalidRoute: boolean } {
  const normalizedRoute = routePath?.trim();
  if (!normalizedRoute) {
    return { matches: true, invalidRoute: false };
  }

  let parsedCurrent: URL;
  try {
    parsedCurrent = new URL(currentUrl);
  } catch {
    return { matches: false, invalidRoute: false };
  }

  const currentAbsolute = `${parsedCurrent.origin}${parsedCurrent.pathname}${parsedCurrent.search}`;
  const currentPath = `${parsedCurrent.pathname}${parsedCurrent.search}`;

  if (/^https?:\/\//i.test(normalizedRoute)) {
    let parsedRoute: URL;
    try {
      parsedRoute = new URL(normalizedRoute);
    } catch {
      return { matches: false, invalidRoute: true };
    }

    const routeAbsolute = `${parsedRoute.origin}${parsedRoute.pathname}${parsedRoute.search}`;
    if (routeAbsolute.includes("*")) {
      return { matches: wildcardMatch(routeAbsolute, currentAbsolute), invalidRoute: false };
    }

    return { matches: routeAbsolute === currentAbsolute, invalidRoute: false };
  }

  if (normalizedRoute.startsWith("/")) {
    if (normalizedRoute.includes("*")) {
      return { matches: wildcardMatch(normalizedRoute, currentPath), invalidRoute: false };
    }

    return {
      matches: normalizedRoute === currentPath || normalizedRoute === parsedCurrent.pathname,
      invalidRoute: false,
    };
  }

  if (normalizedRoute.includes("*")) {
    return {
      matches:
        wildcardMatch(normalizedRoute, currentAbsolute) ||
        wildcardMatch(normalizedRoute, currentPath),
      invalidRoute: false,
    };
  }

  return {
    matches:
      normalizedRoute === currentAbsolute ||
      normalizedRoute === currentPath ||
      normalizedRoute === parsedCurrent.pathname,
    invalidRoute: false,
  };
}

function getBlockedReasonMessage(reason?: string | null): string | null {
  switch (reason) {
    case "mode_mismatch":
      return "This step needs a different interaction to continue.";
    case "element_click_required":
      return "Click the highlighted element to continue.";
    case "field_fill_required":
    case "field_fill_invalid":
      return "Fill in the highlighted field to continue.";
    case "route_mismatch":
      return "Navigate to the required page to continue this tour.";
    case "checkpoint_invalid_route":
      return "This tour step route is invalid and was skipped.";
    case "selector_missing":
      return "The target element was not found. The step was skipped.";
    default:
      return null;
  }
}

function getAdvanceGuidance(step?: TourStep): string | null {
  if (!step) return null;
  const mode = step.advanceOn ?? "click";
  if (mode === "elementClick") {
    return "Click the highlighted element to continue.";
  }
  if (mode === "fieldFill") {
    return "Fill in the highlighted field to continue.";
  }
  return null;
}

export function TourOverlay({
  workspaceId,
  visitorId,
  sessionToken,
  availableTours,
  forcedTourId,
  onTourComplete,
  onTourDismiss,
}: TourOverlayProps) {
  const [activeTour, setActiveTour] = useState<TourData | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [elementPosition, setElementPosition] = useState<ElementPosition | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [advanceHint, setAdvanceHint] = useState<string | null>(null);
  const [routeHint, setRouteHint] = useState<string | null>(null);
  const [failureHint, setFailureHint] = useState<string | null>(null);
  const [suppressedTourIds, setSuppressedTourIds] = useState<Set<string>>(new Set());
  const observerRef = useRef<MutationObserver | null>(null);
  const fieldListenerRef = useRef<(() => void) | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const skipInFlightRef = useRef(false);
  const skipHandledStepRef = useRef<string | null>(null);
  const routeCheckpointStepRef = useRef<string | null>(null);
  const checkpointStepRef = useRef<string | null>(null);
  const programmaticScrollInFlightRef = useRef(false);
  const scrollSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollForceRecomputeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTour = useMutation(api.tourProgress.start);
  const advanceTour = useMutation(api.tourProgress.advance);
  const dismissTour = useMutation(api.tourProgress.dismiss);
  const dismissPermanently = useMutation(api.tourProgress.dismissPermanently);
  const snoozeTour = useMutation(api.tourProgress.snooze);
  const restartTour = useMutation(api.tourProgress.restart);
  const skipTourStep = useMutation(api.tourProgress.skipStep);
  const checkpointTour = useMutation(api.tourProgress.checkpoint);

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
    if (forcedTourId) {
      const forcedTour = availableTours.find((t) => t.tour._id === forcedTourId);
      if (forcedTour) {
        if (activeTour?.tour._id === forcedTourId) return;

        unsuppressTour(forcedTourId);

        setActiveTour(forcedTour);
        setCurrentStepIndex(0);
        setAdvanceHint(null);
        setRouteHint(null);
        setFailureHint(null);
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
      if (!nextTour) return;

      const resumeIndex =
        nextTour.progress?.status === "in_progress"
          ? Math.max(0, Math.min(nextTour.progress.currentStep, nextTour.steps.length - 1))
          : 0;

      setActiveTour(nextTour);
      setCurrentStepIndex(resumeIndex);
      setAdvanceHint(null);
      setRouteHint(null);
      setFailureHint(null);
      startTour({
        workspaceId,
        visitorId,
        sessionToken: sessionToken ?? undefined,
        tourId: nextTour.tour._id,
        currentUrl: window.location.href,
      }).catch(console.error);
    }
  }, [
    availableTours,
    activeTour,
    workspaceId,
    visitorId,
    sessionToken,
    startTour,
    forcedTourId,
    suppressedTourIds,
    unsuppressTour,
  ]);

  const currentStep = activeTour?.steps[currentStepIndex];
  const isPointerStep = currentStep?.type === "pointer" || currentStep?.type === "video";

  const finalizeTourCompletion = useCallback(() => {
    if (!activeTour) return;

    if (activeTour.tour.showConfetti) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }

    setTimeout(
      () => {
        setActiveTour(null);
        setCurrentStepIndex(0);
        setAdvanceHint(null);
        setRouteHint(null);
        setFailureHint(null);
        onTourComplete?.();
      },
      activeTour.tour.showConfetti ? 3000 : 0
    );
  }, [activeTour, onTourComplete]);

  const moveToStepOrComplete = useCallback(
    (nextStepIndex: number, status?: string) => {
      if (!activeTour) return;

      if (status === "completed" || nextStepIndex >= activeTour.steps.length) {
        finalizeTourCompletion();
        return;
      }

      setCurrentStepIndex(nextStepIndex);
      setAdvanceHint(getAdvanceGuidance(activeTour.steps[nextStepIndex]));
      setRouteHint(null);
      setFailureHint(null);
      setShowMoreMenu(false);
    },
    [activeTour, finalizeTourCompletion]
  );

  const handleSkipCurrentStep = useCallback(
    async (reason: DiagnosticReason) => {
      if (!activeTour || !currentStep || skipInFlightRef.current) return;

      skipInFlightRef.current = true;
      skipHandledStepRef.current = currentStep._id;

      try {
        const result = (await skipTourStep({
          workspaceId,
          visitorId,
          sessionToken: sessionToken ?? undefined,
          tourId: activeTour.tour._id,
          reason,
          selector: currentStep.elementSelector,
          currentUrl: window.location.href,
        })) as { nextStep: number; status: string; reason: string };

        setAdvanceHint(getBlockedReasonMessage(result.reason));
        moveToStepOrComplete(result.nextStep, result.status);
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
      moveToStepOrComplete,
      sessionToken,
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
      if (!activeTour || !currentStep) return;

      fieldListenerRef.current?.();

      try {
        const mode = opts?.mode ?? "click";
        const result = (await advanceTour({
          workspaceId,
          visitorId,
          sessionToken: sessionToken ?? undefined,
          tourId: activeTour.tour._id,
          mode,
          targetMatched: opts?.targetMatched,
          fieldValue: opts?.fieldValue,
          selector: opts?.selector,
          currentUrl: window.location.href,
        })) as {
          advanced: boolean;
          blockedReason?: string | null;
          nextStep: number;
          status: string;
        };

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
      moveToStepOrComplete,
      sessionToken,
      visitorId,
      workspaceId,
    ]
  );

  useEffect(() => {
    if (!activeTour || !currentStep) return;

    if (checkpointStepRef.current === currentStep._id) {
      return;
    }

    checkpointStepRef.current = currentStep._id;
    checkpointTour({
      workspaceId,
      visitorId,
      sessionToken: sessionToken ?? undefined,
      tourId: activeTour.tour._id,
      currentUrl: window.location.href,
      selector: currentStep.elementSelector,
    }).catch(console.error);
  }, [activeTour, checkpointTour, currentStep, sessionToken, visitorId, workspaceId]);

  useEffect(() => {
    if (!currentStep) {
      skipHandledStepRef.current = null;
      routeCheckpointStepRef.current = null;
      checkpointStepRef.current = null;
      programmaticScrollInFlightRef.current = false;
      if (scrollSettleTimerRef.current) {
        clearTimeout(scrollSettleTimerRef.current);
        scrollSettleTimerRef.current = null;
      }
      if (scrollForceRecomputeTimerRef.current) {
        clearTimeout(scrollForceRecomputeTimerRef.current);
        scrollForceRecomputeTimerRef.current = null;
      }
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
  }, [currentStep]);

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
          checkpointTour({
            workspaceId,
            visitorId,
            sessionToken: sessionToken ?? undefined,
            tourId: activeTour.tour._id,
            currentUrl: window.location.href,
            selector: currentStep.elementSelector,
            blockedReason: routeResult.invalidRoute ? "checkpoint_invalid_route" : "route_mismatch",
            mode: "system",
          }).catch(console.error);
        }

        if (routeResult.invalidRoute && skipHandledStepRef.current !== currentStep._id) {
          void handleSkipCurrentStep("checkpoint_invalid_route");
        }

        return;
      }

      setRouteHint(null);
      routeCheckpointStepRef.current = null;

      if (!isPointerStep) {
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

      const viewportBottom = viewport.top + viewport.height;
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

      if (rect.top < viewport.top || rect.bottom > viewportBottom) {
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
      checkpointTour,
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

  const closeTourLocally = useCallback(() => {
    if (scrollSettleTimerRef.current) {
      clearTimeout(scrollSettleTimerRef.current);
      scrollSettleTimerRef.current = null;
    }
    if (scrollForceRecomputeTimerRef.current) {
      clearTimeout(scrollForceRecomputeTimerRef.current);
      scrollForceRecomputeTimerRef.current = null;
    }
    programmaticScrollInFlightRef.current = false;
    setActiveTour(null);
    setCurrentStepIndex(0);
    setElementPosition(null);
    setTooltipPosition(null);
    setAdvanceHint(null);
    setRouteHint(null);
    setFailureHint(null);
    setShowMoreMenu(false);
    onTourDismiss?.();
  }, [onTourDismiss]);

  const handleDismiss = async () => {
    if (!activeTour) return;
    const tourId = activeTour.tour._id;
    suppressTour(tourId);
    closeTourLocally();
    try {
      await dismissTour({
        workspaceId,
        visitorId,
        sessionToken: sessionToken ?? undefined,
        tourId,
      });
    } catch (error) {
      console.error("Failed to dismiss tour", error);
    }
  };

  const handleDismissPermanently = async () => {
    if (!activeTour) return;
    const tourId = activeTour.tour._id;
    suppressTour(tourId);
    closeTourLocally();
    try {
      await dismissPermanently({
        workspaceId,
        visitorId,
        sessionToken: sessionToken ?? undefined,
        tourId,
      });
    } catch (error) {
      console.error("Failed to dismiss tour permanently", error);
    }
  };

  const handleSnooze = async () => {
    if (!activeTour) return;
    const tourId = activeTour.tour._id;
    suppressTour(tourId);
    closeTourLocally();
    try {
      await snoozeTour({
        workspaceId,
        visitorId,
        sessionToken: sessionToken ?? undefined,
        tourId,
      });
    } catch (error) {
      console.error("Failed to snooze tour", error);
    }
  };

  const handleRestart = async () => {
    if (!activeTour) return;
    try {
      unsuppressTour(activeTour.tour._id);
      await restartTour({
        workspaceId,
        visitorId,
        sessionToken: sessionToken ?? undefined,
        tourId: activeTour.tour._id,
      });
      setCurrentStepIndex(0);
      setAdvanceHint(null);
      setRouteHint(null);
      setFailureHint(null);
      setShowMoreMenu(false);
    } catch (error) {
      console.error("Failed to restart tour", error);
      setFailureHint("We couldn't restart this tour right now. You can close it and try again.");
    }
  };

  const handleDismissPermanentlyWithClose = async () => {
    setShowMoreMenu(false);
    await handleDismissPermanently();
  };

  const handleSnoozeWithClose = async () => {
    setShowMoreMenu(false);
    await handleSnooze();
  };

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

  const buttonColor = activeTour.tour.buttonColor || "#792cd4";
  const isPostStep = currentStep.type === "post";
  const buttonText =
    currentStep.customButtonText ||
    (currentStepIndex === activeTour.steps.length - 1 ? "Done" : "Next");
  const canUseClickButton = (currentStep.advanceOn ?? "click") === "click";
  const showRecoveryModal = Boolean(
    !routeHint && (failureHint || (isPointerStep && elementPosition && !tooltipPosition))
  );

  return createPortal(
    <div className="opencom-tour-overlay" data-testid="tour-overlay">
      <button
        type="button"
        data-testid="tour-emergency-close"
        onClick={() => void handleDismiss()}
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 1000003,
          pointerEvents: "auto",
          border: "none",
          borderRadius: 999,
          background: "rgba(0, 0, 0, 0.8)",
          color: "#fff",
          padding: "8px 12px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Exit tour
      </button>

      {showRecoveryModal && (
        <div
          className="opencom-tour-modal"
          style={{ maxWidth: 460, zIndex: 1000002 }}
          data-testid="tour-recovery-hint"
        >
          <h3 className="opencom-tour-title">Tour paused</h3>
          <div className="opencom-tour-content">
            {failureHint ??
              "We couldn't render this tour step properly. You can retry, skip this step, or close the tour."}
          </div>
          <div className="opencom-tour-footer">
            <div className="opencom-tour-progress">
              {currentStepIndex + 1} / {activeTour.steps.length}
            </div>
            <div className="opencom-tour-actions">
              <button
                onClick={() => {
                  setFailureHint(null);
                  updateElementPosition();
                }}
                className="opencom-tour-btn-secondary"
              >
                Retry
              </button>
              <button
                onClick={() => void handleSkipCurrentStep("selector_missing")}
                className="opencom-tour-btn-secondary"
              >
                Skip step
              </button>
              <button
                onClick={() => void handleDismiss()}
                className="opencom-tour-btn-primary"
                style={{ backgroundColor: buttonColor }}
              >
                Close tour
              </button>
            </div>
          </div>
          <button
            onClick={() => void handleDismiss()}
            className="opencom-tour-close"
            aria-label="Dismiss tour"
          >
            ×
          </button>
        </div>
      )}

      {routeHint && (
        <div
          className="opencom-tour-modal"
          style={{ maxWidth: 420, zIndex: 1000001 }}
          data-testid="tour-route-hint"
        >
          <div className="opencom-tour-body">
            <h3 className="opencom-tour-title">Continue Tour</h3>
            <div className="opencom-tour-content">{routeHint}</div>
          </div>
          <div className="opencom-tour-footer">
            <div className="opencom-tour-progress">
              {currentStepIndex + 1} / {activeTour.steps.length}
            </div>
          </div>
          <button onClick={handleDismiss} className="opencom-tour-close" aria-label="Dismiss tour">
            ×
          </button>
        </div>
      )}

      {!routeHint && isPointerStep && elementPosition && (
        <div className="opencom-tour-backdrop">
          <svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0 }}>
            <defs>
              <mask id="tour-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x={elementPosition.left}
                  y={elementPosition.top}
                  width={elementPosition.width}
                  height={elementPosition.height}
                  rx="4"
                  fill="black"
                />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#tour-mask)" />
          </svg>

          <div
            className="opencom-tour-highlight"
            style={{
              top: elementPosition.top,
              left: elementPosition.left,
              width: elementPosition.width,
              height: elementPosition.height,
              borderColor: buttonColor,
            }}
          />
        </div>
      )}

      {!routeHint && isPostStep && (
        <div className="opencom-tour-backdrop opencom-tour-backdrop-full" />
      )}

      {!routeHint && isPointerStep && tooltipPosition && (
        <div
          className={`opencom-tour-tooltip opencom-tour-tooltip-${currentStep.size || "small"} ${
            tooltipPosition.layout === "fallback" ? "opencom-tour-tooltip-fallback" : ""
          }`}
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            width: tooltipPosition.width,
            maxHeight: tooltipPosition.maxHeight,
          }}
          data-testid="tour-step-card"
          data-tour-layout={tooltipPosition.layout}
        >
          <div className="opencom-tour-body">
            {currentStep.title && (
              <h3 className="opencom-tour-title" data-testid="tour-step-title">
                {currentStep.title}
              </h3>
            )}
            <div className="opencom-tour-content">{currentStep.content}</div>

            {currentStep.type === "video" && currentStep.mediaUrl && (
              <video
                src={currentStep.mediaUrl}
                autoPlay
                loop
                muted
                playsInline
                className="opencom-tour-video"
              />
            )}

            {advanceHint && (
              <div
                className="opencom-tour-content"
                style={{ marginTop: 8 }}
                data-testid="tour-advance-guidance"
              >
                {advanceHint}
              </div>
            )}
          </div>

          <div className="opencom-tour-footer">
            <div className="opencom-tour-progress" data-testid="tour-step-progress">
              {currentStepIndex + 1} / {activeTour.steps.length}
            </div>
            <div className="opencom-tour-actions">
              {hasSecondaryActions && (
                <div className="opencom-tour-more-container" ref={moreMenuRef}>
                  <button
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="opencom-tour-btn-more"
                    aria-label="More options"
                  >
                    ⋯
                  </button>
                  {showMoreMenu && (
                    <div className="opencom-tour-more-menu">
                      {activeTour.tour.displayMode === "until_dismissed" && (
                        <button onClick={handleDismissPermanentlyWithClose}>
                          Don&apos;t show again
                        </button>
                      )}
                      {activeTour.tour.allowSnooze && (
                        <button onClick={handleSnoozeWithClose}>Remind me later</button>
                      )}
                      {activeTour.tour.allowRestart && currentStepIndex > 0 && (
                        <button onClick={handleRestart}>Restart</button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {canUseClickButton && (
                <button
                  onClick={() => void handleNext({ mode: "click" })}
                  className="opencom-tour-btn-primary"
                  style={{ backgroundColor: buttonColor }}
                  data-testid="tour-primary-action"
                >
                  {buttonText}
                </button>
              )}
            </div>
          </div>

          <button onClick={handleDismiss} className="opencom-tour-close" aria-label="Dismiss tour">
            ×
          </button>
        </div>
      )}

      {!routeHint && isPostStep && (
        <div className="opencom-tour-modal" data-testid="tour-step-card">
          <div className="opencom-tour-body">
            {currentStep.title && (
              <h3 className="opencom-tour-title" data-testid="tour-step-title">
                {currentStep.title}
              </h3>
            )}

            {currentStep.mediaUrl && currentStep.mediaType === "image" && (
              <img src={currentStep.mediaUrl} alt="" className="opencom-tour-image" />
            )}
            {currentStep.mediaUrl && currentStep.mediaType === "video" && (
              <video
                src={currentStep.mediaUrl}
                autoPlay
                controls
                playsInline
                className="opencom-tour-video"
              />
            )}

            <div className="opencom-tour-content">{currentStep.content}</div>
            {advanceHint && (
              <div
                className="opencom-tour-content"
                style={{ marginTop: 8 }}
                data-testid="tour-advance-guidance"
              >
                {advanceHint}
              </div>
            )}
          </div>

          <div className="opencom-tour-footer">
            <div className="opencom-tour-progress" data-testid="tour-step-progress">
              {currentStepIndex + 1} / {activeTour.steps.length}
            </div>
            <div className="opencom-tour-actions">
              {hasSecondaryActions && (
                <div className="opencom-tour-more-container" ref={moreMenuRef}>
                  <button
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="opencom-tour-btn-more"
                    aria-label="More options"
                  >
                    ⋯
                  </button>
                  {showMoreMenu && (
                    <div className="opencom-tour-more-menu">
                      {activeTour.tour.displayMode === "until_dismissed" && (
                        <button onClick={handleDismissPermanentlyWithClose}>
                          Don&apos;t show again
                        </button>
                      )}
                      {activeTour.tour.allowSnooze && (
                        <button onClick={handleSnoozeWithClose}>Remind me later</button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {canUseClickButton && (
                <button
                  onClick={() => void handleNext({ mode: "click" })}
                  className="opencom-tour-btn-primary"
                  style={{ backgroundColor: buttonColor }}
                  data-testid="tour-primary-action"
                >
                  {buttonText}
                </button>
              )}
            </div>
          </div>

          <button onClick={handleDismiss} className="opencom-tour-close" aria-label="Dismiss tour">
            ×
          </button>
        </div>
      )}

      {showConfetti && (
        <div className="opencom-tour-confetti">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="opencom-confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                backgroundColor: ["#ff0", "#f0f", "#0ff", "#f00", "#0f0", "#00f"][
                  Math.floor(Math.random() * 6)
                ],
              }}
            />
          ))}
        </div>
      )}
    </div>,
    getPortalTarget()
  );
}
