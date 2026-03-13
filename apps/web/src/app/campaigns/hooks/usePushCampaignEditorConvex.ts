"use client";

import type { Id } from "@opencom/convex/dataModel";
import type { AudienceRule } from "@/components/AudienceRuleBuilder";
import {
  useWebMutation,
  useWebQuery,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";

type CampaignArgs = {
  id: Id<"pushCampaigns">;
};

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type PushCampaignRecord = {
  _id: Id<"pushCampaigns">;
  name: string;
  title: string;
  body: string;
  imageUrl?: string;
  deepLink?: string;
  status: string;
  audienceRules?: AudienceRule | null;
  targeting?: AudienceRule | null;
} | null;

type PushCampaignStats = {
  total?: number;
  deliveryRate?: number;
  openRate?: number;
  failed?: number;
} | null;

type UpdatePushCampaignArgs = {
  id: Id<"pushCampaigns">;
  name: string;
  title: string;
  body: string;
  imageUrl?: string;
  deepLink?: string;
  targeting?: AudienceRule;
};

type SendPushCampaignArgs = {
  id: Id<"pushCampaigns">;
};

const CAMPAIGN_QUERY_REF = webQueryRef<CampaignArgs, PushCampaignRecord>("pushCampaigns:get");
const CAMPAIGN_STATS_QUERY_REF = webQueryRef<CampaignArgs, PushCampaignStats>(
  "pushCampaigns:getStats"
);
const EVENT_NAMES_QUERY_REF = webQueryRef<WorkspaceArgs, string[]>("events:getDistinctNames");
const UPDATE_CAMPAIGN_REF = webMutationRef<UpdatePushCampaignArgs, null>("pushCampaigns:update");
const SEND_CAMPAIGN_REF = webMutationRef<SendPushCampaignArgs, null>("pushCampaigns:send");

type UsePushCampaignEditorConvexOptions = {
  campaignId: Id<"pushCampaigns">;
  workspaceId?: Id<"workspaces"> | null;
};

export function usePushCampaignEditorConvex({
  campaignId,
  workspaceId,
}: UsePushCampaignEditorConvexOptions) {
  return {
    campaign: useWebQuery(CAMPAIGN_QUERY_REF, { id: campaignId }),
    eventNames: useWebQuery(EVENT_NAMES_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
    sendCampaign: useWebMutation(SEND_CAMPAIGN_REF),
    stats: useWebQuery(CAMPAIGN_STATS_QUERY_REF, { id: campaignId }),
    updateCampaign: useWebMutation(UPDATE_CAMPAIGN_REF),
  };
}
