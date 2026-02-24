"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Script from "next/script";
import { useAuthOptional } from "@/contexts/AuthContext";

export default function WidgetPreviewPage(): React.JSX.Element {
  const [widgetLoaded, setWidgetLoaded] = useState(
    () => typeof window !== "undefined" && !!window.OpencomWidget
  );
  const searchParams = useSearchParams();
  const auth = useAuthOptional();
  const activeWorkspace = auth?.activeWorkspace;

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";
  const workspaceId = searchParams.get("workspaceId") || activeWorkspace?._id;
  const previewUser = useMemo(
    () => ({
      email: auth?.user?.email || "preview-user@example.com",
      name: auth?.user?.name || "Widget Preview User",
    }),
    [auth?.user?.email, auth?.user?.name]
  );

  useEffect(() => {
    if (!widgetLoaded || !window.OpencomWidget || !workspaceId || !convexUrl) return;

    window.OpencomWidget.init({
      convexUrl,
      workspaceId,
      trackPageViews: true,
      user: {
        email: previewUser.email,
        name: previewUser.name,
        customAttributes: {
          previewMode: "dashboard-widget-preview",
        },
      },
    });

    return () => {
      window.OpencomWidget?.destroy();
    };
  }, [convexUrl, previewUser.email, previewUser.name, widgetLoaded, workspaceId]);

  const status = !workspaceId
    ? "No active workspace. Select a workspace to preview."
    : !convexUrl
      ? "NEXT_PUBLIC_CONVEX_URL is missing."
      : widgetLoaded
        ? "Loaded"
        : "Loading...";

  return (
    <div className="p-6 space-y-6">
      <Script
        src={process.env.NEXT_PUBLIC_WIDGET_URL || "/opencom-widget.iife.js"}
        strategy="afterInteractive"
        onLoad={() => setWidgetLoaded(true)}
      />

      <div>
        <h1 className="text-2xl font-bold">Widget Preview</h1>
        <p className="text-muted-foreground mt-1">
          Preview the live widget using your current workspace settings (colors, home cards, tours,
          and outbound content).
        </p>
      </div>

      <section className="rounded-lg border bg-card p-4 space-y-2">
        <p className="text-sm">
          <span className="font-medium">Status:</span> {status}
        </p>
        {workspaceId && (
          <p className="text-sm text-muted-foreground break-all">
            Workspace: <code>{workspaceId}</code>
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          The widget launcher appears in the lower corner of this page after loading.
        </p>
      </section>
    </div>
  );
}
