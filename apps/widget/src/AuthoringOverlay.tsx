import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import { scoreSelectorQuality } from "@opencom/sdk-core";

interface TourStep {
  _id: Id<"tourSteps">;
  tourId: Id<"tours">;
  type: "pointer" | "post" | "video";
  order: number;
  title?: string;
  content: string;
  elementSelector?: string;
  routePath?: string;
  position?: "auto" | "left" | "right" | "above" | "below";
  size?: "small" | "large";
}

interface AuthoringOverlayProps {
  token: string;
  onExit: () => void;
}

interface ElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function generateSelector(element: Element): string {
  // Priority 1: data-tour-target or data-opencom-* attributes
  const tourTarget = element.getAttribute("data-tour-target");
  if (tourTarget) {
    return `[data-tour-target="${tourTarget}"]`;
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

function getSelectorWarnings(selector: string): string[] {
  const warnings: string[] = [];

  const matches = document.querySelectorAll(selector);
  if (matches.length === 0) {
    warnings.push("Selector matches no elements");
  } else if (matches.length > 1) {
    warnings.push(`Selector matches ${matches.length} elements (should match exactly 1)`);
  }

  // Check for fragile selectors
  if (selector.includes(":nth-of-type") || selector.includes(":nth-child")) {
    warnings.push(
      "Selector uses position-based matching which may break if page structure changes. Consider adding data-tour-target attribute."
    );
  }

  if (selector.split(" > ").length > 4) {
    warnings.push(
      "Selector path is deep and may be fragile. Consider adding data-tour-target attribute."
    );
  }

  return warnings;
}

export function AuthoringOverlay({ token, onExit }: AuthoringOverlayProps) {
  const [, setHoveredElement] = useState<Element | null>(null);
  const [hoveredRect, setHoveredRect] = useState<ElementRect | null>(null);
  const [selectedElement, setSelectedElement] = useState<Element | null>(null);
  const [selectedRect, setSelectedRect] = useState<ElementRect | null>(null);
  const [selectedSelector, setSelectedSelector] = useState<string>("");
  const [selectorWarnings, setSelectorWarnings] = useState<string[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSelecting, setIsSelecting] = useState(true);
  const [previewPosition, setPreviewPosition] = useState<{ top: number; left: number } | null>(
    null
  );
  const overlayRef = useRef<HTMLDivElement>(null);

  const sessionData = useQuery(api.authoringSessions.validate, { token });
  const updateStepMutation = useMutation(api.authoringSessions.updateStep);
  const setCurrentStepMutation = useMutation(api.authoringSessions.setCurrentStep);
  const endSessionMutation = useMutation(api.authoringSessions.end);

  const steps = useMemo(
    () => (sessionData?.valid ? (sessionData.steps ?? []) : []),
    [sessionData?.valid, sessionData?.steps]
  );
  const tour = sessionData?.valid ? sessionData.tour : null;
  const currentStep = steps[currentStepIndex] as TourStep | undefined;

  // Set initial step from session
  useEffect(() => {
    if (sessionData?.valid && sessionData.session && sessionData.session.stepId) {
      const stepIndex = steps.findIndex((s: TourStep) => s._id === sessionData.session.stepId);
      if (stepIndex !== -1) {
        setCurrentStepIndex(stepIndex);
      }
    }
  }, [sessionData, steps]);

  // Update preview position when selected element changes
  useEffect(() => {
    if (!selectedRect || !currentStep) {
      setPreviewPosition(null);
      return;
    }

    const tooltipWidth = currentStep.size === "large" ? 400 : 300;
    const tooltipHeight = 200;
    const position = currentStep.position || "auto";

    let top = 0;
    let left = 0;

    if (position === "auto" || position === "below") {
      top = selectedRect.top + selectedRect.height + window.scrollY + 12;
      left = selectedRect.left + window.scrollX + selectedRect.width / 2 - tooltipWidth / 2;
    } else if (position === "above") {
      top = selectedRect.top + window.scrollY - tooltipHeight - 12;
      left = selectedRect.left + window.scrollX + selectedRect.width / 2 - tooltipWidth / 2;
    } else if (position === "right") {
      top = selectedRect.top + window.scrollY + selectedRect.height / 2 - tooltipHeight / 2;
      left = selectedRect.left + window.scrollX + selectedRect.width + 12;
    } else if (position === "left") {
      top = selectedRect.top + window.scrollY + selectedRect.height / 2 - tooltipHeight / 2;
      left = selectedRect.left + window.scrollX - tooltipWidth - 12;
    }

    left = Math.max(10, Math.min(left, window.innerWidth - tooltipWidth - 10));
    top = Math.max(10, top);

    setPreviewPosition({ top, left });
  }, [selectedRect, currentStep]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isSelecting) return;

      // Ignore our own overlay elements
      const target = e.target as Element;
      if (target.closest(".opencom-authoring-overlay")) return;

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
      if (target.closest(".opencom-authoring-overlay")) return;

      e.preventDefault();
      e.stopPropagation();

      const selector = generateSelector(target);
      const warnings = getSelectorWarnings(selector);

      setSelectedElement(target);
      const rect = target.getBoundingClientRect();
      setSelectedRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
      setSelectedSelector(selector);
      setSelectorWarnings(warnings);
      setIsSelecting(false);
      setHoveredElement(null);
      setHoveredRect(null);
    },
    [isSelecting]
  );

