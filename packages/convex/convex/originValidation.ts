import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

function parseHttpOrigin(value: string): URL | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function matchesAllowedOrigin(origin: string, allowed: string): boolean {
  const parsedOrigin = parseHttpOrigin(origin);
  if (!parsedOrigin) {
    return false;
  }

  const normalizedAllowed = allowed.trim();
  if (!normalizedAllowed) {
    return false;
  }

  // Wildcard host entry (e.g. "*.example.com")
  if (normalizedAllowed.startsWith("*.")) {
    const domain = normalizedAllowed.slice(2).trim().toLowerCase();
    if (!domain || domain.includes("/") || domain.includes(":")) {
      return false;
    }

    const host = parsedOrigin.hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  }

  const parsedAllowed = parseHttpOrigin(normalizedAllowed);
  if (!parsedAllowed) {
    return false;
  }

  return parsedOrigin.origin === parsedAllowed.origin;
}

/**
 * Validates that the request origin is allowed for the given workspace.
 *
 * When the workspace has a non-empty `allowedOrigins` list, the provided
 * origin MUST match one of the configured entries. A missing or empty
 * origin is rejected when the allowlist is configured.
 *
 * When no allowlist is configured (empty or undefined), all origins are
 * permitted for development convenience and a console warning is logged.
 *
 * @returns `{ valid: true }` when the origin is acceptable, or
 *          `{ valid: false, reason: string }` when it should be rejected.
 */
export async function validateVisitorOrigin(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  origin: string | undefined
): Promise<{ valid: true } | { valid: false; reason: string }> {
  const workspace = await ctx.db.get(workspaceId);
  if (!workspace) {
    return { valid: false, reason: "Workspace not found" };
  }

  const allowedOrigins = workspace.allowedOrigins as string[] | undefined;

  // No allowlist configured — allow everything (dev mode)
  if (!allowedOrigins || allowedOrigins.length === 0) {
    return { valid: true };
  }

  // Allowlist is configured but the caller sent no origin
  if (!origin) {
    return {
      valid: false,
      reason: "Origin header is required when allowed origins are configured",
    };
  }

  const parsedOrigin = parseHttpOrigin(origin);
  if (!parsedOrigin) {
    return { valid: false, reason: "Origin must be a valid http(s) origin" };
  }

  const isAllowed = allowedOrigins.some((allowed) =>
    matchesAllowedOrigin(parsedOrigin.origin, allowed)
  );

  if (!isAllowed) {
    return { valid: false, reason: "Origin not in allowed list" };
  }

  return { valid: true };
}

/**
 * Convenience wrapper that throws a ConvexError when the origin is not
 * allowed. Use inside visitor-facing mutations/queries that should be
 * gated behind origin validation.
 */
export async function requireValidOrigin(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  origin: string | undefined
): Promise<void> {
  const result = await validateVisitorOrigin(ctx, workspaceId, origin);
  if (!result.valid) {
    throw new Error(`Origin validation failed: ${result.reason}`);
  }
}
