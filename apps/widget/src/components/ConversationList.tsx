import type { Id } from "@opencom/convex/dataModel";
import { MessageCircle } from "../icons";
import { formatTime } from "../utils/format";

interface Conversation {
  _id: Id<"conversations">;
  lastMessage?: { content: string; senderType: string } | null;
  unreadByVisitor?: number;
  lastMessageAt?: number;
  createdAt: number;
}

interface ConversationListProps {
  conversations: Conversation[] | undefined;
  onSelectConversation: (id: Id<"conversations">) => void;
  onNewConversation: () => void;
}

export function ConversationList({
  conversations,
  onSelectConversation,
  onNewConversation,
}: ConversationListProps) {
  return (
    <div className="opencom-conversation-list">
      {conversations?.map((conv) => {
        const unreadCount = conv.unreadByVisitor ?? 0;
        const hasUnread = unreadCount > 0;

        return (
          <button
            key={conv._id}
            className={`opencom-conversation-item ${hasUnread ? "opencom-conversation-item-unread" : ""}`}
            onClick={() => onSelectConversation(conv._id)}
          >
            <div className="opencom-conversation-icon">
              <MessageCircle />
            </div>
            <div className="opencom-conversation-preview">
              <span
                className={`opencom-conversation-message ${hasUnread ? "opencom-conversation-message-unread" : ""}`}
              >
                {conv.lastMessage?.content || "No messages yet"}
              </span>
              <div className="opencom-conversation-meta">
                {hasUnread && (
                  <span className="opencom-unread-count">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
                <span className="opencom-conversation-time">
                  {conv.lastMessageAt ? formatTime(conv.lastMessageAt) : formatTime(conv.createdAt)}
                </span>
              </div>
            </div>
          </button>
        );
      })}
      {(!conversations || conversations.length === 0) && (
        <div className="opencom-empty-list">
          <div className="opencom-empty-icon">
            <MessageCircle />
          </div>
          <h3>Welcome!</h3>
          <p>
            We&apos;re here to help. Start a conversation and we&apos;ll get back to you shortly.
          </p>
          <button onClick={onNewConversation} className="opencom-start-conv">
            Start a conversation
          </button>
        </div>
      )}
    </div>
  );
}
