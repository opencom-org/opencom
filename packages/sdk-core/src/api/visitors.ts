import { api } from "@opencom/convex";
import { getClient } from "./client";
import { getVisitorState } from "../state/visitor";
import type { UserIdentification, DeviceInfo, LocationInfo, VisitorId } from "../types";

// getOrCreateVisitor has been removed — use bootSession instead.

export async function identifyVisitor(params: {
  visitorId: VisitorId;
  sessionToken?: string;
  user: UserIdentification;
  location?: LocationInfo;
  device?: DeviceInfo;
  currentUrl?: string;
}): Promise<void> {
  const client = getClient();

  await client.mutation(api.visitors.identify, {
    visitorId: params.visitorId,
    sessionToken: params.sessionToken,
    email: params.user.email,
    name: params.user.name,
    externalUserId: params.user.userId,
    userHash: params.user.userHash,
    location: params.location,
    device: params.device,
    currentUrl: params.currentUrl,
    customAttributes: {
      ...(params.user.company && { company: params.user.company }),
      ...params.user.customAttributes,
    },
  });
}

export async function heartbeat(visitorId: VisitorId, sessionToken?: string): Promise<void> {
  const client = getClient();
  await client.mutation(api.visitors.heartbeat, { visitorId, sessionToken });
}

export async function updateLocation(
  visitorId: VisitorId,
  location: LocationInfo,
  sessionToken?: string
): Promise<void> {
  const client = getClient();
  const state = getVisitorState();
  const token = sessionToken ?? state.sessionToken ?? undefined;
  await client.mutation(api.visitors.updateLocation, {
    visitorId,
    sessionToken: token,
    location,
  });
}
