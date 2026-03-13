"use client";

import type { Id } from "@opencom/convex/dataModel";
import type { OutboundMessageStatus, OutboundMessageType } from "@opencom/types";
import {
  useWebMutation,
  useWebQuery,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type MessageArgs = {
  id: Id<"outboundMessages">;
};

const OUTBOUND_MESSAGES_LIST_QUERY_REF = webQueryRef<
  WorkspaceArgs & {
    type?: OutboundMessageType;
    status?: OutboundMessageStatus;
  },
  Array<{
    _id: Id<"outboundMessages">;
    name: string;
    type: OutboundMessageType;
    status: OutboundMessageStatus;
    createdAt: number;
    content: { text?: string; title?: string; body?: string };
  }>
>("outboundMessages:list");
const CREATE_OUTBOUND_MESSAGE_REF = webMutationRef<
  WorkspaceArgs & {
    type: OutboundMessageType;
    name: string;
    content:
      | { text: string }
      | {
          title: string;
          body: string;
          buttons: Array<{ text: string; action: "open_new_conversation" | "dismiss" }>;
        }
      | { text: string; style: string; dismissible: boolean };
    targeting?: unknown;
    triggers?: unknown;
    frequency?: unknown;
    scheduling?: unknown;
    priority?: number;
  },
  Id<"outboundMessages">
>("outboundMessages:create");
const DELETE_OUTBOUND_MESSAGE_REF = webMutationRef<MessageArgs, null>("outboundMessages:remove");
const ACTIVATE_OUTBOUND_MESSAGE_REF = webMutationRef<MessageArgs, null>(
  "outboundMessages:activate"
);
const PAUSE_OUTBOUND_MESSAGE_REF = webMutationRef<MessageArgs, null>("outboundMessages:pause");

export function useOutboundMessagesPageConvex(
  workspaceId?: Id<"workspaces"> | null,
  type?: OutboundMessageType,
  status?: OutboundMessageStatus
) {
  return {
    activateMessage: useWebMutation(ACTIVATE_OUTBOUND_MESSAGE_REF),
    createMessage: useWebMutation(CREATE_OUTBOUND_MESSAGE_REF),
    deleteMessage: useWebMutation(DELETE_OUTBOUND_MESSAGE_REF),
    messages: useWebQuery(
      OUTBOUND_MESSAGES_LIST_QUERY_REF,
      workspaceId ? { workspaceId, type, status } : "skip"
    ),
    pauseMessage: useWebMutation(PAUSE_OUTBOUND_MESSAGE_REF),
  };
}
