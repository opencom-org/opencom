import type { Id } from "@opencom/convex/dataModel";
import { getClient, getConfig } from "./client";
import { makeFunctionReference, type FunctionReference } from "convex/server";

// Generated api.officeHours.* refs trigger TS2589 in sdk-core, so keep the
// fallback localized to these explicit office-hours refs only.
const IS_CURRENTLY_OPEN_REF =
  makeFunctionReference("officeHours:isCurrentlyOpen") as FunctionReference<"query">;
const GET_EXPECTED_REPLY_TIME_REF =
  makeFunctionReference("officeHours:getExpectedReplyTime") as FunctionReference<"query">;
const GET_OFFICE_HOURS_REF =
  makeFunctionReference("officeHours:getOrDefault") as FunctionReference<"query">;

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

  const status = await client.query(IS_CURRENTLY_OPEN_REF, {
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

  const replyTime = await client.query(GET_EXPECTED_REPLY_TIME_REF, {
    workspaceId: config.workspaceId as Id<"workspaces">,
  });

  return replyTime;
}

export async function getOfficeHours(): Promise<OfficeHoursData> {
  const client = getClient();
  const config = getConfig();

  const officeHours = await client.query(GET_OFFICE_HOURS_REF, {
    workspaceId: config.workspaceId as Id<"workspaces">,
  });

  return officeHours as OfficeHoursData;
}
