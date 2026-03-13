import { ConvexClient, type MutationOptions } from "convex/browser";
import {
  getFunctionName,
  type FunctionArgs,
  type FunctionReference,
  type FunctionReturnType,
} from "convex/server";

const MISSING_PUBLIC_FUNCTION_TEXT = "Could not find public function";
const TESTING_HELPERS_PREFIXES = ["testing/helpers:", "testing_helpers:"] as const;

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

function normalizeTestingHelperFunctionName(functionName: string): string {
  if (functionName.startsWith("testing_helpers:")) {
    return `testing/helpers:${functionName.slice("testing_helpers:".length)}`;
  }
  return functionName;
}

function installMutationFallback() {
  const marker = "__opencomConvexTestAdminFallbackInstalled";
  if ((globalThis as Record<string, unknown>)[marker]) {
    return;
  }
  (globalThis as Record<string, unknown>)[marker] = true;

  type ConvexMutationMethod = <Mutation extends FunctionReference<"mutation">>(
    this: ConvexClient,
    mutation: Mutation,
    args: FunctionArgs<Mutation>,
    options?: MutationOptions
  ) => Promise<Awaited<FunctionReturnType<Mutation>>>;

  const originalMutation = ConvexClient.prototype.mutation as ConvexMutationMethod;
  ConvexClient.prototype.mutation = async function patchedMutation<
    Mutation extends FunctionReference<"mutation">,
  >(
    this: ConvexClient,
    mutation: Mutation,
    args: FunctionArgs<Mutation>,
    options?: MutationOptions
  ): Promise<Awaited<FunctionReturnType<Mutation>>> {
    const functionName = maybeGetFunctionName(mutation);
    if (!functionName || !TESTING_HELPERS_PREFIXES.some((prefix) => functionName.startsWith(prefix))) {
      return originalMutation.call(this, mutation, args, options);
    }

    try {
      return await originalMutation.call(this, mutation, args, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes(MISSING_PUBLIC_FUNCTION_TEXT)) {
        throw error;
      }
      const mutationArgs = (args as Record<string, unknown> | undefined) ?? {};
      return (await callInternalTestMutation(
        normalizeTestingHelperFunctionName(functionName),
        mutationArgs
      )) as Awaited<FunctionReturnType<Mutation>>;
    }
  };
}

installMutationFallback();
