import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { scoreSelectorQuality, type SelectorQualityMetadata } from "@opencom/sdk-core";
import type { Id } from "@opencom/convex/dataModel";

interface TooltipAuthoringOverlayProps {
  token: string;
  workspaceId: Id<"workspaces">;
  onExit: () => void;
}

interface ElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function generateSelector(element: Element): string {
  // Priority 1: data-tooltip-target or data-opencom-* attributes
  const tooltipTarget = element.getAttribute("data-tooltip-target");
  if (tooltipTarget) {
    return `[data-tooltip-target="${tooltipTarget}"]`;
  }

  for (const attr of element.attributes) {
    if (attr.name.startsWith("data-opencom-")) {
      return `[${attr.name}="${attr.value}"]`;
    }
  }

  // Priority 2: id attribute
  if (element.id) {
    const selector = `#${CSS.escape(element.id)}`;
    if (document.querySelectorAll(selector).length === 1) {
      return selector;
    }
  }

  // Priority 3: Unique class combinations
  if (element.classList.length > 0) {
    const classes = Array.from(element.classList)
      .filter((c) => !c.match(/^(hover|focus|active|disabled)/))
      .slice(0, 3);

    if (classes.length > 0) {
      const selector = `.${classes.map((c) => CSS.escape(c)).join(".")}`;
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }
  }

  // Priority 4: Tag + nth-child path (fallback)
  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    const currentElement = current;

    if (current.id) {
      selector = `#${CSS.escape(current.id)}`;
      path.unshift(selector);
      break;
    }

    const parent: Element | null = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (child: Element) => child.tagName === currentElement.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    current = parent;
  }

  return path.join(" > ");
}

