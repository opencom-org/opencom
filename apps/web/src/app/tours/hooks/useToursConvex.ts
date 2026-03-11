"use client";

import type { Id } from "@opencom/convex/dataModel";
import type { AudienceRule } from "@/components/AudienceRuleBuilder";
import type {
  SelectorQuality,
  StepFormData,
  TourDisplayMode,
  TourEditorStep,
} from "../[id]/tourEditorTypes";
import {
  useWebMutation,
  useWebQuery,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";

type TourStatus = "draft" | "active" | "archived";

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type TourArgs = {
  id: Id<"tours">;
};

type TourIdArgs = {
  tourId: Id<"tours">;
};

const LIST_TOURS_QUERY_REF = webQueryRef<
  WorkspaceArgs & { status?: TourStatus },
  Array<{
    _id: Id<"tours">;
    name: string;
    description?: string;
    status: TourStatus;
    createdAt: number;
  }>
>("tours:list");
const CREATE_TOUR_REF = webMutationRef<
  WorkspaceArgs & { name: string },
  Id<"tours">
>("tours:create");
const DELETE_TOUR_REF = webMutationRef<TourArgs, null>("tours:remove");
const ACTIVATE_TOUR_REF = webMutationRef<TourArgs, null>("tours:activate");
const DEACTIVATE_TOUR_REF = webMutationRef<TourArgs, null>("tours:deactivate");
const DUPLICATE_TOUR_REF = webMutationRef<TourArgs, Id<"tours">>("tours:duplicate");
const TOUR_GET_QUERY_REF = webQueryRef<
  TourArgs,
  {
    _id: Id<"tours">;
    workspaceId: Id<"workspaces">;
    name: string;
    description?: string;
    status: TourStatus;
    targetingRules?: { pageUrl?: string };
    audienceRules?: AudienceRule | null;
    displayMode?: TourDisplayMode;
    priority?: number;
    buttonColor?: string;
    showConfetti?: boolean;
    allowSnooze?: boolean;
    allowRestart?: boolean;
  } | null
>("tours:get");
const TOUR_STEPS_LIST_QUERY_REF = webQueryRef<TourIdArgs, TourEditorStep[]>("tourSteps:list");
const EVENT_NAMES_QUERY_REF = webQueryRef<WorkspaceArgs, string[]>("events:getDistinctNames");
const UPDATE_TOUR_REF = webMutationRef<
  {
    id: Id<"tours">;
    name?: string;
    description?: string;
    targetingRules?: { pageUrl?: string };
    audienceRules?: AudienceRule | null;
    displayMode?: TourDisplayMode;
    priority?: number;
    buttonColor?: string;
    showConfetti?: boolean;
    allowSnooze?: boolean;
    allowRestart?: boolean;
  },
  null
>("tours:update");
const CREATE_STEP_REF = webMutationRef<
  {
    tourId: Id<"tours">;
    type: StepFormData["type"];
    title?: string;
    content: string;
    elementSelector?: string;
    routePath?: string;
    selectorQuality?: SelectorQuality;
    position: StepFormData["position"];
    size: StepFormData["size"];
    advanceOn: StepFormData["advanceOn"];
    customButtonText?: string;
    mediaUrl?: string;
    mediaType?: StepFormData["mediaType"];
  },
  Id<"tourSteps">
>("tourSteps:create");
const UPDATE_STEP_REF = webMutationRef<
  {
    id: Id<"tourSteps">;
    type?: StepFormData["type"];
    title?: string;
    content?: string;
    elementSelector?: string;
    routePath?: string;
    selectorQuality?: SelectorQuality;
    position?: StepFormData["position"];
    size?: StepFormData["size"];
    advanceOn?: StepFormData["advanceOn"];
    customButtonText?: string;
    mediaUrl?: string;
    mediaType?: StepFormData["mediaType"];
  },
  null
>("tourSteps:update");
const DELETE_STEP_REF = webMutationRef<{ id: Id<"tourSteps"> }, null>("tourSteps:remove");
const REORDER_STEPS_REF = webMutationRef<
  { tourId: Id<"tours">; stepIds: Id<"tourSteps">[] },
  null
>("tourSteps:reorder");
const CREATE_AUTHORING_SESSION_REF = webMutationRef<
  { tourId: Id<"tours">; stepId?: Id<"tourSteps">; targetUrl: string },
  { token: string }
>("authoringSessions:create");

export function useToursPageConvex(
  workspaceId?: Id<"workspaces"> | null,
  status?: TourStatus
) {
  return {
    activateTour: useWebMutation(ACTIVATE_TOUR_REF),
    createTour: useWebMutation(CREATE_TOUR_REF),
    deactivateTour: useWebMutation(DEACTIVATE_TOUR_REF),
    deleteTour: useWebMutation(DELETE_TOUR_REF),
    duplicateTour: useWebMutation(DUPLICATE_TOUR_REF),
    tours: useWebQuery(
      LIST_TOURS_QUERY_REF,
      workspaceId ? { workspaceId, status } : "skip"
    ),
  };
}

export function useTourEditorConvex(
  tourId: Id<"tours">,
  canQueryTourData: boolean
) {
  const tour = useWebQuery(TOUR_GET_QUERY_REF, canQueryTourData ? { id: tourId } : "skip");

  return {
    activateTour: useWebMutation(ACTIVATE_TOUR_REF),
    createAuthoringSession: useWebMutation(CREATE_AUTHORING_SESSION_REF),
    createStep: useWebMutation(CREATE_STEP_REF),
    deactivateTour: useWebMutation(DEACTIVATE_TOUR_REF),
    deleteStep: useWebMutation(DELETE_STEP_REF),
    eventNames: useWebQuery(
      EVENT_NAMES_QUERY_REF,
      canQueryTourData && tour?.workspaceId ? { workspaceId: tour.workspaceId } : "skip"
    ),
    reorderSteps: useWebMutation(REORDER_STEPS_REF),
    steps: useWebQuery(TOUR_STEPS_LIST_QUERY_REF, canQueryTourData ? { tourId } : "skip"),
    tour,
    updateStep: useWebMutation(UPDATE_STEP_REF),
    updateTour: useWebMutation(UPDATE_TOUR_REF),
  };
}
