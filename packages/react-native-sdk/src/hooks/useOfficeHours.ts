import { sdkQueryRef, useSdkQuery } from "../internal/convex";
import { useSdkResolvedWorkspaceId } from "../internal/opencomContext";

export interface OfficeHoursStatus {
  isOpen: boolean;
  offlineMessage: string | null;
  expectedReplyTimeMinutes: number | null;
}

const CURRENTLY_OPEN_REF = sdkQueryRef("officeHours:isCurrentlyOpen");
const EXPECTED_REPLY_TIME_REF = sdkQueryRef("officeHours:getExpectedReplyTime");

export function useOfficeHours() {
  const workspaceId = useSdkResolvedWorkspaceId();

  const status = useSdkQuery<OfficeHoursStatus>(
    CURRENTLY_OPEN_REF,
    workspaceId ? { workspaceId } : "skip"
  );

  const expectedReplyTime = useSdkQuery<number | null>(
    EXPECTED_REPLY_TIME_REF,
    workspaceId ? { workspaceId } : "skip"
  );

  return {
    isOpen: status?.isOpen ?? true,
    offlineMessage: status?.offlineMessage ?? null,
    expectedReplyTime: expectedReplyTime ?? null,
    expectedReplyTimeMinutes: status?.expectedReplyTimeMinutes ?? null,
    isLoading: status === undefined,
  };
}
