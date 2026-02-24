/**
 * Seed utility for screenshot scripts.
 *
 * Calls Convex internal mutations via the testAdmin gateway action so the
 * scripts don't need `convex` or `@opencom/convex` as direct dependencies.
 *
 * All test data mutations are `internalMutation` — they are called through
 * the public `testAdmin:runTestMutation` action which validates a shared secret.
 */

/**
 * Calls a Convex internal mutation via the testAdmin gateway action.
 *
 * @param backendUrl    The Convex deployment URL (e.g. https://xxx.convex.cloud)
 * @param path          Mutation path in "module:function" format (e.g. "testData:seedDemoData")
 * @param args          Arguments to pass to the mutation
 * @param adminSecret   Optional admin secret for the gateway.
 *                      Falls back to TEST_ADMIN_SECRET env var.
 * @returns             The mutation return value
 */
export async function callMutation(
  backendUrl: string,
  path: string,
  args: Record<string, unknown>,
  adminSecret?: string
): Promise<unknown> {
  const secret = adminSecret || process.env.TEST_ADMIN_SECRET;
  if (!secret) {
    throw new Error(
      "TEST_ADMIN_SECRET is required to call internal test mutations. " +
        "Set it as an environment variable or pass it as the adminSecret parameter."
    );
  }

  const url = `${backendUrl}/api/action`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      path: "testAdmin:runTestMutation",
      args: { secret, name: path, mutationArgs: args },
      format: "json",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Convex mutation ${path} failed (${res.status}): ${text}`);
  }

  const json = await res.json();

  // Convex HTTP API wraps successful results in { status: "success", value: ... }
  if (json.status === "success") {
    return json.value;
  }

  // Error responses: { status: "error", errorMessage: "..." }
  if (json.status === "error") {
    throw new Error(`Convex mutation ${path} error: ${json.errorMessage}`);
  }

  return json;
}