export function TooltipAuthoringOverlay({
  token,
  workspaceId,
  onExit,
}: TooltipAuthoringOverlayProps) {
  const [, setHoveredElement] = useState<Element | null>(null);
  const [hoveredRect, setHoveredRect] = useState<ElementRect | null>(null);
  const [selectedElement, setSelectedElement] = useState<Element | null>(null);
  const [selectedRect, setSelectedRect] = useState<ElementRect | null>(null);
  const [selectedSelector, setSelectedSelector] = useState<string>("");
  const [selectorQuality, setSelectorQuality] = useState<SelectorQualityMetadata | null>(null);
  const [isSelecting, setIsSelecting] = useState(true);
  const [previewPosition, setPreviewPosition] = useState<{ top: number; left: number } | null>(
    null
  );
  const overlayRef = useRef<HTMLDivElement>(null);

  const sessionData = useQuery(api.tooltipAuthoringSessions.validate, { token, workspaceId });
  const updateSelectorMutation = useMutation(api.tooltipAuthoringSessions.updateSelector);
  const endSessionMutation = useMutation(api.tooltipAuthoringSessions.end);

  const tooltip = sessionData?.valid ? sessionData.tooltip : null;

  // Update preview position when selected element changes
  useEffect(() => {
    if (!selectedRect) {
      setPreviewPosition(null);
      return;
    }

    const tooltipWidth = 250;
    const tooltipHeight = 100;

    let top = selectedRect.top + selectedRect.height + window.scrollY + 12;
    let left = selectedRect.left + window.scrollX + selectedRect.width / 2 - tooltipWidth / 2;

    // Keep within viewport
    if (top + tooltipHeight > window.innerHeight + window.scrollY) {
      top = selectedRect.top + window.scrollY - tooltipHeight - 12;
    }
    left = Math.max(10, Math.min(left, window.innerWidth - tooltipWidth - 10));

    setPreviewPosition({ top, left });
  }, [selectedRect]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isSelecting) return;

      // Ignore our own overlay elements
      const target = e.target as Element;
      if (target.closest(".opencom-tooltip-authoring-overlay")) return;

      setHoveredElement(target);
      const rect = target.getBoundingClientRect();
      setHoveredRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    },
    [isSelecting]
  );

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (!isSelecting) return;

      const target = e.target as Element;
      if (target.closest(".opencom-tooltip-authoring-overlay")) return;

      e.preventDefault();
      e.stopPropagation();

      const selector = generateSelector(target);
      const matchCount = (() => {
        try {
          return document.querySelectorAll(selector).length;
        } catch {
          return 0;
        }
      })();
      const quality = scoreSelectorQuality(selector, { matchCount });

      setSelectedElement(target);
      const rect = target.getBoundingClientRect();
      setSelectedRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
      setSelectedSelector(selector);
      setSelectorQuality(quality);
      setIsSelecting(false);
      setHoveredElement(null);
      setHoveredRect(null);
    },
    [isSelecting]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedElement) {
          // Cancel selection
          setSelectedElement(null);
          setSelectedRect(null);
          setSelectedSelector("");
          setSelectorQuality(null);
          setIsSelecting(true);
        } else {
          onExit();
        }
      }
    },
    [selectedElement, onExit]
  );

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleMouseMove, handleClick, handleKeyDown]);

  const handleConfirmSelector = async () => {
    if (!selectedSelector) return;

    try {
      await updateSelectorMutation({
        token,
        workspaceId,
        elementSelector: selectedSelector,
        selectorQuality: selectorQuality ?? undefined,
      });

      await endSessionMutation({ token, workspaceId });
      onExit();
    } catch (error) {
      console.error("Failed to save selector:", error);
      alert("Failed to save selector");
    }
  };

  const handleCancelSelection = () => {
    setSelectedElement(null);
    setSelectedRect(null);
    setSelectedSelector("");
    setSelectorQuality(null);
    setIsSelecting(true);
  };

  const handleExit = async () => {
    await endSessionMutation({ token, workspaceId }).catch(() => {});
    onExit();
  };

  if (!sessionData) {
    return (
      <div className="opencom-tooltip-authoring-overlay opencom-authoring-loading">
        <div className="opencom-authoring-spinner" />
        <span>Loading authoring session...</span>
      </div>
    );
  }

  if (!sessionData.valid) {
    return (
      <div
        className="opencom-tooltip-authoring-overlay opencom-authoring-error"
        data-testid="tooltip-authoring-session-error"
      >
        <div className="opencom-authoring-error-content">
          <h3>Session Error</h3>
          <p>{sessionData.reason}</p>
          <button onClick={onExit} className="opencom-authoring-btn">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="opencom-tooltip-authoring-overlay" ref={overlayRef}>
      {/* Toolbar */}
      <div className="opencom-authoring-toolbar">
        <div className="opencom-authoring-toolbar-left">
          <span className="opencom-authoring-logo">Opencom</span>
          <span className="opencom-authoring-tour-name">
            {tooltip ? `Tooltip: ${tooltip.name}` : "Select Element for Tooltip"}
          </span>
        </div>
        <div className="opencom-authoring-toolbar-right">
          <button onClick={handleExit} className="opencom-authoring-exit-btn">
            Cancel
          </button>
        </div>
      </div>

      {/* Instructions panel */}
      <div className="opencom-authoring-step-panel">
        <div className="opencom-authoring-step-header">
          <span className="opencom-authoring-step-type">Visual Picker</span>
          <span className="opencom-authoring-step-title">Select Target Element</span>
        </div>
        {tooltip?.elementSelector && (
          <div className="opencom-authoring-current-selector">
            <span>Current selector:</span>
            <code>{tooltip.elementSelector}</code>
          </div>
        )}
        {isSelecting && (
          <div className="opencom-authoring-instruction">
            Click on an element to select it as the tooltip target
          </div>
        )}
      </div>

      {/* Hover highlight */}
      {hoveredRect && isSelecting && (
        <div
          className="opencom-authoring-hover-highlight"
          style={{
            top: hoveredRect.top,
            left: hoveredRect.left,
            width: hoveredRect.width,
            height: hoveredRect.height,
          }}
        />
      )}

      {/* Selected element highlight */}
      {selectedRect && (
        <div
          className="opencom-authoring-selected-highlight"
          style={{
            top: selectedRect.top,
            left: selectedRect.left,
            width: selectedRect.width,
            height: selectedRect.height,
          }}
        />
      )}

      {/* Selection confirmation panel */}
      {selectedElement && (
        <div className="opencom-authoring-confirm-panel">
          <h4>Selected Element</h4>
          <div className="opencom-authoring-selector-display">
            <code>{selectedSelector}</code>
          </div>
          {selectorQuality && (
            <div className="opencom-authoring-warnings">
              <div
                className="opencom-authoring-warning"
                data-testid="tooltip-authoring-quality-summary"
              >
                Quality: {selectorQuality.grade} ({selectorQuality.score})
              </div>
              {selectorQuality.warnings.map((warning, i) => (
                <div
                  key={i}
                  className="opencom-authoring-warning"
                  data-testid="tooltip-authoring-warning"
                >
                  ⚠️ {warning}
                </div>
              ))}
            </div>
          )}
          <div className="opencom-authoring-confirm-actions">
            <button
              onClick={handleCancelSelection}
              className="opencom-authoring-btn opencom-authoring-btn-secondary"
            >
              Pick Different Element
            </button>
            <button
              onClick={handleConfirmSelector}
              className="opencom-authoring-btn opencom-authoring-btn-primary"
            >
              Confirm Selection
            </button>
          </div>
        </div>
      )}

      {/* Tooltip preview */}
      {selectedRect && previewPosition && tooltip && (
        <div
          className="opencom-tooltip-authoring-preview"
          style={{ top: previewPosition.top, left: previewPosition.left }}
        >
          <div className="opencom-tooltip-content">{tooltip.content}</div>
          <div className="opencom-authoring-preview-footer">
            <span>Preview</span>
          </div>
        </div>
      )}
    </div>
  );
}
