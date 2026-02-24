"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@opencom/convex";
import {
  Inbox,
  FileText,
  MessageSquareText,
  Settings,
  LogOut,
  Route,
  Info,
  BookOpen,
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
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
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
  const integrationSignals = useQuery(
    api.workspaces.getHostedOnboardingIntegrationSignals,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );
  const hasActiveWidgetOrSdk = (integrationSignals?.integrations ?? []).some(
    (signal) => signal.isActiveNow
  );
  const navItems: SidebarNavItem[] = hasActiveWidgetOrSdk
    ? [...CORE_NAV_ITEMS, ONBOARDING_NAV_ITEM, SETTINGS_NAV_ITEM]
    : [ONBOARDING_NAV_ITEM, ...CORE_NAV_ITEMS, SETTINGS_NAV_ITEM];

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
                  {item.label}
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
