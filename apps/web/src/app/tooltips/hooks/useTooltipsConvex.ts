"use client";

import type { Id } from "@opencom/convex/dataModel";
import type { SelectorQualityMetadata } from "@opencom/web-shared";
import {
  useWebMutation,
  useWebQuery,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";

export type TriggerType = "hover" | "click" | "auto";

export interface TooltipListItem {
  _id: Id<"tooltips">;
  name: string;
  elementSelector: string;
  content: string;
  triggerType: TriggerType;
  selectorQuality?: SelectorQualityMetadata;
}

type ListTooltipsArgs = {
  workspaceId: Id<"workspaces">;
  limit?: number;
};

type AuthoringSessionArgs = {
  token: string;
  workspaceId: Id<"workspaces">;
};

type TooltipMutationPayload = {
  name: string;
  elementSelector: string;
  selectorQuality?: SelectorQualityMetadata;
  content: string;
  triggerType: TriggerType;
};

type CreateTooltipArgs = TooltipMutationPayload & {
  workspaceId: Id<"workspaces">;
};

type UpdateTooltipArgs = TooltipMutationPayload & {
  id: Id<"tooltips">;
};

type DeleteTooltipArgs = {
  id: Id<"tooltips">;
};

type CreateTooltipAuthoringSessionArgs = {
  workspaceId: Id<"workspaces">;
  tooltipId?: Id<"tooltips">;
};

type CreateTooltipAuthoringSessionResult = {
  token: string;
};

type TooltipAuthoringSessionRecord = {
  status: string;
  selectedSelector?: string;
  selectedSelectorQuality?: SelectorQualityMetadata;
} | null;

const LIST_TOOLTIPS_QUERY_REF = webQueryRef<ListTooltipsArgs, TooltipListItem[]>("tooltips:list");
const GET_AUTHORING_SESSION_BY_TOKEN_REF = webQueryRef<
  AuthoringSessionArgs,
  TooltipAuthoringSessionRecord
>("tooltipAuthoringSessions:getByToken");
const CREATE_TOOLTIP_REF = webMutationRef<CreateTooltipArgs, null>("tooltips:create");
const UPDATE_TOOLTIP_REF = webMutationRef<UpdateTooltipArgs, null>("tooltips:update");
const DELETE_TOOLTIP_REF = webMutationRef<DeleteTooltipArgs, null>("tooltips:remove");
const CREATE_AUTHORING_SESSION_REF = webMutationRef<
  CreateTooltipAuthoringSessionArgs,
  CreateTooltipAuthoringSessionResult
>("tooltipAuthoringSessions:create");

type UseTooltipsConvexOptions = {
  workspaceId?: Id<"workspaces"> | null;
  activeSessionToken?: string | null;
};

export function useTooltipsConvex({
  workspaceId,
  activeSessionToken,
}: UseTooltipsConvexOptions) {
  return {
    authoringSession: useWebQuery(
      GET_AUTHORING_SESSION_BY_TOKEN_REF,
      activeSessionToken && workspaceId
        ? { token: activeSessionToken, workspaceId }
        : "skip"
    ),
    createAuthoringSession: useWebMutation(CREATE_AUTHORING_SESSION_REF),
    createTooltip: useWebMutation(CREATE_TOOLTIP_REF),
    deleteTooltip: useWebMutation(DELETE_TOOLTIP_REF),
    tooltips: useWebQuery(LIST_TOOLTIPS_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
    updateTooltip: useWebMutation(UPDATE_TOOLTIP_REF),
  };
}
