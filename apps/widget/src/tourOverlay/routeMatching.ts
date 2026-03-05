function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wildcardMatch(pattern: string, value: string): boolean {
  const regex = new RegExp(`^${escapeRegex(pattern).replace(/\\\*/g, ".*")}$`);
  return regex.test(value);
}

export function evaluateRouteMatch(
  routePath: string | undefined,
  currentUrl: string
): { matches: boolean; invalidRoute: boolean } {
  const normalizedRoute = routePath?.trim();
  if (!normalizedRoute) {
    return { matches: true, invalidRoute: false };
  }

  let parsedCurrent: URL;
  try {
    parsedCurrent = new URL(currentUrl);
  } catch {
    return { matches: false, invalidRoute: false };
  }

  const currentAbsolute = `${parsedCurrent.origin}${parsedCurrent.pathname}${parsedCurrent.search}`;
  const currentPath = `${parsedCurrent.pathname}${parsedCurrent.search}`;

  if (/^https?:\/\//i.test(normalizedRoute)) {
    let parsedRoute: URL;
    try {
      parsedRoute = new URL(normalizedRoute);
    } catch {
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
