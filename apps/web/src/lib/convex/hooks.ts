import { useAction, useMutation, useQuery } from "convex/react";
import { makeFunctionReference, type FunctionReference } from "convex/server";

type WebArgs = Record<string, unknown>;

export type WebQueryRef<Args extends WebArgs, Result> = FunctionReference<
  "query",
  "public",
  Args,
  Result
>;

export type WebMutationRef<Args extends WebArgs, Result> = FunctionReference<
  "mutation",
  "public",
  Args,
  Result
>;

export type WebActionRef<Args extends WebArgs, Result> = FunctionReference<
  "action",
  "public",
  Args,
  Result
>;

export function webQueryRef<Args extends WebArgs, Result>(
  functionName: string
): WebQueryRef<Args, Result> {
  return makeFunctionReference<"query", Args, Result>(functionName) as WebQueryRef<Args, Result>;
}

export function webMutationRef<Args extends WebArgs, Result>(
  functionName: string
): WebMutationRef<Args, Result> {
  return makeFunctionReference<"mutation", Args, Result>(functionName) as WebMutationRef<
    Args,
    Result
  >;
}

export function webActionRef<Args extends WebArgs, Result>(
  functionName: string
): WebActionRef<Args, Result> {
  return makeFunctionReference<"action", Args, Result>(functionName) as WebActionRef<Args, Result>;
}

export function useWebQuery<Args extends WebArgs, Result>(
  queryRef: WebQueryRef<Args, Result>,
  args: Args | "skip"
): Result | undefined {
  return useQuery(queryRef as never, args as never) as Result | undefined;
}

export function useWebMutation<Args extends WebArgs, Result>(
  mutationRef: WebMutationRef<Args, Result>
): (args: Args) => Promise<Result> {
  return useMutation(mutationRef as never) as unknown as (args: Args) => Promise<Result>;
}

export function useWebAction<Args extends WebArgs, Result>(
  actionRef: WebActionRef<Args, Result>
): (args: Args) => Promise<Result> {
  return useAction(actionRef as never) as unknown as (args: Args) => Promise<Result>;
}
