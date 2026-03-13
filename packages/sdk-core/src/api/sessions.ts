import { makeFunctionReference, type FunctionReference } from "convex/server";
import type { Id } from "@opencom/convex/dataModel";
import { getClient, getConfig } from "./client";
import type { DeviceInfo, UserIdentification } from "../types";

// Generated api.widgetSessions.* refs trigger TS2589 in sdk-core, so keep the
// fallback localized to these explicit session refs only.
const BOOT_SESSION_REF =
  makeFunctionReference("widgetSessions:boot") as FunctionReference<"mutation">;
const REFRESH_SESSION_REF =
  makeFunctionReference("widgetSessions:refresh") as FunctionReference<"mutation">;
const REVOKE_SESSION_REF =
  makeFunctionReference("widgetSessions:revoke") as FunctionReference<"mutation">;

export interface BootSessionResult {
  visitor: { _id: string };
  sessionToken: string;
  expiresAt: number;
}

export async function bootSession(params: {
  sessionId: string;
  device?: DeviceInfo;
  referrer?: string;
  currentUrl?: string;
  user?: UserIdentification;
  origin?: string;
  existingVisitorId?: string;
  clientType?: string;
  clientVersion?: string;
  clientIdentifier?: string;
}): Promise<BootSessionResult> {
  const client = getClient();
  const config = getConfig();

  const result = await client.mutation(BOOT_SESSION_REF, {
    workspaceId: config.workspaceId as Id<"workspaces">,
    sessionId: params.sessionId,
    device: params.device,
    referrer: params.referrer,
    currentUrl: params.currentUrl,
    email: params.user?.email,
    name: params.user?.name,
    externalUserId: params.user?.userId,
    userHash: params.user?.userHash,
    origin: params.origin,
    clientType: params.clientType,
    clientVersion: params.clientVersion,
    clientIdentifier: params.clientIdentifier,
    ...(params.existingVisitorId
      ? { existingVisitorId: params.existingVisitorId as Id<"visitors"> }
      : {}),
  });

  return result as BootSessionResult;
}

export interface RefreshSessionResult {
  sessionToken: string;
  expiresAt: number;
}

export async function refreshSession(params: {
  sessionToken: string;
}): Promise<RefreshSessionResult> {
  const client = getClient();

  const result = await client.mutation(REFRESH_SESSION_REF, {
    sessionToken: params.sessionToken,
  });

  return result as RefreshSessionResult;
}

export async function revokeSession(params: { sessionToken: string }): Promise<void> {
  const client = getClient();

  await client.mutation(REVOKE_SESSION_REF, {
    sessionToken: params.sessionToken,
  });
}
