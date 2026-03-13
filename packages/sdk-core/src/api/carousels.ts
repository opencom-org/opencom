import { makeFunctionReference, type FunctionReference } from "convex/server";
import type { Id } from "@opencom/convex/dataModel";
import { getClient, getConfig } from "./client";
import type { VisitorId, CarouselId, CarouselData, CarouselScreen } from "../types";
import { getVisitorState } from "../state/visitor";

// Generated api.carousels.* refs trigger TS2589 in sdk-core, so keep the fallback
// localized to these explicit carousel refs only.
const GET_CAROUSEL_REF = makeFunctionReference("carousels:get") as FunctionReference<"query">;
const RECORD_CAROUSEL_IMPRESSION_REF =
  makeFunctionReference("carousels:recordImpression") as FunctionReference<"mutation">;
const LIST_ACTIVE_CAROUSELS_REF =
  makeFunctionReference("carousels:listActive") as FunctionReference<"query">;

interface CarouselDoc {
  _id: CarouselId;
  name: string;
  screens: CarouselScreen[];
}

export async function getCarousel(carouselId: CarouselId): Promise<CarouselData | null> {
  const client = getClient();

  const carousel = await client.query(GET_CAROUSEL_REF, { id: carouselId });

  if (!carousel) return null;

  return {
    id: carousel._id,
    name: carousel.name,
    screens: carousel.screens,
  };
}

export async function recordCarouselImpression(params: {
  carouselId: CarouselId;
  visitorId: VisitorId;
  sessionToken?: string;
  action: "shown" | "completed" | "dismissed";
  screenIndex?: number;
}): Promise<void> {
  const client = getClient();
  const token = params.sessionToken ?? getVisitorState().sessionToken ?? undefined;

  await client.mutation(RECORD_CAROUSEL_IMPRESSION_REF, {
    carouselId: params.carouselId,
    visitorId: params.visitorId,
    sessionToken: token,
    action: params.action,
    screenIndex: params.screenIndex,
  });
}

export async function listActiveCarousels(
  visitorId: VisitorId,
  sessionToken?: string
): Promise<CarouselData[]> {
  const client = getClient();
  const config = getConfig();
  const token = sessionToken ?? getVisitorState().sessionToken ?? undefined;

  const carousels = await client.query(LIST_ACTIVE_CAROUSELS_REF, {
    workspaceId: config.workspaceId as Id<"workspaces">,
    visitorId,
    sessionToken: token,
  });

  return carousels.map((carousel: CarouselDoc) => ({
    id: carousel._id,
    name: carousel.name,
    screens: carousel.screens,
  }));
}
