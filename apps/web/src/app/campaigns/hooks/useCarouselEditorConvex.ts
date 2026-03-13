"use client";

import type { Id } from "@opencom/convex/dataModel";
import type { AudienceRule } from "@/components/AudienceRuleBuilder";
import {
  useWebMutation,
  useWebQuery,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";

export interface CarouselScreenRecord {
  id: string;
  title?: string;
  body?: string;
  imageUrl?: string;
  buttons?: Array<{
    text: string;
    action: "url" | "dismiss" | "next" | "deeplink";
    url?: string;
    deepLink?: string;
  }>;
}

type CarouselArgs = {
  id: Id<"carousels">;
};

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type CarouselRecord = {
  _id: Id<"carousels">;
  name: string;
  status: string;
  screens: CarouselScreenRecord[];
  audienceRules?: AudienceRule | null;
  targeting?: AudienceRule | null;
} | null;

type CarouselStatsRecord = {
  shown?: number;
  impressions?: number;
  completions?: number;
  completed?: number;
  completionRate?: number;
  dismissals?: number;
} | null;

type UpdateCarouselArgs = {
  id: Id<"carousels">;
  name?: string;
  screens?: CarouselScreenRecord[];
  targeting?: AudienceRule | null;
  priority?: number;
};

type ToggleCarouselArgs = {
  id: Id<"carousels">;
};

const CAROUSEL_QUERY_REF = webQueryRef<CarouselArgs, CarouselRecord>("carousels:get");
const CAROUSEL_STATS_QUERY_REF = webQueryRef<CarouselArgs, CarouselStatsRecord>(
  "carousels:getStats"
);
const EVENT_NAMES_QUERY_REF = webQueryRef<WorkspaceArgs, string[]>("events:getDistinctNames");
const UPDATE_CAROUSEL_REF = webMutationRef<UpdateCarouselArgs, null>("carousels:update");
const ACTIVATE_CAROUSEL_REF = webMutationRef<ToggleCarouselArgs, null>("carousels:activate");
const PAUSE_CAROUSEL_REF = webMutationRef<ToggleCarouselArgs, null>("carousels:pause");

type UseCarouselEditorConvexOptions = {
  carouselId: Id<"carousels">;
  workspaceId?: Id<"workspaces"> | null;
};

export function useCarouselEditorConvex({
  carouselId,
  workspaceId,
}: UseCarouselEditorConvexOptions) {
  return {
    activateCarousel: useWebMutation(ACTIVATE_CAROUSEL_REF),
    carousel: useWebQuery(CAROUSEL_QUERY_REF, { id: carouselId }),
    eventNames: useWebQuery(EVENT_NAMES_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
    pauseCarousel: useWebMutation(PAUSE_CAROUSEL_REF),
    stats: useWebQuery(CAROUSEL_STATS_QUERY_REF, { id: carouselId }),
    updateCarousel: useWebMutation(UPDATE_CAROUSEL_REF),
  };
}
