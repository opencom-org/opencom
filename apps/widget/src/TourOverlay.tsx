import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { getPortalTarget } from "./portal";
import { useMutation } from "convex/react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
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
import { getAdvanceGuidance, getBlockedReasonMessage } from "./tourOverlay/messages";
import { evaluateRouteMatch } from "./tourOverlay/routeMatching";
import type {
  AdvanceOn,
  DiagnosticReason,
  ElementPosition,
  TooltipPosition,
  TourData,
  TourOverlayProps,
} from "./tourOverlay/types";
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
  const pendingStepScrollRef = useRef(false);
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
    if (!allowBlockingTour && !activeTour) {
      return;
    }

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
    allowBlockingTour,
  ]);

  useEffect(() => {
    onBlockingActiveChange?.(Boolean(activeTour));
  }, [activeTour, onBlockingActiveChange]);

  useEffect(() => {
    return () => {
      onBlockingActiveChange?.(false);
    };
  }, [onBlockingActiveChange]);

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
    [activeTour, currentStepIndex, finalizeTourCompletion]
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
        })) as { nextStep?: number; status?: string; reason?: string } | null | undefined;

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
      moveToStepOrComplete,
      currentStepIndex,
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
      pendingStepScrollRef.current = false;
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
    pendingStepScrollRef.current = false;
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
