/**
 * Admin gateway for calling internal test data mutations from external scripts.
 *
 * Internal mutations (internalMutation) cannot be called via the public HTTP API.
 * This public action validates a shared secret and dispatches to the requested
 * internal mutation, providing a controlled admin entry point.
 *
 * Security:
 * - Requires TEST_ADMIN_SECRET env var to be set on the Convex deployment
 * - Caller must provide the matching secret
 * - Only functions in "testData" and "testing" modules are allowed
 * - The ALLOW_TEST_DATA env var guard inside each mutation still applies
 */

import { makeFunctionReference } from "convex/server";
import { action } from "./_generated/server";
import { v } from "convex/values";

const ALLOWED_MODULE_PREFIXES = ["testData", "testing"];
const SECRET_ENCODER = new TextEncoder();

function normalizeSecret(secret: string): string {
  return secret.normalize("NFKC");
}

function toSecretBytes(secret: string): Uint8Array {
  return SECRET_ENCODER.encode(normalizeSecret(secret));
}

function getInternalRef(name: string): unknown {
  return makeFunctionReference(name);
}

function getShallowRunMutation(ctx: { runMutation: unknown }) {
  return ctx.runMutation as unknown as (
    mutationRef: unknown,
    mutationArgs: Record<string, unknown>
  ) => Promise<unknown>;
}

function parseMutationArgsJson(mutationArgsJson: string): Record<string, unknown> {
  if (!mutationArgsJson.trim()) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(mutationArgsJson);
  } catch {
    throw new Error("mutationArgsJson must be valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("mutationArgsJson must decode to a JSON object.");
  }

  return parsed as Record<string, unknown>;
}

export function isAuthorizedAdminSecret(providedSecret: string, expectedSecret: string): boolean {
  const providedBytes = toSecretBytes(providedSecret);
  const expectedBytes = toSecretBytes(expectedSecret);

  if (providedBytes.length === 0 || expectedBytes.length === 0) {
    return false;
  }

  if (providedBytes.length !== expectedBytes.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < providedBytes.length; i += 1) {
    mismatch |= providedBytes[i] ^ expectedBytes[i];
  }

  return mismatch === 0;
}

export const runTestMutation = action({
  args: {
    secret: v.string(),
    name: v.string(),
    mutationArgsJson: v.string(),
  },
  handler: async (ctx, { secret, name, mutationArgsJson }) => {
    // Validate admin secret
    const expected = process.env.TEST_ADMIN_SECRET;
    if (!expected) {
      throw new Error("TEST_ADMIN_SECRET is not configured on this Convex deployment.");
    }
    if (!isAuthorizedAdminSecret(secret, expected)) {
      throw new Error("Unauthorized: invalid admin secret.");
    }

    // Parse function path: "testData:seedTour" or "testing/helpers:cleanupE2ETestData"
    const colonIdx = name.indexOf(":");
    if (colonIdx === -1) {
      throw new Error(
        `Invalid function name "${name}". Expected format: "module:function" (e.g. "testData:seedTour").`
      );
    }
    const modulePath = name.slice(0, colonIdx);

    // Security: only allow test-related modules
    const topModule = modulePath.split("/")[0];
    if (!ALLOWED_MODULE_PREFIXES.includes(topModule)) {
      throw new Error(
        `Module "${modulePath}" is not allowed. Only test modules (${ALLOWED_MODULE_PREFIXES.join(", ")}) can be called through this gateway.`
      );
    }

    const runMutation = getShallowRunMutation(ctx);
    return await runMutation(getInternalRef(name), parseMutationArgsJson(mutationArgsJson));
  },
});
