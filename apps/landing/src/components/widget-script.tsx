import Script from "next/script";

const configuredWidgetUrl = process.env.NEXT_PUBLIC_WIDGET_URL;
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const workspaceId = process.env.NEXT_PUBLIC_WORKSPACE_ID;
const defaultWidgetUrl =
  process.env.NODE_ENV === "development"
    ? "/opencom-widget.iife.js"
    : "https://cdn.opencom.dev/widget.js";
const widgetUrl = configuredWidgetUrl || defaultWidgetUrl;

export function WidgetScript() {
  if (!convexUrl) return null;

  return (
    <Script
      id="opencom-widget-loader"
      src={widgetUrl}
      strategy="afterInteractive"
      data-opencom-convex-url={convexUrl}
      data-opencom-workspace-id={workspaceId}
    />
  );
}
