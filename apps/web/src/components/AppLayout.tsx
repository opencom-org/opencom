"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { useAuthOptional } from "@/contexts/AuthContext";
import { useBackend } from "@/contexts/BackendContext";
import { AppSidebar } from "./AppSidebar";
import { BackendSelector } from "./BackendSelector";
import { WorkspaceSelectionModal } from "./WorkspaceSelectionModal";
import {
  ResponsivePageShell,
  type ResponsivePageShellProps,
  useIsCompactViewport,
} from "./ResponsiveLayout";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps): React.JSX.Element | null {
  const router = useRouter();
  const { activeBackend, isLoading: backendLoading } = useBackend();
  const auth = useAuthOptional();
  const isCompactViewport = useIsCompactViewport();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const hasAuthProvider = auth !== null;
  const user = auth?.user ?? null;
  const authLoading = auth?.isLoading ?? false;
  const needsWorkspaceSelection = auth?.needsWorkspaceSelection ?? false;

  useEffect(() => {
    if (!isCompactViewport && mobileNavOpen) {
      setMobileNavOpen(false);
    }
  }, [isCompactViewport, mobileNavOpen]);

  useEffect(() => {
    if (!hasAuthProvider) {
      return;
    }

    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, hasAuthProvider, user, router]);

  if (backendLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!activeBackend) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <BackendSelector />
        </div>
      </div>
    );
  }

  if (!hasAuthProvider) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Connecting...</p>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {!isCompactViewport && <AppSidebar />}
      <div className="flex-1 min-w-0 flex flex-col">
        {isCompactViewport && (
          <header className="h-14 border-b bg-background px-4 flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
              data-testid="app-mobile-nav-toggle"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span className="font-semibold">Opencom</span>
          </header>
        )}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      {isCompactViewport && mobileNavOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/45"
            aria-hidden="true"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw]">
            <AppSidebar
              className="shadow-2xl"
              showCloseButton
              onNavigate={() => setMobileNavOpen(false)}
              onClose={() => setMobileNavOpen(false)}
            />
          </div>
        </>
      )}
      {needsWorkspaceSelection && <WorkspaceSelectionModal />}
    </div>
  );
}

export function AppPageShell(props: ResponsivePageShellProps): React.JSX.Element {
  return <ResponsivePageShell {...props} />;
}
