import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { Id } from "@opencom/convex/dataModel";
import { Widget } from "./Widget";
import { AuthoringOverlay } from "./AuthoringOverlay";
import { TooltipAuthoringOverlay } from "./TooltipAuthoringOverlay";
import widgetStyles from "./styles.css?inline";
import { setPortalTarget, setShadowHost } from "./portal";

interface UserIdentification {
  email?: string;
  name?: string;
  userId?: string;
  userHash?: string; // HMAC-SHA256 hash of userId for identity verification
  company?: string;
  customAttributes?: Record<string, unknown>;
}

interface WidgetConfig {
  workspaceId?: string;
  convexUrl: string;
  onboardingVerificationToken?: string;
  verificationToken?: string; // Deprecated alias for onboardingVerificationToken
  clientIdentifier?: string;
  user?: UserIdentification;
  trackPageViews?: boolean;
}

declare const __OPENCOM_WIDGET_VERSION__: string;

function getAuthoringToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("opencom_authoring");
}

function getTooltipAuthoringToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("opencom_tooltip_authoring");
}

function WidgetOrAuthoring({
  workspaceId,
  initialUser,
  convexUrl,
  trackPageViews,
  onboardingVerificationToken,
  clientVersion,
  clientIdentifier,
}: {
  workspaceId?: string;
  initialUser?: UserIdentification;
  convexUrl?: string;
  trackPageViews?: boolean;
  onboardingVerificationToken?: string;
  clientVersion?: string;
  clientIdentifier?: string;
}) {
  const [authoringToken, setAuthoringToken] = useState<string | null>(getAuthoringToken);
  const [tooltipAuthoringToken, setTooltipAuthoringToken] = useState<string | null>(
    getTooltipAuthoringToken
  );

  const handleExitAuthoring = () => {
    // Remove the authoring param from URL
    const url = new URL(window.location.href);
    url.searchParams.delete("opencom_authoring");
    window.history.replaceState({}, "", url.toString());
    setAuthoringToken(null);
  };

  const handleExitTooltipAuthoring = () => {
    // Remove the tooltip authoring param from URL
    const url = new URL(window.location.href);
    url.searchParams.delete("opencom_tooltip_authoring");
    window.history.replaceState({}, "", url.toString());
    setTooltipAuthoringToken(null);
  };

  // Listen for URL changes (in case of SPA navigation)
  useEffect(() => {
    const checkToken = () => {
      const token = getAuthoringToken();
      if (token !== authoringToken) {
        setAuthoringToken(token);
      }
      const tooltipToken = getTooltipAuthoringToken();
      if (tooltipToken !== tooltipAuthoringToken) {
        setTooltipAuthoringToken(tooltipToken);
      }
    };

    window.addEventListener("popstate", checkToken);
    return () => window.removeEventListener("popstate", checkToken);
  }, [authoringToken, tooltipAuthoringToken]);

  if (tooltipAuthoringToken) {
    if (!workspaceId || !/^[a-z0-9]{32}$/.test(workspaceId)) {
      return (
        <div
          className="opencom-tooltip-authoring-overlay opencom-authoring-error"
          data-testid="tooltip-authoring-workspace-error"
        >
          <div className="opencom-authoring-error-content">
            <h3>Session Error</h3>
            <p>Valid workspaceId is required for tooltip authoring.</p>
            <button onClick={handleExitTooltipAuthoring} className="opencom-authoring-btn">
              Close
            </button>
          </div>
        </div>
      );
    }
    return (
      <TooltipAuthoringOverlay
        token={tooltipAuthoringToken}
        workspaceId={workspaceId as Id<"workspaces">}
        onExit={handleExitTooltipAuthoring}
      />
    );
  }

  if (authoringToken) {
    return <AuthoringOverlay token={authoringToken} onExit={handleExitAuthoring} />;
  }

  return (
    <Widget
      workspaceId={workspaceId}
      initialUser={initialUser}
      convexUrl={convexUrl}
      trackPageViews={trackPageViews}
      onboardingVerificationToken={onboardingVerificationToken}
      clientVersion={clientVersion}
      clientIdentifier={clientIdentifier}
    />
  );
}

interface TourInfo {
  id: string;
  name: string;
  description?: string;
  status: "new" | "in_progress" | "completed";
  elementsAvailable: boolean;
}

interface EventProperties {
  [key: string]: unknown;
}

