import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { AutomationScope } from "../automationScopes";

export type AutomationContext = {
  credentialId: Id<"automationCredentials">;
  workspaceId: Id<"workspaces">;
  scopes: string[];
  actorName: string;
};

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type RunFn = (ref: unknown, args: Record<string, unknown>) => Promise<unknown>;

// Reference to our internal lookup/rate-limit functions using makeFunctionReference
// to avoid dependency on generated api types.
const lookupCredentialRef = makeFunctionReference<"query">(
  "lib/automationAuth:lookupCredential"
);
const checkRateLimitRef = makeFunctionReference<"mutation">(
  "lib/automationAuth:checkRateLimit"
);

// Called from httpAction context to authenticate an API request.
// Returns AutomationContext on success or a Response on failure.
export async function withAutomationAuth(
  ctx: { runQuery: RunFn; runMutation: RunFn },
  request: Request,
  requiredScope: AutomationScope
): Promise<AutomationContext | Response> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid Authorization header" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const token = authHeader.slice(7);
  if (!token.startsWith("osk_")) {
    return new Response(
      JSON.stringify({ error: "Invalid token format" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const secretHash = await sha256Hex(token);

  const result = (await ctx.runQuery(lookupCredentialRef, {
    secretHash,
    requiredScope,
  })) as { error: string; status: number } | AutomationContext;

  if ("error" in result) {
    return new Response(
      JSON.stringify({ error: result.error }),
      { status: result.status, headers: { "Content-Type": "application/json" } }
    );
  }

  // Check rate limit and update lastUsedAt
  const rateLimitResult = (await ctx.runMutation(checkRateLimitRef, {
    credentialId: result.credentialId,
    workspaceId: result.workspaceId,
  })) as { allowed: boolean; retryAfter?: number };

  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded" }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rateLimitResult.retryAfter ?? 60),
        },
      }
    );
  }

  return result;
}

// Internal query to look up a credential by secret hash and validate it.
export const lookupCredential = internalQuery({
  args: {
    secretHash: v.string(),
    requiredScope: v.string(),
  },
  handler: async (ctx, args): Promise<{ error: string; status: number } | AutomationContext> => {
    const credential = await ctx.db
      .query("automationCredentials")
      .withIndex("by_secret_hash", (q) => q.eq("secretHash", args.secretHash))
      .first();

    if (!credential) {
      return { error: "Invalid API key", status: 401 };
    }

    if (credential.status !== "active") {
      return { error: "API key is disabled", status: 403 };
    }

    if (credential.expiresAt && credential.expiresAt < Date.now()) {
      return { error: "API key has expired", status: 403 };
    }

    // Check workspace has automation enabled
    const workspace = await ctx.db.get(credential.workspaceId);
    if (!workspace) {
      return { error: "Workspace not found", status: 404 };
    }

    if (!workspace.automationApiEnabled) {
      return { error: "Automation API is not enabled for this workspace", status: 403 };
    }

    // Check scope
    if (!credential.scopes.includes(args.requiredScope)) {
      return { error: `Insufficient scope: requires ${args.requiredScope}`, status: 403 };
    }

    return {
      credentialId: credential._id,
      workspaceId: credential.workspaceId,
      scopes: credential.scopes,
      actorName: credential.actorName,
    };
  },
});

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute

// Internal mutation to check rate limit and update lastUsedAt.
export const checkRateLimit = internalMutation({
  args: {
    credentialId: v.id("automationCredentials"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const credential = await ctx.db.get(args.credentialId);
    if (!credential) {
      return { allowed: false, retryAfter: 60 };
    }

    const windowStart = credential.rateLimitWindowStart ?? 0;
    const count = credential.rateLimitCount ?? 0;

    if (now > windowStart + RATE_LIMIT_WINDOW_MS) {
      // New window
      await ctx.db.patch(args.credentialId, {
        lastUsedAt: now,
        rateLimitCount: 1,
        rateLimitWindowStart: now,
      });
      return { allowed: true };
    }

    if (count >= RATE_LIMIT_MAX_REQUESTS) {
      const retryAfter = Math.ceil((windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000);
      return { allowed: false, retryAfter };
    }

    await ctx.db.patch(args.credentialId, {
      lastUsedAt: now,
      rateLimitCount: count + 1,
    });
    return { allowed: true };
  },
});
