"use client";

import { useState } from "react";
import { Button, Card } from "@opencom/ui";
import { Copy, Check, Code, ChevronDown, ChevronUp, ChevronRight } from "lucide-react";

type InstallScenarioId = "plain_js" | "next_app_router" | "next_pages_router" | "react_spa";

interface InstallScenario {
  id: InstallScenarioId;
  label: string;
  description: string;
  snippet: string;
}

interface WidgetInstallGuideProps {
  convexUrl: string;
  workspaceId: string;
  onboardingVerificationToken?: string | null;
  isOpenByDefault?: boolean;
  title?: string;
  description?: string;
}

export function WidgetInstallGuide({
  convexUrl,
  workspaceId,
  onboardingVerificationToken,
  isOpenByDefault = false,
  title = "Widget Installation",
  description = "Add the chat widget to your website",
}: WidgetInstallGuideProps): React.JSX.Element {
  const [copiedSnippetKey, setCopiedSnippetKey] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isOpen, setIsOpen] = useState(isOpenByDefault);
  const [activeScenarioId, setActiveScenarioId] = useState<InstallScenarioId>("plain_js");

  const scriptTokenAttribute = onboardingVerificationToken
    ? `\n  data-opencom-onboarding-verification-token="${onboardingVerificationToken}"`
    : "";

  const scriptDataAttributes = `data-opencom-convex-url="${convexUrl}"
      data-opencom-workspace-id="${workspaceId}"
      data-opencom-track-page-views="true"${
        onboardingVerificationToken
          ? `\n      data-opencom-onboarding-verification-token="${onboardingVerificationToken}"`
          : ""
      }`;

  const installScenarios: InstallScenario[] = [
    {
      id: "plain_js",
      label: "Plain JS",
      description:
        "For static sites, server-rendered templates, or any page where you can add script tags.",
      snippet: `<script
  src="https://cdn.opencom.dev/widget.js"
  data-opencom-convex-url="${convexUrl}"
  data-opencom-workspace-id="${workspaceId}"
  data-opencom-track-page-views="true"${scriptTokenAttribute}
></script>`,
    },
    {
      id: "next_app_router",
      label: "Next.js App Router",
      description: "Create a reusable script component and include it once in app/layout.tsx.",
      snippet: `// app/components/OpencomWidgetScript.tsx
import Script from "next/script";

export function OpencomWidgetScript() {
  return (
    <Script
      id="opencom-widget-loader"
      src="https://cdn.opencom.dev/widget.js"
      strategy="afterInteractive"
      ${scriptDataAttributes}
    />
  );
}

// app/layout.tsx
import { OpencomWidgetScript } from "./components/OpencomWidgetScript";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <OpencomWidgetScript />
      </body>
    </html>
  );
}`,
    },
    {
      id: "next_pages_router",
      label: "Next.js Pages Router",
      description: "Inject the widget once in pages/_app.tsx using next/script.",
      snippet: `// pages/_app.tsx
import type { AppProps } from "next/app";
import Script from "next/script";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <Script
        id="opencom-widget-loader"
        src="https://cdn.opencom.dev/widget.js"
        strategy="afterInteractive"
        ${scriptDataAttributes}
      />
    </>
  );
}`,
    },
    {
      id: "react_spa",
      label: "React SPA",
      description: "Load once at app bootstrap and keep runtime APIs for identify/event tracking.",
      snippet: `// src/main.tsx (or your app bootstrap file)
window.opencomSettings = {
  convexUrl: "${convexUrl}",
  workspaceId: "${workspaceId}",
  trackPageViews: true,${
    onboardingVerificationToken
      ? `\n  onboardingVerificationToken: "${onboardingVerificationToken}",`
      : ""
  }
};

const script = document.createElement("script");
script.src = "https://cdn.opencom.dev/widget.js";
script.async = true;
document.head.appendChild(script);`,
    },
  ];

  const activeScenario =
    installScenarios.find((scenario) => scenario.id === activeScenarioId) ?? installScenarios[0];

  const runtimeSnippet = `// Call after your user logs in
window.OpencomWidget?.identify({
  email: "user@example.com",
  name: "Alex Johnson",
  userId: "user_123",
  company: "Northline Labs",
  customAttributes: {
    plan: "pro",
    signupDate: "2024-01-15",
  },
});

// Track custom product events
window.OpencomWidget?.trackEvent("feature_used", {
  featureName: "export",
});`;

  const handleCopy = async (snippet: string, key: string) => {
    await navigator.clipboard.writeText(snippet);
    setCopiedSnippetKey(key);
    setTimeout(() => {
      setCopiedSnippetKey((current) => (current === key ? null : current));
    }, 2000);
  };

  const installSnippetKey = `install:${activeScenario.id}`;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Code className="h-5 w-5" />
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {isOpen ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="px-6 pb-6">
          <p className="mb-4 text-sm text-muted-foreground">
            Choose the install flow that matches your stack. Each option loads the same widget
            runtime.
          </p>
          {onboardingVerificationToken && (
            <p className="mb-4 text-sm text-muted-foreground">
              This snippet includes a one-time onboarding verification token.
            </p>
          )}

          <div className="mb-4 space-y-2">
            <div className="flex flex-wrap gap-2">
              {installScenarios.map((scenario) => {
                const isActive = scenario.id === activeScenario.id;
                return (
                  <button
                    key={scenario.id}
                    type="button"
                    onClick={() => setActiveScenarioId(scenario.id)}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {scenario.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{activeScenario.description}</p>
          </div>

          <div className="relative">
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm font-mono">
              <code>{activeScenario.snippet}</code>
            </pre>
            <Button
              variant="outline"
              size="sm"
              className="absolute right-2 top-2"
              onClick={() => handleCopy(activeScenario.snippet, installSnippetKey)}
            >
              {copiedSnippetKey === installSnippetKey ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="mt-4">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {showAdvanced ? "Hide" : "Show"} runtime methods
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-4">
                <div className="space-y-2 text-sm">
                  <h3 className="font-medium">Configuration options</h3>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>
                      <code className="rounded bg-muted px-1">trackPageViews</code> - Automatically
                      track page views.
                    </li>
                    <li>
                      <code className="rounded bg-muted px-1">onboardingVerificationToken</code> -
                      Optional strict onboarding gate token.
                    </li>
                    <li>
                      <code className="rounded bg-muted px-1">user.userHash</code> - Optional HMAC
                      for identity verification.
                    </li>
                  </ul>
                </div>

                <div className="space-y-2 text-sm">
                  <h3 className="font-medium">Identify users and track events</h3>
                  <p className="text-muted-foreground">
                    Call widget runtime methods after your auth state loads.
                  </p>
                </div>

                <div className="relative">
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm font-mono">
                    <code>{runtimeSnippet}</code>
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute right-2 top-2"
                    onClick={() => handleCopy(runtimeSnippet, "runtime")}
                  >
                    {copiedSnippetKey === "runtime" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
