import { useEffect, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";

interface TooltipTriggerContext {
  currentUrl?: string;
  timeOnPageSeconds?: number;
  scrollPercent?: number;
  firedEventName?: string;
  isExitIntent?: boolean;
}

interface UseNavigationTrackingOptions {
  trackPageViews: boolean | undefined;
  visitorId: Id<"visitors"> | null;
  activeWorkspaceId: string | undefined;
  sessionId: string;
  sessionTokenRef: React.MutableRefObject<string | null>;
  onTrackEvent: (name: string, properties?: Record<string, unknown>) => void;
  onTooltipContextChange: (updater: (prev: TooltipTriggerContext) => TooltipTriggerContext) => void;
}

/**
 * Tracks page views, scroll depth, exit intent, and session start/end events.
 *
 * Navigation detection uses a polling approach that subscribes to
 * `popstate` events and periodically checks `location.href` for SPA
 * pushState/replaceState changes.  This avoids monkey-patching
 * `history.pushState` / `history.replaceState` which can break host
 * application routing.
 */
export function useNavigationTracking({
  trackPageViews,
  visitorId,
  activeWorkspaceId,
  sessionId,
  sessionTokenRef,
  onTrackEvent,
  onTooltipContextChange,
}: UseNavigationTrackingOptions) {
  const lastTrackedUrl = useRef<string | null>(null);
  const sessionStartTracked = useRef(false);
  const maxScrollDepth = useRef(0);
  const scrollDepthThresholds = useRef(new Set<number>());

  const trackAutoEventMutation = useMutation(api.events.trackAutoEvent);

  const trackPageView = useCallback(() => {
    if (!visitorId || !activeWorkspaceId) return;

    const currentUrl = window.location.href;
    if (currentUrl === lastTrackedUrl.current) return;
    lastTrackedUrl.current = currentUrl;

    // Reset scroll tracking for new page
    maxScrollDepth.current = 0;
    scrollDepthThresholds.current.clear();

    // Update tooltip trigger context with new URL and reset scroll/exit intent
    onTooltipContextChange(() => ({
      currentUrl,
      timeOnPageSeconds: 0,
      scrollPercent: 0,
      firedEventName: undefined,
      isExitIntent: false,
    }));

    trackAutoEventMutation({
      workspaceId: activeWorkspaceId as Id<"workspaces">,
      visitorId,
      sessionToken: sessionTokenRef.current ?? undefined,
      eventType: "page_view",
      url: currentUrl,
      sessionId,
      properties: {
        title: document.title,
        referrer: document.referrer || null,
      },
    }).catch(console.error);
  }, [
    visitorId,
    activeWorkspaceId,
    sessionId,
    sessionTokenRef,
    trackAutoEventMutation,
    onTooltipContextChange,
  ]);

  useEffect(() => {
    if (!trackPageViews || !visitorId || !activeWorkspaceId) return;

    // Track session start on first page view
    if (!sessionStartTracked.current) {
      sessionStartTracked.current = true;
      trackAutoEventMutation({
        workspaceId: activeWorkspaceId as Id<"workspaces">,
        visitorId,
        sessionToken: sessionTokenRef.current ?? undefined,
        eventType: "session_start",
        url: window.location.href,
        sessionId,
        properties: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
        },
      }).catch(console.error);
    }

    // Track initial page view
    trackPageView();

    const timeOnPageInterval = setInterval(() => {
      onTooltipContextChange((prev) => ({
        ...prev,
        timeOnPageSeconds: (prev.timeOnPageSeconds ?? 0) + 1,
      }));
    }, 1000);

    // Subscribe to popstate for back/forward navigation
    const handlePopState = () => trackPageView();
    window.addEventListener("popstate", handlePopState);

    // Poll for URL changes caused by pushState/replaceState.
    // This is safer than overwriting history methods because it avoids
    // mutating globals that the host application depends on.
    let lastHref = window.location.href;
    const pollInterval = setInterval(() => {
      if (window.location.href !== lastHref) {
        lastHref = window.location.href;
        trackPageView();
      }
    }, 200);

    // Track session end on page unload
    const handleBeforeUnload = () => {
      trackAutoEventMutation({
        workspaceId: activeWorkspaceId as Id<"workspaces">,
        visitorId,
        sessionToken: sessionTokenRef.current ?? undefined,
        eventType: "session_end",
        url: window.location.href,
        sessionId,
        properties: {
          maxScrollDepth: maxScrollDepth.current,
        },
      });
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Track scroll depth at 25%, 50%, 75%, 90% thresholds
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;

      const scrollPercent = Math.round((scrollTop / scrollHeight) * 100);
      maxScrollDepth.current = Math.max(maxScrollDepth.current, scrollPercent);

      // Update tooltip trigger context with scroll depth
      onTooltipContextChange((prev) => ({ ...prev, scrollPercent }));

      const thresholds = [25, 50, 75, 90];
      for (const threshold of thresholds) {
        if (scrollPercent >= threshold && !scrollDepthThresholds.current.has(threshold)) {
          scrollDepthThresholds.current.add(threshold);
          onTrackEvent("scroll_depth", {
            depth: threshold,
            url: window.location.href,
          });
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Track exit intent (mouse leaving viewport at top - web only)
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        // Update tooltip trigger context for exit intent
        onTooltipContextChange((prev) => ({ ...prev, isExitIntent: true }));
        onTrackEvent("exit_intent", {
          url: window.location.href,
          scrollDepth: maxScrollDepth.current,
        });
      }
    };
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      clearInterval(pollInterval);
      clearInterval(timeOnPageInterval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [
    trackPageViews,
    visitorId,
    activeWorkspaceId,
    sessionId,
    sessionTokenRef,
    trackAutoEventMutation,
    onTrackEvent,
    onTooltipContextChange,
    trackPageView,
  ]);
}
