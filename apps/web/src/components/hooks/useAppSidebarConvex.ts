"use client";

import type { Id } from "@opencom/convex/dataModel";
import { useWebQuery, webQueryRef } from "@/lib/convex/hooks";

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type IntegrationSignalsRecord = {
  integrations: Array<{ isActiveNow: boolean }>;
} | null;

type SidebarConversationRecord = Array<{
  _id: string;
  unreadByAgent?: number;
}>;

const INTEGRATION_SIGNALS_QUERY_REF = webQueryRef<WorkspaceArgs, IntegrationSignalsRecord>(
  "workspaces:getHostedOnboardingIntegrationSignals"
);
const SIDEBAR_CONVERSATIONS_QUERY_REF = webQueryRef<WorkspaceArgs, SidebarConversationRecord>(
  "conversations:list"
);

export function useAppSidebarConvex(
  workspaceId?: Id<"workspaces"> | null,
  shouldLoadConversations = false
) {
  return {
    integrationSignals: useWebQuery(
      INTEGRATION_SIGNALS_QUERY_REF,
      workspaceId ? { workspaceId } : "skip"
    ),
    sidebarConversations: useWebQuery(
      SIDEBAR_CONVERSATIONS_QUERY_REF,
      workspaceId && shouldLoadConversations ? { workspaceId } : "skip"
    ),
  };
}
