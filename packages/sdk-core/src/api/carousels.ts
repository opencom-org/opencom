import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import { getClient, getConfig } from "./client";
import type { VisitorId, CarouselId, CarouselData, CarouselScreen } from "../types";
import { getVisitorState } from "../state/visitor";

interface CarouselDoc {
  _id: CarouselId;
  name: string;
  screens: CarouselScreen[];
}

export async function getCarousel(carouselId: CarouselId): Promise<CarouselData | null> {
  const client = getClient();

  const carousel = await client.query(api.carousels.get, { id: carouselId });

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

  await client.mutation(api.carousels.recordImpression, {
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

  const carousels = await client.query(api.carousels.listActive, {
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