  const handleCancelSelection = useCallback(() => {
    setSelectedElement(null);
    setSelectedRect(null);
    setSelectedSelector("");
    setSelectorWarnings([]);
    setIsSelecting(true);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedElement) {
          handleCancelSelection();
        } else {
          onExit();
        }
      }
    },
    [handleCancelSelection, onExit, selectedElement]
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

  const handleConfirmSelector = useCallback(async () => {
    if (!currentStep || !selectedSelector) return;

    try {
      await updateStepMutation({
        token,
        stepId: currentStep._id,
        elementSelector: selectedSelector,
        currentUrl: window.location.href,
        selectorQuality: scoreSelectorQuality(selectedSelector),
      });

      // Move to next step or finish
      if (currentStepIndex < steps.length - 1) {
        const nextIndex = currentStepIndex + 1;
        setCurrentStepIndex(nextIndex);
        await setCurrentStepMutation({ token, stepId: steps[nextIndex]._id });
      }

      handleCancelSelection();
    } catch (error) {
      console.error("Failed to save selector:", error);
      alert("Failed to save selector");
    }
  }, [
    currentStep,
    selectedSelector,
    updateStepMutation,
    token,
    currentStepIndex,
    steps,
    setCurrentStepMutation,
    handleCancelSelection,
  ]);

  const handlePreviousStep = useCallback(async () => {
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      setCurrentStepIndex(prevIndex);
      await setCurrentStepMutation({ token, stepId: steps[prevIndex]._id });
      handleCancelSelection();
    }
  }, [currentStepIndex, handleCancelSelection, setCurrentStepMutation, steps, token]);

  const handleNextStep = useCallback(async () => {
    if (currentStepIndex < steps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      await setCurrentStepMutation({ token, stepId: steps[nextIndex]._id });
      handleCancelSelection();
    }
  }, [currentStepIndex, handleCancelSelection, setCurrentStepMutation, steps, token]);

  const handleExit = useCallback(async () => {
    await endSessionMutation({ token });
    onExit();
  }, [endSessionMutation, onExit, token]);

  if (!sessionData) {
    return (
      <div className="opencom-authoring-overlay opencom-authoring-loading">
        <div className="opencom-authoring-spinner" />
        <span>Loading authoring session...</span>
      </div>
    );
  }

  if (!sessionData.valid) {
    return (
      <div className="opencom-authoring-overlay opencom-authoring-error">
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

  const buttonColor = tour?.buttonColor || "#792cd4";

  return (
    <div className="opencom-authoring-overlay" ref={overlayRef}>
      {/* Toolbar */}
      <div className="opencom-authoring-toolbar">
        <div className="opencom-authoring-toolbar-left">
          <span className="opencom-authoring-logo">Opencom</span>
          <span className="opencom-authoring-tour-name">{tour?.name}</span>
        </div>
        <div className="opencom-authoring-toolbar-center">
          <button
            onClick={handlePreviousStep}
            disabled={currentStepIndex === 0}
            className="opencom-authoring-nav-btn"
          >
            ← Previous
          </button>
          <span className="opencom-authoring-step-indicator">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
          <button
            onClick={handleNextStep}
            disabled={currentStepIndex >= steps.length - 1}
            className="opencom-authoring-nav-btn"
          >
            Next →
          </button>
        </div>
        <div className="opencom-authoring-toolbar-right">
          <button onClick={handleExit} className="opencom-authoring-exit-btn">
            Exit Authoring
          </button>
        </div>
      </div>

      {/* Step info panel */}
      <div className="opencom-authoring-step-panel">
        <div className="opencom-authoring-step-header">
          <span className="opencom-authoring-step-type">{currentStep?.type}</span>
          <span className="opencom-authoring-step-title">
            {currentStep?.title || "Untitled Step"}
          </span>
        </div>
        <div className="opencom-authoring-step-content">{currentStep?.content}</div>
        {currentStep?.elementSelector && (
          <div className="opencom-authoring-current-selector">
            <span>Current selector:</span>
            <code>{currentStep.elementSelector}</code>
          </div>
        )}
        {currentStep?.routePath && (
          <div className="opencom-authoring-current-selector">
            <span>Step route:</span>
            <code>{currentStep.routePath}</code>
          </div>
        )}
        {isSelecting && (currentStep?.type === "pointer" || currentStep?.type === "video") && (
          <div className="opencom-authoring-instruction">
            Click on an element to select it for this step
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
            borderColor: buttonColor,
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
          {selectorWarnings.length > 0 && (
            <div className="opencom-authoring-warnings">
              {selectorWarnings.map((warning, i) => (
                <div key={i} className="opencom-authoring-warning">
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
              Cancel
            </button>
            <button
              onClick={handleConfirmSelector}
              className="opencom-authoring-btn opencom-authoring-btn-primary"
              style={{ backgroundColor: buttonColor }}
            >
              Confirm Selection
            </button>
          </div>
        </div>
      )}

      {/* Step preview tooltip */}
      {selectedRect && previewPosition && currentStep && (
        <div
          className={`opencom-authoring-preview-tooltip opencom-authoring-preview-${currentStep.size || "small"}`}
          style={{ top: previewPosition.top, left: previewPosition.left }}
        >
          {currentStep.title && (
            <h3 className="opencom-authoring-preview-title">{currentStep.title}</h3>
          )}
          <div className="opencom-authoring-preview-content">{currentStep.content}</div>
          <div className="opencom-authoring-preview-footer">
            <span>Preview</span>
          </div>
        </div>
      )}
    </div>
  );
}
