import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { Id } from "@opencom/convex/dataModel";

export type WidgetView =
  | "launcher"
  | "conversation-list"
  | "conversation"
  | "article-search"
  | "article-detail"
  | "tour-picker"
  | "checklist"
  | "tickets"
  | "ticket-detail"
  | "ticket-create";

export type MainTab = "messages" | "help" | "tours" | "tasks" | "tickets";

interface WidgetState {
  view: WidgetView;
  activeTab: MainTab;
  visitorId: Id<"visitors"> | null;
  conversationId: Id<"conversations"> | null;
  selectedArticleId: Id<"articles"> | null;
  selectedTicketId: Id<"tickets"> | null;
  previousView: WidgetView;
  workspaceId: string | undefined;
}

interface WidgetContextValue extends WidgetState {
  setView: (view: WidgetView) => void;
  setActiveTab: (tab: MainTab) => void;
  setVisitorId: (id: Id<"visitors"> | null) => void;
  setConversationId: (id: Id<"conversations"> | null) => void;
  setSelectedArticleId: (id: Id<"articles"> | null) => void;
  setSelectedTicketId: (id: Id<"tickets"> | null) => void;
  setPreviousView: (view: WidgetView) => void;
  openWidget: () => void;
  closeWidget: () => void;
  navigateBack: () => void;
}

const WidgetContext = createContext<WidgetContextValue | null>(null);

interface WidgetProviderProps {
  children: ReactNode;
  workspaceId?: string;
  initialVisitorId?: Id<"visitors"> | null;
}

export function WidgetProvider({
  children,
  workspaceId,
  initialVisitorId = null,
}: WidgetProviderProps) {
  const [view, setView] = useState<WidgetView>("launcher");
  const [activeTab, setActiveTab] = useState<MainTab>("messages");
  const [visitorId, setVisitorId] = useState<Id<"visitors"> | null>(initialVisitorId);
  const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<Id<"articles"> | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<Id<"tickets"> | null>(null);
  const [previousView, setPreviousView] = useState<WidgetView>("conversation-list");

  const openWidget = useCallback(() => {
    setView("conversation-list");
  }, []);

  const closeWidget = useCallback(() => {
    setView("launcher");
  }, []);

  const navigateBack = useCallback(() => {
    setView(previousView);
  }, [previousView]);

  const value: WidgetContextValue = {
    view,
    activeTab,
    visitorId,
    conversationId,
    selectedArticleId,
    selectedTicketId,
    previousView,
    workspaceId,
    setView,
    setActiveTab,
    setVisitorId,
    setConversationId,
    setSelectedArticleId,
    setSelectedTicketId,
    setPreviousView,
    openWidget,
    closeWidget,
    navigateBack,
  };

  return <WidgetContext.Provider value={value}>{children}</WidgetContext.Provider>;
}

export function useWidgetContext() {
  const context = useContext(WidgetContext);
  if (!context) {
    throw new Error("useWidgetContext must be used within a WidgetProvider");
  }
  return context;
}
