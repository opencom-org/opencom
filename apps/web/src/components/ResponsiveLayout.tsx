"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const DEFAULT_COMPACT_BREAKPOINT = 1024;

function joinClasses(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(" ");
}

export interface ResponsivePageShellProps {
  children: React.ReactNode;
  className?: string;
  "data-testid"?: string;
}

export function ResponsivePageShell({
  children,
  className,
  "data-testid": dataTestId,
}: ResponsivePageShellProps): React.JSX.Element {
  return (
    <div
      className={joinClasses(
        "h-full min-h-0 flex flex-col gap-4 sm:gap-6 overflow-hidden px-4 py-4 sm:px-6 sm:py-6",
        className
      )}
      data-testid={dataTestId}
    >
      {children}
    </div>
  );
}

interface ResponsiveRegionProps {
  children: React.ReactNode;
  className?: string;
  "data-testid"?: string;
}

export function ResponsivePrimaryRegion({
  children,
  className,
  "data-testid": dataTestId,
}: ResponsiveRegionProps): React.JSX.Element {
  return (
    <section
      className={joinClasses("min-h-0 min-w-0", className)}
      data-region="primary"
      data-testid={dataTestId}
    >
      {children}
    </section>
  );
}

export function ResponsiveSecondaryRegion({
  children,
  className,
  "data-testid": dataTestId,
}: ResponsiveRegionProps): React.JSX.Element {
  return (
    <aside
      className={joinClasses("min-h-0 min-w-0", className)}
      data-region="secondary"
      data-testid={dataTestId}
    >
      {children}
    </aside>
  );
}

export function useIsCompactViewport(breakpoint = DEFAULT_COMPACT_BREAKPOINT): boolean {
  const [isCompactViewport, setIsCompactViewport] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(`(max-width: ${Math.max(0, breakpoint - 1)}px)`);
    const update = () => {
      setIsCompactViewport(mediaQuery.matches);
    };

    update();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
      return () => {
        mediaQuery.removeEventListener("change", update);
      };
    }

    mediaQuery.addListener(update);
    return () => {
      mediaQuery.removeListener(update);
    };
  }, [breakpoint]);

  return isCompactViewport;
}

export interface AdaptiveSecondaryPanelProps {
  isCompact: boolean;
  isOpen: boolean;
  panelTestId: string;
  onOpenChange: (open: boolean) => void;
  onAfterClose?: () => void;
  closeLabel?: string;
  desktopMode?: "inline" | "slideout";
  desktopContainerClassName?: string;
  compactContainerClassName?: string;
  children: React.ReactNode;
}

export function AdaptiveSecondaryPanel({
  isCompact,
  isOpen,
  panelTestId,
  onOpenChange,
  onAfterClose,
  closeLabel = "Close panel",
  desktopMode = "inline",
  desktopContainerClassName,
  compactContainerClassName,
  children,
}: AdaptiveSecondaryPanelProps): React.JSX.Element | null {
  const closePanel = () => {
    onOpenChange(false);
    onAfterClose?.();
  };

  useEffect(() => {
    if (!isCompact || !isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      closePanel();
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isCompact, isOpen]);

  if (!isOpen) {
    return null;
  }

  if (!isCompact && desktopMode === "slideout") {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/35" aria-hidden="true" onClick={closePanel} />
        <aside
          className={joinClasses(
            "fixed inset-y-0 right-0 z-50 w-full border-l bg-background shadow-2xl",
            desktopContainerClassName ?? "max-w-md"
          )}
          style={{
            paddingTop: "max(0.75rem, env(safe-area-inset-top))",
            paddingRight: "max(0.75rem, env(safe-area-inset-right))",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
            paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
          }}
          data-testid={panelTestId}
        >
          <button
            type="button"
            onClick={closePanel}
            className="absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm"
            aria-label={closeLabel}
            data-testid={`${panelTestId}-close`}
          >
            <X className="h-4 w-4" />
          </button>
          <div className="h-full min-h-0 overflow-y-auto pt-10">{children}</div>
        </aside>
      </>
    );
  }

  if (!isCompact) {
    return (
      <aside className={desktopContainerClassName} data-testid={panelTestId}>
        {children}
      </aside>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/45" aria-hidden="true" onClick={closePanel} />
      <aside
        className={joinClasses(
          "fixed inset-y-0 right-0 z-50 w-full max-w-md border-l bg-background shadow-2xl",
          compactContainerClassName
        )}
        style={{
          paddingTop: "max(0.75rem, env(safe-area-inset-top))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right))",
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
          paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
        }}
        data-testid={panelTestId}
      >
        <button
          type="button"
          onClick={closePanel}
          className="absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm"
          aria-label={closeLabel}
          data-testid={`${panelTestId}-close`}
        >
          <X className="h-4 w-4" />
        </button>
        <div className="h-full min-h-0 overflow-y-auto pt-10">{children}</div>
      </aside>
    </>
  );
}
