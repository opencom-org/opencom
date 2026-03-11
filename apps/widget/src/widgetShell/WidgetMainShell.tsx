import type { ReactNode } from "react";
import { MessageCircle, X, Plus, Search, Map, CheckSquare, Ticket, Home } from "../icons";
import type { MainTab } from "../hooks/useWidgetTabVisibility";

interface WidgetMainShellProps {
  title: string;
  showNewConversationAction: boolean;
  resolvedActiveTab: MainTab;
  isTabVisible: (tab: MainTab) => boolean;
  onNewConversation: () => void | Promise<void>;
  onCloseWidget: () => void;
  onTabChange: (tab: MainTab) => void;
  normalizedUnreadCount: number;
  availableTourCount: number;
  children: ReactNode;
}

export function WidgetMainShell({
  title,
  showNewConversationAction,
  resolvedActiveTab,
  isTabVisible,
  onNewConversation,
  onCloseWidget,
  onTabChange,
  normalizedUnreadCount,
  availableTourCount,
  children,
}: WidgetMainShellProps) {
  return (
    <div className="opencom-chat">
      <div className="opencom-header">
        <span>{title}</span>
        <div className="opencom-header-actions">
          {showNewConversationAction && (
            <button
              onClick={() => {
                void onNewConversation();
              }}
              className="opencom-new-conv"
              title="New conversation"
            >
              <Plus />
            </button>
          )}
          <button onClick={onCloseWidget} className="opencom-close">
            <X />
          </button>
        </div>
      </div>

      <div className="opencom-tab-content">{children}</div>

      <div className="opencom-bottom-nav">
        {isTabVisible("home") && (
          <button
            onClick={() => onTabChange("home")}
            className={`opencom-nav-item ${resolvedActiveTab === "home" ? "opencom-nav-item-active" : ""}`}
            title="Home"
          >
            <Home />
            <span>Home</span>
          </button>
        )}

        {isTabVisible("messages") && (
          <button
            onClick={() => onTabChange("messages")}
            className={`opencom-nav-item ${resolvedActiveTab === "messages" ? "opencom-nav-item-active" : ""}`}
            title="Conversations"
          >
            <MessageCircle />
            <span>Messages</span>
            {normalizedUnreadCount > 0 && (
              <span className="opencom-nav-badge opencom-nav-badge-alert">
                {normalizedUnreadCount > 99 ? "99+" : normalizedUnreadCount}
              </span>
            )}
          </button>
        )}

        {isTabVisible("help") && (
          <button
            onClick={() => onTabChange("help")}
            className={`opencom-nav-item ${resolvedActiveTab === "help" ? "opencom-nav-item-active" : ""}`}
            title="Help Center"
          >
            <Search />
            <span>Help</span>
          </button>
        )}

        {isTabVisible("tours") && (
          <button
            onClick={() => onTabChange("tours")}
            className={`opencom-nav-item ${resolvedActiveTab === "tours" ? "opencom-nav-item-active" : ""}`}
            title="Product Tours"
          >
            <Map />
            <span>Tours</span>
            {availableTourCount > 0 && <span className="opencom-nav-badge">{availableTourCount}</span>}
          </button>
        )}

        {isTabVisible("tasks") && (
          <button
            onClick={() => onTabChange("tasks")}
            className={`opencom-nav-item ${resolvedActiveTab === "tasks" ? "opencom-nav-item-active" : ""}`}
            title="Tasks"
          >
            <CheckSquare />
            <span>Tasks</span>
          </button>
        )}

        {isTabVisible("tickets") && (
          <button
            onClick={() => onTabChange("tickets")}
            className={`opencom-nav-item ${resolvedActiveTab === "tickets" ? "opencom-nav-item-active" : ""}`}
            title="My Tickets"
          >
            <Ticket />
            <span>Tickets</span>
          </button>
        )}
      </div>
    </div>
  );
}
