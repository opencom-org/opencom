import { ConvexReactClient } from "convex/react";
import type { SDKConfig } from "../types";

let convexClient: ConvexReactClient | null = null;
let currentConfig: SDKConfig | null = null;

const LOOPBACK_HTTP_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizeUrl(url: URL): string {
  return url.href.endsWith("/") ? url.href.slice(0, -1) : url.href;
}

export function validateConvexUrl(convexUrl: string): string {
  const trimmed = convexUrl.trim();
  if (!trimmed) {
    throw new Error("[OpencomSDK] convexUrl is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("[OpencomSDK] convexUrl must be a valid URL.");
  }

  if (parsed.protocol === "https:") {
    return normalizeUrl(parsed);
  }

  if (parsed.protocol !== "http:") {
    throw new Error("[OpencomSDK] convexUrl must use https://.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!LOOPBACK_HTTP_HOSTS.has(hostname)) {
    throw new Error(
      "[OpencomSDK] Insecure http:// convexUrl is only allowed for localhost or 127.0.0.1 development."
    );
  }

  return normalizeUrl(parsed);
}

export function initializeClient(config: SDKConfig): ConvexReactClient {
  const normalizedConvexUrl = validateConvexUrl(config.convexUrl);
  if (convexClient && currentConfig?.convexUrl === normalizedConvexUrl) {
    return convexClient;
  }

  convexClient = new ConvexReactClient(normalizedConvexUrl);
  currentConfig = {
    ...config,
    convexUrl: normalizedConvexUrl,
  };

  if (config.debug) {
    console.log("[OpencomSDK] Client initialized with URL:", normalizedConvexUrl);
  }

  return convexClient;
}

export function getClient(): ConvexReactClient {
  if (!convexClient) {
    throw new Error("[OpencomSDK] Client not initialized. Call OpencomSDK.initialize() first.");
  }
  return convexClient;
}

export function getConfig(): SDKConfig {
  if (!currentConfig) {
    throw new Error("[OpencomSDK] SDK not initialized. Call OpencomSDK.initialize() first.");
  }
  return currentConfig;
}

export function isInitialized(): boolean {
  return convexClient !== null && currentConfig !== null;
}

export function resetClient(): void {
  convexClient = null;
  currentConfig = null;
}
