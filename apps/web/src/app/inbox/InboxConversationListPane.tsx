"use client";

import { useQuery } from "convex/react";
import { api } from "@opencom/convex";
import { Card } from "@opencom/ui";
import { Bot, Circle, Mail, MessageSquare, ShieldAlert } from "lucide-react";
import type { Id } from "@opencom/convex/dataModel";
import { ResponsiveSecondaryRegion } from "@/components/ResponsiveLayout";
import { type InboxAiWorkflowFilter, type InboxConversation } from "./inboxRenderTypes";

function PresenceIndicator({ visitorId }: { visitorId: Id<"visitors"> }): React.JSX.Element {
  const isOnline = useQuery(api.visitors.isOnline, { visitorId });
  return (
    <Circle
      className={`h-2 w-2 ${isOnline ? "fill-green-500 text-green-500" : "fill-gray-300 text-gray-300"}`}
    />
  );
}

interface InboxConversationListPaneProps {
  aiWorkflowFilter: InboxAiWorkflowFilter;
  onAiWorkflowFilterChange: (value: InboxAiWorkflowFilter) => void;
  isConversationsLoading: boolean;
  conversations: InboxConversation[] | undefined;
  selectedConversationId: Id<"conversations"> | null;
  readSyncConversationId: Id<"conversations"> | null;
  onSelectConversation: (conversationId: Id<"conversations">) => void;
  getConversationIdentityLabel: (conversation: InboxConversation) => string;
}

export function InboxConversationListPane({
  aiWorkflowFilter,
  onAiWorkflowFilterChange,
  isConversationsLoading,
  conversations,
  selectedConversationId,
  readSyncConversationId,
  onSelectConversation,
  getConversationIdentityLabel,
}: InboxConversationListPaneProps): React.JSX.Element {
  return (
    <ResponsiveSecondaryRegion className="min-h-0" data-testid="inbox-conversation-pane">
      <Card className="h-full overflow-hidden flex flex-col">
        <div className="p-4 border-b space-y-2">
          <h2 className="font-semibold">Conversations</h2>
          <div className="flex items-center gap-2">
            <label htmlFor="inbox-ai-filter" className="text-xs text-muted-foreground">
              AI workflow
            </label>
            <select
              id="inbox-ai-filter"
              value={aiWorkflowFilter}
              onChange={(event) =>
                onAiWorkflowFilterChange(event.target.value as InboxAiWorkflowFilter)
              }
              className="text-xs border rounded px-2 py-1 bg-background"
              data-testid="inbox-ai-filter"
            >
              <option value="all">All conversations</option>
              <option value="ai_handled">AI handled</option>
              <option value="handoff">AI handoff</option>
            </select>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto" data-testid="inbox-conversation-list">
          {isConversationsLoading ? (
            <div
              className="p-4 text-center text-muted-foreground"
              data-testid="inbox-conversations-loading"
            >
              <p>Loading conversations...</p>
            </div>
          ) : !conversations || conversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground" data-testid="inbox-empty-state">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No conversations yet</p>
              <p className="text-sm">
                Conversations will appear here when visitors start chatting via your widget
              </p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation._id}
                onClick={() => onSelectConversation(conversation._id)}
                data-testid={`conversation-item-${conversation._id}`}
                data-conversation-id={conversation._id}
                className={`w-full p-4 text-left border-b hover:bg-muted/50 transition-colors ${
                  selectedConversationId === conversation._id ? "bg-muted" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {conversation.channel === "email" ? (
                      <Mail className="h-4 w-4 text-primary-foreground0" />
                    ) : (
                      <MessageSquare className="h-4 w-4 text-green-500" />
                    )}
                    {conversation.visitorId && <PresenceIndicator visitorId={conversation.visitorId} />}
                    <span
                      className="font-medium"
                      data-testid={`conversation-label-${conversation._id}`}
                    >
                      {getConversationIdentityLabel(conversation)}
                    </span>
                    {conversation.visitor && conversation.visitor.identityVerified === false && (
                      <span
                        className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700"
                        title="Identity not verified"
                      >
                        <ShieldAlert className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {readSyncConversationId === conversation._id && (
                      <span className="text-xs text-muted-foreground">Syncing...</span>
                    )}
                    {typeof conversation.unreadByAgent === "number" && conversation.unreadByAgent > 0 && (
                      <span
                        className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full"
                        data-testid={`conversation-unread-badge-${conversation._id}`}
                      >
                        {conversation.unreadByAgent}
                      </span>
                    )}
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        conversation.status === "open"
                          ? "bg-green-100 text-green-700"
                          : conversation.status === "closed"
                            ? "bg-gray-100 text-gray-700"
                            : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {conversation.status}
                    </span>
                  </div>
                </div>
                {conversation.channel === "email" && conversation.subject && (
                  <p className="text-sm font-medium text-foreground mt-1 truncate">
                    {conversation.subject}
                  </p>
                )}
                {conversation.lastMessage && (
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {conversation.lastMessage.content}
                  </p>
                )}
                {conversation.aiWorkflow?.state && conversation.aiWorkflow.state !== "none" && (
                  <div
                    className="mt-1 flex items-center gap-2 text-xs"
                    data-testid={`conversation-ai-state-${conversation._id}`}
                  >
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                        conversation.aiWorkflow.state === "handoff"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      <Bot className="h-3 w-3" />
                      {conversation.aiWorkflow.state === "handoff" ? "AI handoff" : "AI handled"}
                    </span>
                    {conversation.aiWorkflow.state === "handoff" &&
                      conversation.aiWorkflow.handoffReason && (
                        <span
                          className="truncate text-amber-700"
                          data-testid={`conversation-ai-handoff-reason-${conversation._id}`}
                        >
                          {conversation.aiWorkflow.handoffReason}
                        </span>
                      )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(conversation.lastMessageAt || conversation.createdAt).toLocaleString()}
                </p>
              </button>
            ))
          )}
        </div>
      </Card>
    </ResponsiveSecondaryRegion>
  );
}
