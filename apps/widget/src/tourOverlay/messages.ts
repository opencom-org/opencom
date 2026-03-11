import type { TourStep } from "./types";

export function getBlockedReasonMessage(reason?: string | null): string | null {
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

export function getAdvanceGuidance(step?: TourStep): string | null {
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
