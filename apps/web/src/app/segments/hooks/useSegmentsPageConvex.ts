"use client";

import type { Id } from "@opencom/convex/dataModel";
import type { InlineAudienceRule } from "@/lib/audienceRules";
import {
  useWebMutation,
  useWebQuery,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type SegmentAudienceRulesInput = InlineAudienceRule;

type SegmentIdArgs = {
  id: Id<"segments">;
};

type CreateSegmentArgs = WorkspaceArgs & {
  name: string;
  description?: string;
  audienceRules: SegmentAudienceRulesInput;
};

type UpdateSegmentArgs = {
  id: Id<"segments">;
  name?: string;
  description?: string;
  audienceRules?: SegmentAudienceRulesInput;
};

const SEGMENTS_LIST_QUERY_REF = webQueryRef<
  WorkspaceArgs,
  Array<{ _id: Id<"segments">; name: string; description?: string; audienceRules: unknown }>
>("segments:list");
const SEGMENT_PREVIEW_QUERY_REF = webQueryRef<
  WorkspaceArgs & { audienceRules: SegmentAudienceRulesInput },
  { matching: number; total: number } | null
>("segments:preview");
const SEGMENT_USAGE_QUERY_REF = webQueryRef<
  SegmentIdArgs,
  Array<{ type: string; name: string }>
>("segments:getUsage");
const SEGMENT_GET_QUERY_REF = webQueryRef<
  SegmentIdArgs,
  {
    _id: Id<"segments">;
    name: string;
    description?: string;
    audienceRules: unknown;
  } | null
>("segments:get");
const EVENT_NAMES_QUERY_REF = webQueryRef<WorkspaceArgs, string[]>("events:getDistinctNames");
const CREATE_SEGMENT_REF = webMutationRef<CreateSegmentArgs, Id<"segments">>("segments:create");
const UPDATE_SEGMENT_REF = webMutationRef<UpdateSegmentArgs, null>("segments:update");
const DELETE_SEGMENT_REF = webMutationRef<SegmentIdArgs, null>("segments:remove");

export function useSegmentsListConvex(workspaceId?: Id<"workspaces">) {
  return {
    segments: useWebQuery(SEGMENTS_LIST_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
  };
}

export function useSegmentCardConvex(
  workspaceId: Id<"workspaces">,
  segmentId: Id<"segments">,
  audienceRules: SegmentAudienceRulesInput | null
) {
  return {
    preview: useWebQuery(
      SEGMENT_PREVIEW_QUERY_REF,
      audienceRules ? { workspaceId, audienceRules } : "skip"
    ),
    usage: useWebQuery(SEGMENT_USAGE_QUERY_REF, { id: segmentId }),
  };
}

export function useSegmentModalConvex(
  workspaceId: Id<"workspaces">,
  segmentId?: Id<"segments">
) {
  return {
    createSegment: useWebMutation(CREATE_SEGMENT_REF),
    eventNames: useWebQuery(EVENT_NAMES_QUERY_REF, { workspaceId }),
    existingSegment: useWebQuery(SEGMENT_GET_QUERY_REF, segmentId ? { id: segmentId } : "skip"),
    updateSegment: useWebMutation(UPDATE_SEGMENT_REF),
  };
}

export function useDeleteSegmentConvex(segmentId: Id<"segments">) {
  return {
    deleteSegment: useWebMutation(DELETE_SEGMENT_REF),
    segment: useWebQuery(SEGMENT_GET_QUERY_REF, { id: segmentId }),
    usage: useWebQuery(SEGMENT_USAGE_QUERY_REF, { id: segmentId }),
  };
}
