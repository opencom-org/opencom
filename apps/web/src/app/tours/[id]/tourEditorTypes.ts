import type { Doc } from "@opencom/convex/dataModel";
import { scoreSelectorQuality } from "@opencom/web-shared";

export type StepType = "pointer" | "post" | "video";
export type Position = "auto" | "left" | "right" | "above" | "below";
export type Size = "small" | "large";
export type AdvanceOn = "click" | "elementClick" | "fieldFill";
export type TourDisplayMode = "first_time_only" | "until_dismissed";

export interface StepFormData {
  type: StepType;
  title: string;
  content: string;
  elementSelector: string;
  routePath: string;
  position: Position;
  size: Size;
  advanceOn: AdvanceOn;
  customButtonText: string;
  mediaUrl: string;
  mediaType: "image" | "video" | "";
}

export type TourEditorTour = Doc<"tours">;
export type TourEditorStep = Doc<"tourSteps">;
export type SelectorQuality = ReturnType<typeof scoreSelectorQuality>;

export const stepTypeOptions = ["pointer", "post", "video"] as const;

const defaultStepData: StepFormData = {
  type: "pointer",
  title: "",
  content: "",
  elementSelector: "",
  routePath: "",
  position: "auto",
  size: "small",
  advanceOn: "click",
  customButtonText: "",
  mediaUrl: "",
  mediaType: "",
};

export function createDefaultStepData(): StepFormData {
  return { ...defaultStepData };
}

export function toStepFormData(step?: TourEditorStep | null): StepFormData {
  if (!step) {
    return createDefaultStepData();
  }

  return {
    type: step.type,
    title: step.title || "",
    content: step.content,
    elementSelector: step.elementSelector || "",
    routePath: step.routePath || "",
    position: step.position || "auto",
    size: step.size || "small",
    advanceOn: step.advanceOn || "click",
    customButtonText: step.customButtonText || "",
    mediaUrl: step.mediaUrl || "",
    mediaType: step.mediaType || "",
  };
}

export function parseRouteForComparison(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) return trimmed;

  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return trimmed;
  }
}

export function getRouteConsistencyWarning(stepRoute: string, baseRoute: string): string | null {
  const normalizedStepRoute = parseRouteForComparison(stepRoute);
  const normalizedBaseRoute = parseRouteForComparison(baseRoute);
  if (!normalizedStepRoute || !normalizedBaseRoute) {
    return null;
  }
  if (normalizedStepRoute === normalizedBaseRoute) {
    return null;
  }

  return "This step targets a different route than the tour default. Ensure your flow navigates here before this step.";
}

export function getSelectorQuality(selector: string): SelectorQuality | null {
  const trimmed = selector.trim();
  return trimmed ? scoreSelectorQuality(trimmed) : null;
}

export function getFragileSelectorWarnings(selector: string): string[] {
  const quality = getSelectorQuality(selector);
  return quality?.grade === "poor" ? quality.warnings : [];
}

export function getStepValidationError(stepFormData: StepFormData): string | null {
  const normalizedSelector = stepFormData.elementSelector.trim();
  const requiresSelector =
    stepFormData.type === "pointer" ||
    stepFormData.type === "video" ||
    stepFormData.advanceOn === "elementClick" ||
    stepFormData.advanceOn === "fieldFill";

  if (requiresSelector && !normalizedSelector) {
    return "This step requires an element selector.";
  }

  return null;
}

export function getNormalizedStepSaveData(stepFormData: StepFormData): {
  normalizedSelector: string;
  normalizedRoutePath: string;
  selectorQuality: SelectorQuality | undefined;
  validationError: string | null;
} {
  const normalizedSelector = stepFormData.elementSelector.trim();
  const normalizedRoutePath = stepFormData.routePath.trim();
  const selectorQuality = normalizedSelector ? scoreSelectorQuality(normalizedSelector) : undefined;

  return {
    normalizedSelector,
    normalizedRoutePath,
    selectorQuality,
    validationError: getStepValidationError(stepFormData),
  };
}
