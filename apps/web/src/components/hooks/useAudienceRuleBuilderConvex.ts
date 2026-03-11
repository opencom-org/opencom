"use client";

import type { Id } from "@opencom/convex/dataModel";
import type { AudienceRuleWithSegment } from "@opencom/types";
import { useWebQuery, webQueryRef } from "@/lib/convex/hooks";

type AudienceRule = AudienceRuleWithSegment<Id<"segments">>;

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type PreviewArgs = WorkspaceArgs & {
  audienceRules: AudienceRule;
};

const LIST_SEGMENTS_QUERY_REF = webQueryRef<
  WorkspaceArgs,
  Array<{ _id: Id<"segments">; name: string }>
>("segments:list");
const PREVIEW_AUDIENCE_RULES_QUERY_REF = webQueryRef<
  PreviewArgs,
  { matching: number; total: number }
>("tours:previewAudienceRules");

export function useAudienceRuleBuilderConvex(
  workspaceId?: Id<"workspaces">,
  audienceRules?: AudienceRule | null
) {
  return {
    preview: useWebQuery(
      PREVIEW_AUDIENCE_RULES_QUERY_REF,
      workspaceId && audienceRules ? { workspaceId, audienceRules } : "skip"
    ),
    segments: useWebQuery(LIST_SEGMENTS_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
  };
}
