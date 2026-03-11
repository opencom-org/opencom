import { makeFunctionReference, type FunctionReference } from "convex/server";
import { getClient } from "./client";
import { getVisitorState } from "../state/visitor";
import type { UserIdentification, DeviceInfo, LocationInfo, VisitorId } from "../types";

const IDENTIFY_VISITOR_REF =
  makeFunctionReference("visitors:identify") as FunctionReference<"mutation">;
const HEARTBEAT_VISITOR_REF =
  makeFunctionReference("visitors:heartbeat") as FunctionReference<"mutation">;
const UPDATE_VISITOR_LOCATION_REF =
  makeFunctionReference("visitors:updateLocation") as FunctionReference<"mutation">;

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

  await client.mutation(IDENTIFY_VISITOR_REF, {
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
  await client.mutation(HEARTBEAT_VISITOR_REF, { visitorId, sessionToken });
}

export async function updateLocation(
  visitorId: VisitorId,
  location: LocationInfo,
  sessionToken?: string
): Promise<void> {
  const client = getClient();
  const state = getVisitorState();
  const token = sessionToken ?? state.sessionToken ?? undefined;
  await client.mutation(UPDATE_VISITOR_LOCATION_REF, {
    visitorId,
    sessionToken: token,
    location,
  });
}
