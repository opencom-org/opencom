import { useQuery } from "convex/react";
import { api } from "@opencom/convex";
import { useOpencomContext } from "../components/OpencomProvider";
import type { Id } from "@opencom/convex/dataModel";

export interface OfficeHoursStatus {
  isOpen: boolean;
  offlineMessage: string | null;
  expectedReplyTimeMinutes: number | null;
}

export function useOfficeHours() {
  const { workspaceId } = useOpencomContext();

  const status = useQuery(
    api.officeHours.isCurrentlyOpen,
    workspaceId ? { workspaceId: workspaceId as Id<"workspaces"> } : "skip"
  );

  const expectedReplyTime = useQuery(
    api.officeHours.getExpectedReplyTime,
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
