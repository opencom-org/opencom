"use client";

import type { Id } from "@opencom/convex/dataModel";
import type { AudienceRule } from "@/components/AudienceRuleBuilder";
import {
  useWebMutation,
  useWebQuery,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type CampaignArgs = {
  id: Id<"emailCampaigns">;
};

type UpdateCampaignArgs = {
  id: Id<"emailCampaigns">;
  name?: string;
  subject?: string;
  previewText?: string;
  content?: string;
  templateId?: Id<"emailTemplates">;
  senderId?: Id<"users">;
  targeting?: AudienceRule;
  schedule?: {
    type: "immediate" | "scheduled";
    scheduledAt?: number;
    timezone?: string;
  };
};

const CAMPAIGN_QUERY_REF = webQueryRef<
  CampaignArgs,
  {
    _id: Id<"emailCampaigns">;
    name: string;
    subject: string;
    previewText?: string;
    content: string;
    status: string;
    audienceRules?: AudienceRule | null;
    targeting?: AudienceRule | null;
  } | null
>("emailCampaigns:get");
const CAMPAIGN_STATS_QUERY_REF = webQueryRef<
  CampaignArgs,
  {
    total: number;
    pending: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
  }
>("emailCampaigns:getStats");
const EVENT_NAMES_QUERY_REF = webQueryRef<WorkspaceArgs, string[]>("events:getDistinctNames");
const UPDATE_CAMPAIGN_REF = webMutationRef<UpdateCampaignArgs, Id<"emailCampaigns">>(
  "emailCampaigns:update"
);
const SEND_CAMPAIGN_REF = webMutationRef<
  { id: Id<"emailCampaigns"> },
  { recipientCount: number }
>("emailCampaigns:send");

export function useEmailCampaignEditorConvex(
  campaignId: Id<"emailCampaigns">,
  workspaceId?: Id<"workspaces"> | null
) {
  return {
    campaign: useWebQuery(CAMPAIGN_QUERY_REF, { id: campaignId }),
    eventNames: useWebQuery(EVENT_NAMES_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
    sendCampaign: useWebMutation(SEND_CAMPAIGN_REF),
    stats: useWebQuery(CAMPAIGN_STATS_QUERY_REF, { id: campaignId }),
    updateCampaign: useWebMutation(UPDATE_CAMPAIGN_REF),
  };
}
