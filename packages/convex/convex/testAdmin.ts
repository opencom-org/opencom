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

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const ALLOWED_MODULE_PREFIXES = ["testData", "testing"];
const SECRET_ENCODER = new TextEncoder();

function normalizeSecret(secret: string): string {
  return secret.normalize("NFKC");
}

function toSecretBytes(secret: string): Uint8Array {
  return SECRET_ENCODER.encode(normalizeSecret(secret));
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
    mutationArgs: v.any(),
  },
  handler: async (ctx, { secret, name, mutationArgs }) => {
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
    const funcName = name.slice(colonIdx + 1);

    // Security: only allow test-related modules
    const topModule = modulePath.split("/")[0];
    if (!ALLOWED_MODULE_PREFIXES.includes(topModule)) {
      throw new Error(
        `Module "${modulePath}" is not allowed. Only test modules (${ALLOWED_MODULE_PREFIXES.join(", ")}) can be called through this gateway.`
      );
    }

    // Resolve the internal function reference dynamically
    // e.g. "testData:seedTour" → internal.testData.seedTour
    // e.g. "testing/helpers:cleanup" → internal.testing.helpers.cleanup
    const segments = [...modulePath.split("/"), funcName];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ref: any = internal;
    for (const seg of segments) {
      ref = ref[seg];
      if (!ref) {
        throw new Error(`Unknown internal function "${name}". Could not resolve segment "${seg}".`);
      }
    }

    return await ctx.runMutation(ref, mutationArgs ?? {});
  },
});
