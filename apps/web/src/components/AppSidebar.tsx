"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import type { Id } from "@opencom/convex/dataModel";
import {
  Inbox,
  FileText,
  MessageSquareText,
  Settings,
  LogOut,
  Route,
  Info,
  Ticket,
  ClipboardList,
  BarChart3,
  Send,
  Megaphone,
  Sparkles,
  ListChecks,
  Users,
  Eye,
  UserRound,
  Shield,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  INBOX_CUE_PREFERENCES_UPDATED_EVENT,
  buildUnreadSnapshot,
  getUnreadIncreases,
  loadInboxCuePreferences,
} from "@/lib/inboxNotificationCues";
import { playInboxBingSound } from "@/lib/playInboxBingSound";
import { WorkspaceSelector } from "./WorkspaceSelector";

type SidebarNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const ONBOARDING_NAV_ITEM: SidebarNavItem = {
  href: "/onboarding",
  label: "Onboarding",
  icon: Sparkles,
};

const SETTINGS_NAV_ITEM: SidebarNavItem = {
  href: "/settings",
  label: "Settings",
  icon: Settings,
};

const CORE_NAV_ITEMS: SidebarNavItem[] = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/visitors", label: "Visitors", icon: UserRound },
  { href: "/segments", label: "Segments", icon: Users },
  { href: "/outbound", label: "Outbound", icon: Send },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/tours", label: "Tours", icon: Route },
  { href: "/tooltips", label: "Tooltips", icon: Info },
  { href: "/checklists", label: "Checklists", icon: ListChecks },
  { href: "/surveys", label: "Surveys", icon: ClipboardList },
  { href: "/articles", label: "Articles", icon: FileText },
  { href: "/snippets", label: "Snippets", icon: MessageSquareText },
  { href: "/widget-preview", label: "Widget Preview", icon: Eye },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/audit-logs", label: "Audit Logs", icon: Shield },
];

interface AppSidebarProps {
  className?: string;
  onNavigate?: () => void;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export function AppSidebar({
  className,
  onNavigate,
  onClose,
  showCloseButton = false,
}: AppSidebarProps): React.JSX.Element {
  const pathname = usePathname();
  const { activeWorkspace, logout, user } = useAuth();
  const isAdmin = activeWorkspace?.role === "owner" || activeWorkspace?.role === "admin";
  const integrationSignalsQuery = makeFunctionReference<
    "query",
    { workspaceId: Id<"workspaces"> },
    { integrations: Array<{ isActiveNow: boolean }> }
  >("workspaces:getHostedOnboardingIntegrationSignals");
  const sidebarConversationsQuery = makeFunctionReference<
    "query",
    { workspaceId: Id<"workspaces"> },
    Array<{ _id: string; unreadByAgent?: number }>
  >("conversations:list");
  const integrationSignals = useQuery(
    integrationSignalsQuery,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );
  const sidebarConversations = useQuery(
    sidebarConversationsQuery,
    activeWorkspace?._id && isAdmin ? { workspaceId: activeWorkspace._id } : "skip"
  );
  const inboxCuePreferencesRef = useRef<{
    browserNotifications: boolean;
    sound: boolean;
  }>({
    browserNotifications: false,
    sound: true,
  });
  const unreadSnapshotRef = useRef<Record<string, number> | null>(null);
  const hasActiveWidgetOrSdk = (integrationSignals?.integrations ?? []).some(
    (signal) => signal.isActiveNow
  );
  const navItems: SidebarNavItem[] = hasActiveWidgetOrSdk
    ? [...CORE_NAV_ITEMS, ONBOARDING_NAV_ITEM, SETTINGS_NAV_ITEM]
    : [ONBOARDING_NAV_ITEM, ...CORE_NAV_ITEMS, SETTINGS_NAV_ITEM];
  const inboxUnreadCount = useMemo(
    () =>
      sidebarConversations?.reduce((sum, conversation) => sum + (conversation.unreadByAgent ?? 0), 0) ??
      0,
    [sidebarConversations]
  );
  const showInboxUnreadBadge = isAdmin && inboxUnreadCount > 0;
  const inboxUnreadBadgeLabel = inboxUnreadCount > 99 ? "99+" : String(inboxUnreadCount);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const refreshCuePreferences = () => {
      inboxCuePreferencesRef.current = loadInboxCuePreferences(window.localStorage);
    };
    refreshCuePreferences();
    window.addEventListener("storage", refreshCuePreferences);
    window.addEventListener(INBOX_CUE_PREFERENCES_UPDATED_EVENT, refreshCuePreferences);
    return () => {
      window.removeEventListener("storage", refreshCuePreferences);
      window.removeEventListener(INBOX_CUE_PREFERENCES_UPDATED_EVENT, refreshCuePreferences);
    };
  }, []);

  useEffect(() => {
    unreadSnapshotRef.current = null;
  }, [activeWorkspace?._id, isAdmin]);

  useEffect(() => {
    if (!isAdmin || !sidebarConversations || typeof window === "undefined") {
      return;
    }

    const previousSnapshot = unreadSnapshotRef.current;
    const currentSnapshot = buildUnreadSnapshot(
      sidebarConversations.map((conversation) => ({
        _id: conversation._id,
        unreadByAgent: conversation.unreadByAgent,
      }))
    );
    unreadSnapshotRef.current = currentSnapshot;

    if (!previousSnapshot || pathname === "/inbox" || pathname.startsWith("/inbox/")) {
      return;
    }

    const increasedConversationIds = getUnreadIncreases({
      previous: previousSnapshot,
      conversations: sidebarConversations.map((conversation) => ({
        _id: conversation._id,
        unreadByAgent: conversation.unreadByAgent,
      })),
    });
    if (increasedConversationIds.length === 0) {
      return;
    }

    if (inboxCuePreferencesRef.current.sound) {
      playInboxBingSound();
    }
  }, [isAdmin, pathname, sidebarConversations]);

  return (
    <aside className={`w-64 bg-white border-r flex flex-col h-full ${className ?? ""}`}>
      {/* Logo / Brand */}
      <div className="p-4 border-b flex items-center justify-between">
        <Link href="/inbox" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <MessageSquareText className="h-5 w-5 text-white" />
          </div>
          <span className="font-semibold text-lg">Opencom</span>
        </Link>
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose ?? onNavigate}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Close navigation"
            data-testid="app-mobile-nav-close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Workspace Selector */}
      <div className="p-3 border-b">
        <WorkspaceSelector />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="flex-1">{item.label}</span>
                  {item.href === "/inbox" && showInboxUnreadBadge && (
                    <span
                      className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white"
                      data-testid="sidebar-inbox-unread-badge"
                    >
                      {inboxUnreadBadgeLabel}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User section */}
      <div className="p-3 border-t">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || user?.email || "User"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <button
            onClick={() => {
              onNavigate?.();
              void logout();
            }}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
