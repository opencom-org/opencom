import type { Id } from "@opencom/convex/dataModel";
import { useOptionalOpencomContext } from "../components/OpencomProvider";
import {
  getSdkVisitorTransport,
  readConfiguredWorkspaceId,
  type SdkTransportContext,
} from "./runtime";

export function useSdkResolvedWorkspaceId(workspaceId?: string | null) {
  const context = useOptionalOpencomContext();
  return (
    ((workspaceId ?? context?.workspaceId ?? readConfiguredWorkspaceId()) as Id<"workspaces"> | null) ??
    null
  );
}

export function useSdkTransportContext(workspaceId?: string | null): SdkTransportContext {
  return {
    workspaceId: useSdkResolvedWorkspaceId(workspaceId),
    ...getSdkVisitorTransport(),
  };
}
