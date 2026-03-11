"use client";

import type { Id } from "@opencom/convex/dataModel";
import { useWebQuery, webQueryRef } from "@/lib/convex/hooks";

type PresenceFilter = "all" | "online" | "offline";

type VisitorsDirectoryArgs = {
  workspaceId: Id<"workspaces">;
  search?: string;
  presence?: PresenceFilter;
  limit?: number;
  offset?: number;
};

type VisitorDirectoryRecord = {
  _id: Id<"visitors">;
  readableId?: string;
  name?: string;
  email?: string;
  externalUserId?: string;
  isOnline: boolean;
  lastActiveAt?: number;
};

export type VisitorDirectoryResult =
  | {
      status: "ok";
      visitors: VisitorDirectoryRecord[];
      totalCount: number;
      hasMore: boolean;
      nextOffset: number | null;
    }
  | {
      status: "unauthenticated" | "forbidden";
      visitors: [];
      totalCount: 0;
      hasMore: false;
      nextOffset: null;
    };

export type VisitorDirectoryDetailResult =
  | {
      status: "ok";
      visitor: {
        _id: Id<"visitors">;
        readableId?: string;
        name?: string;
        email?: string;
        externalUserId?: string;
        sessionId?: string;
        lastActiveAt?: number;
        isOnline: boolean;
        referrer?: string;
        currentUrl?: string;
        customAttributes?: Record<string, unknown>;
        location?: { city?: string; region?: string; country?: string };
        device?: { deviceType?: string; os?: string; browser?: string };
      };
      resourceAccess: { conversations: boolean; tickets: boolean };
      linkedConversations: Array<{
        _id: Id<"conversations">;
        subject?: string;
        status?: string;
        channel?: string;
        lastMessagePreview?: string;
      }>;
      linkedTickets: Array<{
        _id: Id<"tickets">;
        subject: string;
        status: string;
        priority: string;
      }>;
    }
  | {
      status: "not_found" | "unauthenticated" | "forbidden";
      visitor: null;
      resourceAccess: { conversations: boolean; tickets: boolean };
      linkedConversations: [];
      linkedTickets: [];
    };

type VisitorDetailArgs = {
  workspaceId: Id<"workspaces">;
  visitorId: Id<"visitors">;
};

const VISITORS_DIRECTORY_QUERY_REF = webQueryRef<VisitorsDirectoryArgs, VisitorDirectoryResult>(
  "visitors:listDirectory"
);
const VISITOR_DETAIL_QUERY_REF = webQueryRef<VisitorDetailArgs, VisitorDirectoryDetailResult>(
  "visitors:getDirectoryDetail"
);

export function useVisitorsPageConvex(
  workspaceId?: Id<"workspaces">,
  search?: string,
  presence: PresenceFilter = "all",
  offset = 0,
  limit = 20
) {
  return {
    directoryResult: useWebQuery(
      VISITORS_DIRECTORY_QUERY_REF,
      workspaceId
        ? {
            workspaceId,
            search: search && search.length > 0 ? search : undefined,
            presence,
            limit,
            offset,
          }
        : "skip"
    ),
  };
}

export function useVisitorDetailConvex(
  workspaceId?: Id<"workspaces">,
  visitorId?: Id<"visitors">
) {
  return {
    detail: useWebQuery(
      VISITOR_DETAIL_QUERY_REF,
      workspaceId && visitorId ? { workspaceId, visitorId } : "skip"
    ),
  };
}
