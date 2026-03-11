"use client";

import type { Id } from "@opencom/convex/dataModel";
import {
  useWebMutation,
  useWebQuery,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type EmailCampaignListItem = {
  _id: Id<"emailCampaigns">;
  name: string;
  status: string;
  subject: string;
  createdAt: number;
};

type PushCampaignListItem = {
  _id: Id<"pushCampaigns">;
  name: string;
  status: string;
  title: string;
  createdAt: number;
};

type CarouselListItem = {
  _id: Id<"carousels">;
  name: string;
  status: string;
  screens: unknown[];
  createdAt: number;
};

type SeriesListItem = {
  _id: Id<"series">;
  name: string;
  description?: string;
  status: string;
  createdAt: number;
};

type CreateEmailCampaignArgs = WorkspaceArgs & {
  name: string;
  subject: string;
  content: string;
};

type CreatePushCampaignArgs = WorkspaceArgs & {
  name: string;
  title: string;
  body: string;
};

type CreateCarouselArgs = WorkspaceArgs & {
  name: string;
  screens: Array<{
    id: string;
    title: string;
    body: string;
  }>;
};

type CreateSeriesArgs = WorkspaceArgs & {
  name: string;
  description?: string;
};

type EmailCampaignIdArgs = {
  id: Id<"emailCampaigns">;
};

type PushCampaignIdArgs = {
  id: Id<"pushCampaigns">;
};

type CarouselIdArgs = {
  id: Id<"carousels">;
};

type SeriesIdArgs = {
  id: Id<"series">;
};

const EMAIL_CAMPAIGNS_LIST_QUERY_REF = webQueryRef<WorkspaceArgs, EmailCampaignListItem[]>(
  "emailCampaigns:list"
);
const PUSH_CAMPAIGNS_LIST_QUERY_REF = webQueryRef<WorkspaceArgs, PushCampaignListItem[]>(
  "pushCampaigns:list"
);
const CAROUSELS_LIST_QUERY_REF = webQueryRef<WorkspaceArgs, CarouselListItem[]>("carousels:list");
const SERIES_LIST_QUERY_REF = webQueryRef<WorkspaceArgs, SeriesListItem[]>("series:list");

const CREATE_EMAIL_CAMPAIGN_REF = webMutationRef<CreateEmailCampaignArgs, Id<"emailCampaigns">>(
  "emailCampaigns:create"
);
const CREATE_PUSH_CAMPAIGN_REF = webMutationRef<CreatePushCampaignArgs, Id<"pushCampaigns">>(
  "pushCampaigns:create"
);
const CREATE_CAROUSEL_REF = webMutationRef<CreateCarouselArgs, Id<"carousels">>(
  "carousels:create"
);
const CREATE_SERIES_REF = webMutationRef<CreateSeriesArgs, Id<"series">>("series:create");
const DUPLICATE_CAROUSEL_REF = webMutationRef<CarouselIdArgs, Id<"carousels">>(
  "carousels:duplicate"
);
const DELETE_EMAIL_CAMPAIGN_REF = webMutationRef<EmailCampaignIdArgs, null>(
  "emailCampaigns:remove"
);
const DELETE_PUSH_CAMPAIGN_REF = webMutationRef<PushCampaignIdArgs, null>(
  "pushCampaigns:remove"
);
const DELETE_CAROUSEL_REF = webMutationRef<CarouselIdArgs, null>("carousels:remove");
const DELETE_SERIES_REF = webMutationRef<SeriesIdArgs, null>("series:remove");
const PAUSE_EMAIL_CAMPAIGN_REF = webMutationRef<EmailCampaignIdArgs, null>(
  "emailCampaigns:pause"
);
const PAUSE_PUSH_CAMPAIGN_REF = webMutationRef<PushCampaignIdArgs, null>("pushCampaigns:pause");
const PAUSE_CAROUSEL_REF = webMutationRef<CarouselIdArgs, null>("carousels:pause");
const PAUSE_SERIES_REF = webMutationRef<SeriesIdArgs, null>("series:pause");
const ACTIVATE_CAROUSEL_REF = webMutationRef<CarouselIdArgs, null>("carousels:activate");
const ACTIVATE_SERIES_REF = webMutationRef<SeriesIdArgs, null>("series:activate");

export function useCampaignsPageConvex(workspaceId?: Id<"workspaces"> | null) {
  return {
    activateCarousel: useWebMutation(ACTIVATE_CAROUSEL_REF),
    activateSeries: useWebMutation(ACTIVATE_SERIES_REF),
    carousels: useWebQuery(CAROUSELS_LIST_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
    createCarousel: useWebMutation(CREATE_CAROUSEL_REF),
    createEmailCampaign: useWebMutation(CREATE_EMAIL_CAMPAIGN_REF),
    createPushCampaign: useWebMutation(CREATE_PUSH_CAMPAIGN_REF),
    createSeries: useWebMutation(CREATE_SERIES_REF),
    deleteCarousel: useWebMutation(DELETE_CAROUSEL_REF),
    deleteEmailCampaign: useWebMutation(DELETE_EMAIL_CAMPAIGN_REF),
    deletePushCampaign: useWebMutation(DELETE_PUSH_CAMPAIGN_REF),
    deleteSeries: useWebMutation(DELETE_SERIES_REF),
    duplicateCarousel: useWebMutation(DUPLICATE_CAROUSEL_REF),
    emailCampaigns: useWebQuery(
      EMAIL_CAMPAIGNS_LIST_QUERY_REF,
      workspaceId ? { workspaceId } : "skip"
    ),
    pauseCarousel: useWebMutation(PAUSE_CAROUSEL_REF),
    pauseEmailCampaign: useWebMutation(PAUSE_EMAIL_CAMPAIGN_REF),
    pausePushCampaign: useWebMutation(PAUSE_PUSH_CAMPAIGN_REF),
    pauseSeries: useWebMutation(PAUSE_SERIES_REF),
    pushCampaigns: useWebQuery(
      PUSH_CAMPAIGNS_LIST_QUERY_REF,
      workspaceId ? { workspaceId } : "skip"
    ),
    seriesList: useWebQuery(SERIES_LIST_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
  };
}
