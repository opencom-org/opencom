import type { Id } from "@opencom/convex/dataModel";
import { getClient, getConfig } from "./client";
import { makeFunctionReference, type FunctionReference } from "convex/server";

function getQueryRef(name: string): FunctionReference<"query"> {
  return makeFunctionReference(name) as FunctionReference<"query">;
}

export interface OfficeHoursStatus {
  isOpen: boolean;
  offlineMessage: string | null;
  expectedReplyTimeMinutes: number | null;
}

export interface OfficeHoursSchedule {
  day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export interface OfficeHoursData {
  workspaceId: Id<"workspaces">;
  timezone: string;
  schedule: OfficeHoursSchedule[];
  offlineMessage?: string;
  expectedReplyTimeMinutes: number;
}

export async function getOfficeHoursStatus(): Promise<OfficeHoursStatus> {
  const client = getClient();
  const config = getConfig();

  const status = await client.query(getQueryRef("officeHours:isCurrentlyOpen"), {
    workspaceId: config.workspaceId as Id<"workspaces">,
  });

  return {
    ...status,
    offlineMessage: status.offlineMessage ?? null,
    expectedReplyTimeMinutes: status.expectedReplyTimeMinutes ?? null,
  };
}

export async function getExpectedReplyTime(): Promise<string | null> {
  const client = getClient();
  const config = getConfig();

  const replyTime = await client.query(getQueryRef("officeHours:getExpectedReplyTime"), {
    workspaceId: config.workspaceId as Id<"workspaces">,
  });

  return replyTime;
}

export async function getOfficeHours(): Promise<OfficeHoursData> {
  const client = getClient();
  const config = getConfig();

  const officeHours = await client.query(getQueryRef("officeHours:getOrDefault"), {
    workspaceId: config.workspaceId as Id<"workspaces">,
  });

  return officeHours as OfficeHoursData;
}
