"use client";

import type { Id } from "@opencom/convex/dataModel";
import type {
  MessageFrequency,
  MessageTrigger,
  OutboundMessageStatus,
  OutboundMessageType,
} from "@opencom/types";
import {
  useWebMutation,
  useWebQuery,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";
import type { InlineAudienceRule } from "@/lib/audienceRules";
import type { MessageContent } from "../[id]/editorState";

type OutboundMessageArgs = {
  id: Id<"outboundMessages">;
};

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type PublicArticlesArgs = WorkspaceArgs & {
  status: "published";
  visibility: "public";
};

type OutboundMessageRecord = {
  _id: Id<"outboundMessages">;
  name: string;
  type: OutboundMessageType;
  status: OutboundMessageStatus;
  content: MessageContent;
  triggers?: MessageTrigger;
  frequency?: MessageFrequency;
  audienceRules?: InlineAudienceRule | null;
  targeting?: InlineAudienceRule | null;
} | null;

type OutboundStatsRecord = {
  shown: number;
  clicked: number;
  dismissed: number;
  clickRate: number;
} | null;

type WorkspaceMemberRecord = {
  userId: Id<"users">;
  name?: string | null;
  email?: string | null;
};

type PublicArticleRecord = {
  _id: Id<"articles">;
  title: string;
};

type UpdateOutboundMessageArgs = {
  id: Id<"outboundMessages">;
  name: string;
  content: MessageContent;
  triggers: MessageTrigger;
  frequency: MessageFrequency;
  targeting?: InlineAudienceRule;
};

type ToggleOutboundMessageArgs = {
  id: Id<"outboundMessages">;
};

const OUTBOUND_MESSAGE_QUERY_REF = webQueryRef<OutboundMessageArgs, OutboundMessageRecord>(
  "outboundMessages:get"
);
const OUTBOUND_MESSAGE_STATS_QUERY_REF = webQueryRef<OutboundMessageArgs, OutboundStatsRecord>(
  "outboundMessages:getStats"
);
const WORKSPACE_MEMBERS_QUERY_REF = webQueryRef<WorkspaceArgs, WorkspaceMemberRecord[]>(
  "workspaceMembers:listByWorkspace"
);
const EVENT_NAMES_QUERY_REF = webQueryRef<WorkspaceArgs, string[]>("events:getDistinctNames");
const PUBLIC_ARTICLES_QUERY_REF = webQueryRef<PublicArticlesArgs, PublicArticleRecord[]>(
  "articles:list"
);
const UPDATE_OUTBOUND_MESSAGE_REF = webMutationRef<UpdateOutboundMessageArgs, null>(
  "outboundMessages:update"
);
const ACTIVATE_OUTBOUND_MESSAGE_REF = webMutationRef<ToggleOutboundMessageArgs, null>(
  "outboundMessages:activate"
);
const PAUSE_OUTBOUND_MESSAGE_REF = webMutationRef<ToggleOutboundMessageArgs, null>(
  "outboundMessages:pause"
);

type UseOutboundMessageEditorConvexOptions = {
  messageId: Id<"outboundMessages">;
  workspaceId?: Id<"workspaces"> | null;
};

export function useOutboundMessageEditorConvex({
  messageId,
  workspaceId,
}: UseOutboundMessageEditorConvexOptions) {
  return {
    activateMessage: useWebMutation(ACTIVATE_OUTBOUND_MESSAGE_REF),
    eventNames: useWebQuery(EVENT_NAMES_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
    members: useWebQuery(WORKSPACE_MEMBERS_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
    message: useWebQuery(OUTBOUND_MESSAGE_QUERY_REF, { id: messageId }),
    pauseMessage: useWebMutation(PAUSE_OUTBOUND_MESSAGE_REF),
    publicArticles: useWebQuery(
      PUBLIC_ARTICLES_QUERY_REF,
      workspaceId
        ? { workspaceId, status: "published", visibility: "public" }
        : "skip"
    ),
    stats: useWebQuery(OUTBOUND_MESSAGE_STATS_QUERY_REF, { id: messageId }),
    updateMessage: useWebMutation(UPDATE_OUTBOUND_MESSAGE_REF),
  };
}
