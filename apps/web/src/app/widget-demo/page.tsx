"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Script from "next/script";
import { useAuthOptional } from "@/contexts/AuthContext";

/**
 * Widget Demo Page - Used for E2E testing of the widget
 * This page embeds the widget with test workspace configuration
 * and provides test target elements for tours and interactions.
 */
function WidgetDemoContent() {
  // next/script onLoad only fires once per page lifecycle, so if the user
  // navigates away and back, the script is already loaded but onLoad won't
  // fire again. Initialise from true if OpencomWidget is already on window.
  const [widgetLoaded, setWidgetLoaded] = useState(
    () => typeof window !== "undefined" && !!window.OpencomWidget
  );
  const [testMessage, setTestMessage] = useState("");
  const searchParams = useSearchParams();
  const auth = useAuthOptional();
  const activeWorkspace = auth?.activeWorkspace;

  // Get configuration from URL params, environment, or defaults
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";
  // Priority: URL param > env var > active workspace from auth session
  const workspaceId =
    searchParams.get("workspaceId") ||
    process.env.NEXT_PUBLIC_TEST_WORKSPACE_ID ||
    activeWorkspace?._id;

  useEffect(() => {
    if (!widgetLoaded || !window.OpencomWidget || !workspaceId || !convexUrl) return;

    window.OpencomWidget.init({
      convexUrl,
      workspaceId,
      trackPageViews: true,
      user: {
        email: "e2e_test_visitor@test.opencom.dev",
        name: "E2E Test Visitor",
        customAttributes: {
          plan: "test",
          source: "e2e-test",
        },
      },
    });

    // Destroy widget when navigating away from this page
    return () => {
      window.OpencomWidget?.destroy();
    };
  }, [widgetLoaded, convexUrl, workspaceId]);

  const handleTrackEvent = () => {
    if (window.OpencomWidget) {
      window.OpencomWidget.trackEvent("test_button_clicked", {
        source: "widget-demo",
        timestamp: Date.now(),
      });
      setTestMessage("Event tracked: test_button_clicked");
    }
  };

  const handleIdentify = () => {
    if (window.OpencomWidget) {
      window.OpencomWidget.identify({
        email: "identified_user@test.opencom.dev",
        name: "Identified Test User",
        customAttributes: {
          identified: true,
          identifiedAt: Date.now(),
        },
      });
      setTestMessage("User identified");
    }
  };

  return (
    <div className="p-6 space-y-8" data-testid="widget-demo-page">
      {/*
        Production points NEXT_PUBLIC_WIDGET_URL at the CDN loader.
        E2E/local runs keep the local bundle fallback for deterministic tests.
      */}
      <Script
        src={process.env.NEXT_PUBLIC_WIDGET_URL || "/opencom-widget.iife.js"}
        strategy="afterInteractive"
        onLoad={() => setWidgetLoaded(true)}
      />

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold" data-testid="page-title">
          Widget Demo
        </h1>
        <p className="text-muted-foreground mt-1">
          Preview your widget as visitors will see it. Use the controls below to test events and
          identification.
        </p>
      </div>

      {/* Main Content */}
      <div className="space-y-8">
        {/* Status Banner */}
        <div
          className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-8"
          data-testid="status-banner"
        >
          <p className="text-primary">
            Widget Status:{" "}
            {!workspaceId
              ? "⚠️ No workspace ID — log in to auto-detect or pass ?workspaceId=..."
              : widgetLoaded
                ? "✅ Loaded"
                : "⏳ Loading..."}
          </p>
          {testMessage && (
            <p className="text-primary mt-2" data-testid="test-message">
              {testMessage}
            </p>
          )}
        </div>

        {/* Tour Target Elements */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Tour Target Elements</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              className="bg-white p-6 rounded-lg shadow border-2 border-dashed border-gray-300"
              data-testid="tour-target-1"
              id="tour-target-1"
            >
              <h3 className="font-medium">Tour Target 1</h3>
              <p className="text-gray-500 text-sm">First step target element</p>
            </div>
            <div
              className="bg-white p-6 rounded-lg shadow border-2 border-dashed border-gray-300"
              data-testid="tour-target-2"
              id="tour-target-2"
            >
              <h3 className="font-medium">Tour Target 2</h3>
              <p className="text-gray-500 text-sm">Second step target element</p>
            </div>
            <div
              className="bg-white p-6 rounded-lg shadow border-2 border-dashed border-gray-300"
              data-testid="tour-target-3"
              id="tour-target-3"
            >
              <h3 className="font-medium">Tour Target 3</h3>
              <p className="text-gray-500 text-sm">Third step target element</p>
            </div>
          </div>
        </section>

        {/* Interactive Elements */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Interactive Elements</h2>
          <div className="flex flex-wrap gap-4">
            <button
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
              onClick={handleTrackEvent}
              data-testid="track-event-button"
            >
              Track Test Event
            </button>
            <button
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              onClick={handleIdentify}
              data-testid="identify-button"
            >
              Identify User
            </button>
            <button
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
              data-testid="action-button"
            >
              Action Button
            </button>
          </div>
        </section>

        {/* Form Element for Testing */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Test Form</h2>
          <div className="bg-white p-6 rounded-lg shadow max-w-md">
            <form data-testid="test-form" onSubmit={(e) => e.preventDefault()}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="Enter your name"
                  data-testid="name-input"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="Enter your email"
                  data-testid="email-input"
                />
              </div>
              <button
                type="submit"
                className="bg-primary text-white px-4 py-2 rounded hover:bg-primary"
                data-testid="submit-button"
              >
                Submit
              </button>
            </form>
          </div>
        </section>

        {/* Scrollable Content for Scroll Depth Testing */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Scrollable Content</h2>
          <div className="space-y-8">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className="bg-white p-6 rounded-lg shadow"
                data-testid={`scroll-section-${n}`}
                data-scroll-depth={n * 20}
              >
                <h3 className="font-medium mb-2">Section {n}</h3>
                <p className="text-gray-600">
                  This is section {n} of the scrollable content. It is used to test scroll depth
                  tracking at various thresholds. Lorem ipsum dolor sit amet, consectetur adipiscing
                  elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
                  ad minim veniam, quis nostrud exercitation ullamco laboris.
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Help Center Link for Testing */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Help Center Links</h2>
          <div className="flex gap-4">
            <a href="/help" className="text-primary hover:underline" data-testid="help-center-link">
              Visit Help Center
            </a>
            <a
              href="/help/getting-started"
              className="text-primary hover:underline"
              data-testid="article-link"
            >
              Getting Started Guide
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function WidgetDemoPage(): React.JSX.Element {
  return <WidgetDemoContent />;
}

// TypeScript declarations for the widget
declare global {
  interface Window {
    OpencomWidget?: {
      init: (config: {
        convexUrl: string;
        workspaceId?: string;
        trackPageViews?: boolean;
        user?: {
          email?: string;
          name?: string;
          userId?: string;
          userHash?: string;
          company?: string;
          customAttributes?: Record<string, unknown>;
        };
      }) => void;
      identify: (user: {
        email?: string;
        name?: string;
        customAttributes?: Record<string, unknown>;
      }) => void;
      trackEvent: (name: string, properties?: Record<string, unknown>) => void;
      startTour: (tourId: string) => void;
      getAvailableTours: () => Array<{
        id: string;
        name: string;
        status: string;
      }>;
      destroy: () => void;
    };
  }
}
