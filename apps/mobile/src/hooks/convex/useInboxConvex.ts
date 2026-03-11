import type { Id } from "@opencom/convex/dataModel";
import { mobileQueryRef, useMobileQuery } from "../../lib/convex/hooks";
import type { MobileConversationStatus, MobileInboxPageResult } from "./types";

type VisitorArgs = {
  visitorId: Id<"visitors">;
};

type InboxArgs = {
  workspaceId: Id<"workspaces">;
  status?: MobileConversationStatus;
};

const VISITOR_IS_ONLINE_QUERY_REF = mobileQueryRef<VisitorArgs, boolean>("visitors:isOnline");
const INBOX_LIST_QUERY_REF = mobileQueryRef<InboxArgs, MobileInboxPageResult>(
  "conversations:listForInbox"
);

type UseInboxConvexOptions = {
  workspaceId?: Id<"workspaces"> | null;
  status?: MobileConversationStatus;
};

export function useInboxConvex({ workspaceId, status }: UseInboxConvexOptions) {
  const inboxArgs = workspaceId
    ? {
        workspaceId,
        ...(status ? { status } : {}),
      }
    : "skip";

  return {
    inboxPage: useMobileQuery(INBOX_LIST_QUERY_REF, inboxArgs),
  };
}

export function useVisitorPresenceConvex(visitorId?: string | Id<"visitors"> | null) {
  const resolvedVisitorId = visitorId ? (visitorId as Id<"visitors">) : null;

  return {
    isOnline: useMobileQuery(
      VISITOR_IS_ONLINE_QUERY_REF,
      resolvedVisitorId ? { visitorId: resolvedVisitorId } : "skip"
    ),
  };
}
