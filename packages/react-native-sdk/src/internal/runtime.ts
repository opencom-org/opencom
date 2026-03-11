import { getConfig, getVisitorState } from "@opencom/sdk-core";
import type { Id } from "@opencom/convex/dataModel";

type WorkspaceId = Id<"workspaces">;
type VisitorId = Id<"visitors">;

export type SdkTransportContext = {
  workspaceId: WorkspaceId | null;
  visitorId: VisitorId | null;
  sessionId: string | null;
  sessionToken: string | null;
};

export function readConfiguredWorkspaceId(): WorkspaceId | null {
  try {
    return getConfig().workspaceId as WorkspaceId;
  } catch {
    return null;
  }
}

export function getSdkVisitorTransport(): Omit<SdkTransportContext, "workspaceId"> {
  const state = getVisitorState();

  return {
    visitorId: (state.visitorId as VisitorId | null) ?? null,
    sessionId: state.sessionId ?? null,
    sessionToken: state.sessionToken ?? null,
  };
}

export function getSdkTransportContext(workspaceId?: string | null): SdkTransportContext {
  return {
    workspaceId: (workspaceId as WorkspaceId | null) ?? readConfiguredWorkspaceId(),
    ...getSdkVisitorTransport(),
  };
}

export function hasVisitorSessionTransport(
  context: Pick<SdkTransportContext, "visitorId" | "sessionToken">
): context is {
  visitorId: VisitorId;
  sessionToken: string;
} {
  return Boolean(context.visitorId && context.sessionToken);
}

export function hasVisitorWorkspaceTransport(
  context: Pick<SdkTransportContext, "workspaceId" | "visitorId" | "sessionToken">
): context is {
  workspaceId: WorkspaceId;
  visitorId: VisitorId;
  sessionToken: string;
} {
  return Boolean(context.workspaceId && context.visitorId && context.sessionToken);
}
