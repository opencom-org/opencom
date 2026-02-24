import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { getPortalTarget } from "./portal";
import type { Id } from "@opencom/convex/dataModel";

type TriggerType = "hover" | "click" | "auto";

interface Tooltip {
  _id: Id<"tooltips">;
  name: string;
  elementSelector: string;
  content: string;
  triggerType: TriggerType;
}

interface TooltipOverlayProps {
  tooltips: Tooltip[];
}

interface ActiveTooltip {
  tooltip: Tooltip;
  position: { top: number; left: number };
  element: Element;
}

interface TooltipBinding {
  element: Element;
  triggerType: TriggerType;
  cleanup: () => void;
}

export function TooltipOverlay({ tooltips }: TooltipOverlayProps) {
  const [activeTooltips, setActiveTooltips] = useState<ActiveTooltip[]>([]);
  const [beaconElements, setBeaconElements] = useState<Map<string, Element>>(new Map());
  const observerRef = useRef<MutationObserver | null>(null);
  const reconcileFrameRef = useRef<number | null>(null);
  const bindingsRef = useRef<Map<string, TooltipBinding>>(new Map());

  const clearBindings = useCallback(() => {
    const bindings = bindingsRef.current;
    for (const binding of bindings.values()) {
      binding.cleanup();
    }
    bindings.clear();
  }, []);

  const calculatePosition = useCallback((element: Element): { top: number; left: number } => {
    const rect = element.getBoundingClientRect();
    const tooltipWidth = 250;
    const tooltipHeight = 100;

    let top = rect.bottom + 8;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;

    if (top + tooltipHeight > window.innerHeight) {
      top = rect.top - tooltipHeight - 8;
    }
    left = Math.max(10, Math.min(left, window.innerWidth - tooltipWidth - 10));

    return { top, left };
  }, []);

  const showTooltip = useCallback(
    (tooltip: Tooltip, element: Element) => {
      const position = calculatePosition(element);
      setActiveTooltips((prev) => {
        const index = prev.findIndex((item) => item.tooltip._id === tooltip._id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = { tooltip, element, position };
          return next;
        }
        return [...prev, { tooltip, element, position }];
      });
    },
    [calculatePosition]
  );

  const hideTooltip = useCallback((tooltipId: Id<"tooltips">) => {
    setActiveTooltips((prev) => prev.filter((item) => item.tooltip._id !== tooltipId));
  }, []);

  const attachBinding = useCallback(
    (tooltip: Tooltip, element: Element): (() => void) => {
      if (tooltip.triggerType === "hover") {
        const handleMouseEnter = () => showTooltip(tooltip, element);
        const handleMouseLeave = () => hideTooltip(tooltip._id);
        element.addEventListener("mouseenter", handleMouseEnter);
        element.addEventListener("mouseleave", handleMouseLeave);
        return () => {
          element.removeEventListener("mouseenter", handleMouseEnter);
          element.removeEventListener("mouseleave", handleMouseLeave);
        };
      }

      if (tooltip.triggerType === "auto") {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                showTooltip(tooltip, element);
              } else {
                hideTooltip(tooltip._id);
              }
            });
          },
          { threshold: 0.5 }
        );
        observer.observe(element);
        return () => observer.disconnect();
      }

      // click-triggered tooltips are opened from beacon buttons
      return () => {};
    },
    [hideTooltip, showTooltip]
  );

  const reconcileBindings = useCallback(() => {
    const tooltipIds = new Set<string>();
    const resolvedElements = new Map<string, Element>();
    const nextBeacons = new Map<string, Element>();

    for (const tooltip of tooltips) {
      const tooltipId = tooltip._id.toString();
      tooltipIds.add(tooltipId);
      const element = document.querySelector(tooltip.elementSelector);

      const existing = bindingsRef.current.get(tooltipId);
      if (!element) {
        if (existing) {
          existing.cleanup();
          bindingsRef.current.delete(tooltipId);
        }
        hideTooltip(tooltip._id);
        continue;
      }

      resolvedElements.set(tooltipId, element);
      if (tooltip.triggerType === "click") {
        nextBeacons.set(tooltipId, element);
      }

      const needsRebind =
        !existing || existing.element !== element || existing.triggerType !== tooltip.triggerType;
      if (needsRebind) {
        if (existing) {
          existing.cleanup();
        }
        bindingsRef.current.set(tooltipId, {
          element,
          triggerType: tooltip.triggerType,
          cleanup: attachBinding(tooltip, element),
        });
      }
    }

    // Remove bindings for deleted tooltips.
    for (const [tooltipId, binding] of bindingsRef.current.entries()) {
      if (tooltipIds.has(tooltipId)) continue;
      binding.cleanup();
      bindingsRef.current.delete(tooltipId);
    }

    setBeaconElements(nextBeacons);
    setActiveTooltips((prev) =>
      prev.flatMap((item) => {
        const tooltipId = item.tooltip._id.toString();
        const resolved = resolvedElements.get(tooltipId);
        if (!resolved || !document.body.contains(resolved)) {
          return [];
        }
        return [
          {
            ...item,
            element: resolved,
            position: calculatePosition(resolved),
          },
        ];
      })
    );
  }, [attachBinding, calculatePosition, hideTooltip, tooltips]);

  useEffect(() => {
    reconcileBindings();

    observerRef.current?.disconnect();
    observerRef.current = new MutationObserver(() => {
      if (reconcileFrameRef.current !== null) {
        return;
      }
      reconcileFrameRef.current = window.requestAnimationFrame(() => {
        reconcileFrameRef.current = null;
        reconcileBindings();
      });
    });
    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["id", "class", "style"],
    });

    return () => {
      if (reconcileFrameRef.current !== null) {
        window.cancelAnimationFrame(reconcileFrameRef.current);
        reconcileFrameRef.current = null;
      }
      observerRef.current?.disconnect();
      observerRef.current = null;
      clearBindings();
      setBeaconElements(new Map());
      setActiveTooltips([]);
    };
  }, [clearBindings, reconcileBindings]);

  useEffect(() => {
    const updatePositions = () => {
      setActiveTooltips((prev) =>
        prev.flatMap((item) => {
          if (!document.body.contains(item.element)) {
            return [];
          }
          return [
            {
              ...item,
              position: calculatePosition(item.element),
            },
          ];
        })
      );
    };

    window.addEventListener("scroll", updatePositions, { passive: true });
    window.addEventListener("resize", updatePositions);
    return () => {
      window.removeEventListener("scroll", updatePositions);
      window.removeEventListener("resize", updatePositions);
    };
  }, [calculatePosition]);

  const handleBeaconClick = (tooltip: Tooltip) => {
    const element = beaconElements.get(tooltip._id.toString());
    if (!element) {
      return;
    }

    const isActive = activeTooltips.some((item) => item.tooltip._id === tooltip._id);
    if (isActive) {
      hideTooltip(tooltip._id);
      return;
    }
    showTooltip(tooltip, element);
  };

  return createPortal(
    <>
      {Array.from(beaconElements.entries()).map(([tooltipId, element]) => {
        const tooltip = tooltips.find((item) => item._id.toString() === tooltipId);
        if (!tooltip) {
          return null;
        }

        const rect = element.getBoundingClientRect();
        const isActive = activeTooltips.some((item) => item.tooltip._id === tooltip._id);

        return (
          <button
            key={tooltipId}
            className={`opencom-tooltip-beacon ${isActive ? "opencom-tooltip-beacon-active" : ""}`}
            style={{
              position: "fixed",
              top: rect.top + rect.height / 2 - 8,
              left: rect.right + 4,
              zIndex: 9999990,
            }}
            onClick={() => handleBeaconClick(tooltip)}
            aria-label={`Show tooltip: ${tooltip.name}`}
          >
            <span className="opencom-beacon-dot" />
          </button>
        );
      })}

      {activeTooltips.map(({ tooltip, position }) => (
        <div
          key={tooltip._id}
          className="opencom-tooltip"
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            zIndex: 9999991,
          }}
        >
          <div className="opencom-tooltip-content">{tooltip.content}</div>
          {tooltip.triggerType === "click" && (
            <button
              className="opencom-tooltip-close"
              onClick={() => hideTooltip(tooltip._id)}
              aria-label="Close tooltip"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </>,
    getPortalTarget()
  );
}
