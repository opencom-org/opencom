import type { Id } from "@opencom/convex/dataModel";

export type StepType = "pointer" | "post" | "video";
export type Position = "auto" | "left" | "right" | "above" | "below";
export type Size = "small" | "large";
export type AdvanceOn = "click" | "elementClick" | "fieldFill";
export type DiagnosticReason =
  | "mode_mismatch"
  | "element_click_required"
  | "field_fill_required"
  | "field_fill_invalid"
  | "route_mismatch"
  | "checkpoint_invalid_route"
  | "selector_missing";

export interface TourStep {
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

export interface Tour {
  _id: Id<"tours">;
  name: string;
  displayMode?: "first_time_only" | "until_dismissed";
  buttonColor?: string;
  showConfetti?: boolean;
  allowSnooze?: boolean;
  allowRestart?: boolean;
}

export interface TourData {
  tour: Tour;
  steps: TourStep[];
  progress?: {
    currentStep: number;
    status: string;
    checkpointRoute?: string;
    checkpointSelector?: string;
  };
}

export interface TourOverlayProps {
  workspaceId: Id<"workspaces">;
  visitorId: Id<"visitors">;
  sessionToken?: string | null;
  availableTours: TourData[];
  forcedTourId?: Id<"tours"> | null;
  allowBlockingTour?: boolean;
  onBlockingActiveChange?: (isActive: boolean) => void;
  onTourComplete?: () => void;
  onTourDismiss?: () => void;
}

export interface ElementPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface TooltipPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  layout: "anchored" | "fallback";
}

export interface VisualViewportBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}
