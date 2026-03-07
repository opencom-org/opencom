export interface RouteMatchResult {
  matches: boolean;
  invalidRoute: boolean;
}

interface RouteMatchOptions {
  matchWhenCurrentUrlMissing?: boolean;
}

export function normalizeRoutePath(routePath?: string): string | undefined {
  const trimmed = routePath?.trim();
  return trimmed ? trimmed : undefined;
}

function safeParseUrl(url?: string): URL | null {
  if (!url) return null;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wildcardMatch(pattern: string, value: string): boolean {
  const regex = new RegExp(`^${escapeRegex(pattern).replace(/\\\*/g, ".*")}$`);
  return regex.test(value);
}

export function evaluateRouteMatch(
  routePath: string | undefined,
  currentUrl?: string,
  options: RouteMatchOptions = {}
): RouteMatchResult {
  const normalizedRoute = normalizeRoutePath(routePath);
  if (!normalizedRoute) {
    return { matches: true, invalidRoute: false };
  }

  if (!currentUrl) {
    return {
      matches: options.matchWhenCurrentUrlMissing ?? false,
      invalidRoute: false,
    };
  }

  const parsedCurrent = safeParseUrl(currentUrl);
  if (!parsedCurrent) {
    return { matches: false, invalidRoute: false };
  }

  const currentAbsolute = `${parsedCurrent.origin}${parsedCurrent.pathname}${parsedCurrent.search}`;
  const currentPath = `${parsedCurrent.pathname}${parsedCurrent.search}`;

  if (/^https?:\/\//i.test(normalizedRoute)) {
    const parsedRoute = safeParseUrl(normalizedRoute);
    if (!parsedRoute) {
      return { matches: false, invalidRoute: true };
    }

    const routeAbsolute = `${parsedRoute.origin}${parsedRoute.pathname}${parsedRoute.search}`;
    if (routeAbsolute.includes("*")) {
      return { matches: wildcardMatch(routeAbsolute, currentAbsolute), invalidRoute: false };
    }

    return { matches: routeAbsolute === currentAbsolute, invalidRoute: false };
  }

  if (normalizedRoute.startsWith("/")) {
    if (normalizedRoute.includes("*")) {
      return { matches: wildcardMatch(normalizedRoute, currentPath), invalidRoute: false };
    }

    return {
      matches: normalizedRoute === currentPath || normalizedRoute === parsedCurrent.pathname,
      invalidRoute: false,
    };
  }

  if (normalizedRoute.includes("*")) {
    return {
      matches:
        wildcardMatch(normalizedRoute, currentAbsolute) ||
        wildcardMatch(normalizedRoute, currentPath),
      invalidRoute: false,
    };
  }

  return {
    matches:
      normalizedRoute === currentAbsolute ||
      normalizedRoute === currentPath ||
      normalizedRoute === parsedCurrent.pathname,
    invalidRoute: false,
  };
}
