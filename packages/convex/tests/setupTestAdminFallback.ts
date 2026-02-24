import { ConvexClient } from "convex/browser";
import { getFunctionName } from "convex/server";

const MISSING_PUBLIC_FUNCTION_TEXT = "Could not find public function";
const TESTING_HELPERS_PREFIX = "testing/helpers:";

async function callInternalTestMutation(name: string, mutationArgs: Record<string, unknown>) {
  const convexUrl = process.env.CONVEX_URL?.trim();
  const secret = process.env.TEST_ADMIN_SECRET?.trim();
  if (!convexUrl) {
    throw new Error("CONVEX_URL environment variable is required");
  }
  if (!secret) {
    throw new Error(
      `TEST_ADMIN_SECRET is required to call internal test helper "${name}" via testAdmin gateway`
    );
  }

  const response = await fetch(`${convexUrl}/api/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "testAdmin:runTestMutation",
      args: { secret, name, mutationArgs },
      format: "json",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Internal test mutation ${name} failed (${response.status}): ${text}`);
  }

  const json = (await response.json()) as
    | { status: "success"; value: unknown }
    | { status: "error"; errorMessage: string };
  if (json.status === "success") {
    return json.value;
  }
  throw new Error(`Internal test mutation ${name} error: ${json.errorMessage}`);
}

function maybeGetFunctionName(functionReference: unknown): string | null {
  try {
    return getFunctionName(functionReference as never);
  } catch {
    return null;
  }
}

function installMutationFallback() {
  const marker = "__opencomConvexTestAdminFallbackInstalled";
  if ((globalThis as Record<string, unknown>)[marker]) {
    return;
  }
  (globalThis as Record<string, unknown>)[marker] = true;

  const originalMutation = ConvexClient.prototype.mutation as unknown as (
    this: ConvexClient,
    mutation: unknown,
    ...args: unknown[]
  ) => Promise<unknown>;
  ConvexClient.prototype.mutation = async function patchedMutation(
    this: ConvexClient,
    mutation: unknown,
    ...args: unknown[]
  ) {
    const functionName = maybeGetFunctionName(mutation);
    if (!functionName?.startsWith(TESTING_HELPERS_PREFIX)) {
      return originalMutation.call(this, mutation, ...args);
    }

    try {
      return await originalMutation.call(this, mutation, ...args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes(MISSING_PUBLIC_FUNCTION_TEXT)) {
        throw error;
      }
      const mutationArgs = (args[0] as Record<string, unknown> | undefined) ?? {};
      return callInternalTestMutation(functionName, mutationArgs);
    }
  };
}

installMutationFallback();
