import { useQuery } from "convex/react";
import { useOpencomContext } from "../components/OpencomProvider";
import type { Id } from "@opencom/convex/dataModel";
import { makeFunctionReference, type FunctionReference } from "convex/server";

function getQueryRef(name: string): FunctionReference<"query"> {
  return makeFunctionReference(name) as FunctionReference<"query">;
}

export interface OfficeHoursStatus {
  isOpen: boolean;
  offlineMessage: string | null;
  expectedReplyTimeMinutes: number | null;
}

export function useOfficeHours() {
  const { workspaceId } = useOpencomContext();

  const status = useQuery(
    getQueryRef("officeHours:isCurrentlyOpen"),
    workspaceId ? { workspaceId: workspaceId as Id<"workspaces"> } : "skip"
  );

  const expectedReplyTime = useQuery(
    getQueryRef("officeHours:getExpectedReplyTime"),
    workspaceId ? { workspaceId: workspaceId as Id<"workspaces"> } : "skip"
  );

  return {
    isOpen: status?.isOpen ?? true,
    offlineMessage: status?.offlineMessage ?? null,
    expectedReplyTime: expectedReplyTime ?? null,
    expectedReplyTimeMinutes: status?.expectedReplyTimeMinutes ?? null,
    isLoading: status === undefined,
  };
}