declare global {
  interface Window {
    OpencomWidget?: {
      init: (config: WidgetConfig) => void;
      identify: (user: UserIdentification) => void;
      trackEvent: (name: string, properties?: EventProperties) => void;
      startTour: (tourId: string) => void;
      getAvailableTours: () => TourInfo[];
      destroy: () => void;
    };
    opencomSettings?: Partial<WidgetConfig>;
    __OPENCOM_WIDGET_AUTO_INIT_CONFIG?: Partial<WidgetConfig>;
    __OPENCOM_WIDGET_DEPLOY_VERSION?: string;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function parseBooleanAttribute(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "") return true;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

function sanitizeAutoInitConfig(source: unknown): WidgetConfig | null {
  if (!isRecord(source)) return null;

  const convexUrl = typeof source.convexUrl === "string" ? source.convexUrl.trim() : "";
  if (!convexUrl) return null;

  const config: WidgetConfig = { convexUrl };

  if (typeof source.workspaceId === "string" && source.workspaceId.trim()) {
    config.workspaceId = source.workspaceId.trim();
  }

  if (
    typeof source.onboardingVerificationToken === "string" &&
    source.onboardingVerificationToken.trim()
  ) {
    config.onboardingVerificationToken = source.onboardingVerificationToken.trim();
  } else if (typeof source.verificationToken === "string" && source.verificationToken.trim()) {
    config.onboardingVerificationToken = source.verificationToken.trim();
  }

  if (typeof source.clientIdentifier === "string" && source.clientIdentifier.trim()) {
    config.clientIdentifier = source.clientIdentifier.trim();
  }

  if (typeof source.trackPageViews === "boolean") {
    config.trackPageViews = source.trackPageViews;
  }

  if (isRecord(source.user)) {
    config.user = source.user as UserIdentification;
  }

  return config;
}

function getScriptTagAutoInitConfig(): WidgetConfig | null {
  const scriptEl = document.currentScript as HTMLScriptElement | null;
  if (!scriptEl) return null;

  return sanitizeAutoInitConfig({
    convexUrl: scriptEl.dataset.opencomConvexUrl,
    workspaceId: scriptEl.dataset.opencomWorkspaceId,
    onboardingVerificationToken:
      scriptEl.dataset.opencomOnboardingVerificationToken ??
      scriptEl.dataset.opencomVerificationToken,
    clientIdentifier: scriptEl.dataset.opencomClientIdentifier,
    trackPageViews: parseBooleanAttribute(scriptEl.dataset.opencomTrackPageViews),
  });
}

function resolveAutoInitConfig(): WidgetConfig | null {
  const bootstrapConfig = sanitizeAutoInitConfig(window.__OPENCOM_WIDGET_AUTO_INIT_CONFIG);
  if (bootstrapConfig) {
    delete window.__OPENCOM_WIDGET_AUTO_INIT_CONFIG;
    return bootstrapConfig;
  }

  const globalSettingsConfig = sanitizeAutoInitConfig(window.opencomSettings);
  if (globalSettingsConfig) {
    return globalSettingsConfig;
  }

  return getScriptTagAutoInitConfig();
}

// References for cleanup
let activeRoot: ReturnType<typeof createRoot> | null = null;
let activeConvex: ConvexReactClient | null = null;

function getWidgetClientVersion(): string {
  if (
    typeof window.__OPENCOM_WIDGET_DEPLOY_VERSION === "string" &&
    window.__OPENCOM_WIDGET_DEPLOY_VERSION.trim().length > 0
  ) {
    return window.__OPENCOM_WIDGET_DEPLOY_VERSION.trim();
  }
  return __OPENCOM_WIDGET_VERSION__;
}

function init(config: WidgetConfig) {
  let container = document.getElementById("opencom-widget");

  if (!container) {
    container = document.createElement("div");
    container.id = "opencom-widget";
    document.body.appendChild(container);
  }

  // Use Shadow DOM for CSS isolation — host page styles cannot leak in
  const shadow = container.shadowRoot || container.attachShadow({ mode: "open" });

  // Inject widget CSS into shadow root (scoped, not in document.head).
  // Replace :root with :host so custom properties are scoped to the shadow.
  if (!shadow.querySelector("style[data-opencom]")) {
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-opencom", "");
    styleEl.textContent = widgetStyles.replace(/:root/g, ":host");
    shadow.appendChild(styleEl);
  }

  // React render target inside shadow root
  let renderTarget = shadow.querySelector("#opencom-shadow-root") as HTMLElement | null;
  if (!renderTarget) {
    renderTarget = document.createElement("div");
    renderTarget.id = "opencom-shadow-root";
    shadow.appendChild(renderTarget);
  }

  // Portal target for overlays (tours, tooltips) — must be inside the
  // shadow root so their CSS applies, but as a sibling of the render
  // target so they escape overflow:hidden on .opencom-chat.
  let portalEl = shadow.querySelector("#opencom-portal") as HTMLElement | null;
  if (!portalEl) {
    portalEl = document.createElement("div");
    portalEl.id = "opencom-portal";
    shadow.appendChild(portalEl);
  }
  setPortalTarget(portalEl);
  setShadowHost(container);

  // Clean up any previous instance
  if (activeRoot) {
    activeRoot.unmount();
  }
  if (activeConvex) {
    activeConvex.close();
  }

  const convex = new ConvexReactClient(config.convexUrl);
  activeConvex = convex;

  const root = createRoot(renderTarget);
  activeRoot = root;
  root.render(
    <StrictMode>
      <ConvexProvider client={convex}>
        <WidgetOrAuthoring
          workspaceId={config.workspaceId}
          initialUser={config.user}
          convexUrl={config.convexUrl}
          trackPageViews={config.trackPageViews}
          onboardingVerificationToken={
            config.onboardingVerificationToken ?? config.verificationToken
          }
          clientVersion={getWidgetClientVersion()}
          clientIdentifier={config.clientIdentifier}
        />
      </ConvexProvider>
    </StrictMode>
  );
}

let currentIdentifyCallback: ((user: UserIdentification) => void) | null = null;
let currentTrackEventCallback: ((name: string, properties?: EventProperties) => void) | null = null;
let currentStartTourCallback: ((tourId: string) => void) | null = null;
let currentGetAvailableToursCallback: (() => TourInfo[]) | null = null;

function identify(user: UserIdentification) {
  if (currentIdentifyCallback) {
    currentIdentifyCallback(user);
  }
}

function trackEvent(name: string, properties?: EventProperties) {
  if (currentTrackEventCallback) {
    currentTrackEventCallback(name, properties);
  } else {
    console.warn("[Opencom Widget] Widget not initialized, event not tracked:", name);
  }
}

function startTour(tourId: string) {
  if (currentStartTourCallback) {
    currentStartTourCallback(tourId);
  } else {
    console.error("[Opencom Widget] Widget not initialized or tour not found");
  }
}

function getAvailableTours(): TourInfo[] {
  if (currentGetAvailableToursCallback) {
    return currentGetAvailableToursCallback();
  }
  console.warn("[Opencom Widget] Widget not initialized");
  return [];
}

function destroy() {
  if (activeRoot) {
    activeRoot.unmount();
    activeRoot = null;
  }
  if (activeConvex) {
    activeConvex.close();
    activeConvex = null;
  }
  const container = document.getElementById("opencom-widget");
  if (container) {
    container.remove();
  }
  currentIdentifyCallback = null;
  currentTrackEventCallback = null;
  currentStartTourCallback = null;
  currentGetAvailableToursCallback = null;
  setPortalTarget(null as unknown as HTMLElement);
  setShadowHost(null as unknown as HTMLElement);
}

export function setIdentifyCallback(callback: (user: UserIdentification) => void) {
  currentIdentifyCallback = callback;
}

export function setTrackEventCallback(
  callback: (name: string, properties?: EventProperties) => void
) {
  currentTrackEventCallback = callback;
}

export function setStartTourCallback(callback: (tourId: string) => void) {
  currentStartTourCallback = callback;
}

export function setGetAvailableToursCallback(callback: () => TourInfo[]) {
  currentGetAvailableToursCallback = callback;
}

window.OpencomWidget = { init, identify, trackEvent, startTour, getAvailableTours, destroy };

const autoInitConfig = resolveAutoInitConfig();

if (autoInitConfig) {
  init(autoInitConfig);
} else if (import.meta.env.DEV) {
  const devConvexUrl = import.meta.env.VITE_CONVEX_URL;
  const devWorkspaceId = import.meta.env.VITE_WORKSPACE_ID;
  if (!devWorkspaceId) {
    console.warn("[Opencom Widget] VITE_WORKSPACE_ID not set. Set it in .env.local");
  }
  init({
    convexUrl: devConvexUrl,
    workspaceId: devWorkspaceId,
  });
}

export { init, identify, trackEvent, startTour, getAvailableTours, destroy };
export type { UserIdentification, WidgetConfig, EventProperties };
