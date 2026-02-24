import type { DiscoveryResponse, BackendValidationResult } from "./backend";

const DISCOVERY_REQUEST_TIMEOUT_MS = 10000;

/**
 * Convert a Convex URL to the HTTP endpoint URL.
 * Convex Cloud URLs use .convex.cloud for the real-time API
 * but .convex.site for HTTP endpoints.
 */
function getHttpEndpointUrl(url: string): string {
  // Convert .convex.cloud to .convex.site for HTTP endpoints
  return url.replace(/\.convex\.cloud$/, ".convex.site");
}

export async function validateBackendUrl(url: string): Promise<BackendValidationResult> {
  // Normalize URL
  let normalizedUrl = url.trim();

  // Add https:// if no protocol specified
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  // Reject HTTP URLs (require HTTPS)
  if (normalizedUrl.startsWith("http://")) {
    return {
      valid: false,
      error: "HTTPS is required for secure connections",
    };
  }

  // Remove trailing slash
  normalizedUrl = normalizedUrl.replace(/\/$/, "");

  try {
    // Convert to HTTP endpoint URL (e.g., .convex.cloud -> .convex.site)
    const httpEndpointUrl = getHttpEndpointUrl(normalizedUrl);
    const discoveryUrl = `${httpEndpointUrl}/.well-known/opencom.json`;

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    if (controller) {
      timeoutHandle = setTimeout(() => {
        controller.abort();
      }, DISCOVERY_REQUEST_TIMEOUT_MS);
    }

    const response = await fetch(discoveryUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller?.signal,
    });

    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    if (!response.ok) {
      return {
        valid: false,
        error: "Server is not a valid Opencom instance",
      };
    }

    const data = await response.json();

    // Validate required fields
    if (!data.version || !data.name || !data.convexUrl) {
      return {
        valid: false,
        error: "Server is not a valid Opencom instance (missing required fields)",
      };
    }

    const discovery: DiscoveryResponse = {
      version: data.version,
      name: data.name,
      convexUrl: data.convexUrl,
      features: data.features,
      signupMode: data.signupMode,
      authMethods: data.authMethods,
    };

    return {
      valid: true,
      discovery,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        valid: false,
        error:
          "Could not connect to server. Discovery request timed out after " +
          `${Math.floor(DISCOVERY_REQUEST_TIMEOUT_MS / 1000)}s. Please check the URL and network, then try again.`,
      };
    }

    return {
      valid: false,
      error: "Could not connect to server. Please check the URL and try again.",
    };
  }
}

export function normalizeBackendUrl(url: string): string {
  let normalized = url.trim();

  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    normalized = `https://${normalized}`;
  }

  return normalized.replace(/\/$/, "");
}
