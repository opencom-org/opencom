import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import { getClient, getConfig } from "./client";
import type { VisitorId, EventProperties } from "../types";

export type AutoEventType = "page_view" | "screen_view" | "session_start" | "session_end";
type ConvexEventPropertyValue = string | number | boolean | null | Array<string | number>;
type ConvexEventProperties = Record<string, ConvexEventPropertyValue>;

function normalizeEventProperties(
  properties: EventProperties | undefined
): ConvexEventProperties | undefined {
  if (!properties) {
    return undefined;
  }

  const normalized: ConvexEventProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      normalized[key] = value;
      continue;
    }

    if (
      Array.isArray(value) &&
      value.every((item) => typeof item === "string" || typeof item === "number")
    ) {
      normalized[key] = value;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export async function trackEvent(params: {
  visitorId: VisitorId;
  sessionToken?: string;
  name: string;
  properties?: EventProperties;
  url?: string;
  sessionId?: string;
}): Promise<void> {
  const client = getClient();
  const config = getConfig();
  const properties = normalizeEventProperties(params.properties);

  await client.mutation(api.events.track, {
    workspaceId: config.workspaceId as Id<"workspaces">,
    visitorId: params.visitorId,
    sessionToken: params.sessionToken,
    name: params.name,
    properties,
    url: params.url,
    sessionId: params.sessionId,
  });

  if (config.debug) {
    console.log("[OpencomSDK] Event tracked:", params.name, params.properties);
  }
}

export async function trackAutoEvent(params: {
  visitorId: VisitorId;
  sessionToken?: string;
  eventType: AutoEventType;
  properties?: EventProperties;
  url?: string;
  sessionId?: string;
}): Promise<Id<"events"> | null> {
  const client = getClient();
  const config = getConfig();
  const properties = normalizeEventProperties(params.properties);

  const result = await client.mutation(api.events.trackAutoEvent, {
    workspaceId: config.workspaceId as Id<"workspaces">,
    visitorId: params.visitorId,
    sessionToken: params.sessionToken,
    eventType: params.eventType,
    properties,
    url: params.url,
    sessionId: params.sessionId,
  });

  if (config.debug) {
    console.log(
      "[OpencomSDK] Auto event tracked:",
      params.eventType,
      result ? "success" : "rate limited"
    );
  }

  return result;
}
