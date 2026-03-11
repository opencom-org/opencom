"use client";

import type { Id } from "@opencom/convex/dataModel";
import { useWebQuery, webQueryRef } from "@/lib/convex/hooks";

type VisitorOnlineArgs = {
  visitorId: Id<"visitors">;
};

const VISITOR_ONLINE_QUERY_REF = webQueryRef<VisitorOnlineArgs, boolean>("visitors:isOnline");

export function useInboxConversationListPaneConvex(visitorId: Id<"visitors">) {
  return {
    isOnline: useWebQuery(VISITOR_ONLINE_QUERY_REF, { visitorId }),
  };
}
