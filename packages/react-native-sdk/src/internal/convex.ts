import { useAction, useMutation, useQuery } from "convex/react";
import { makeFunctionReference, type FunctionReference } from "convex/server";

type SdkQueryArgs = Record<string, unknown> | "skip";

export type SdkQueryRef = FunctionReference<"query">;
export type SdkMutationRef = FunctionReference<"mutation">;
export type SdkActionRef = FunctionReference<"action">;

export function sdkQueryRef(name: string): SdkQueryRef {
  return makeFunctionReference(name) as SdkQueryRef;
}

export function sdkMutationRef(name: string): SdkMutationRef {
  return makeFunctionReference(name) as SdkMutationRef;
}

export function sdkActionRef(name: string): SdkActionRef {
  return makeFunctionReference(name) as SdkActionRef;
}

export function useSdkQuery<Result>(ref: SdkQueryRef, args: SdkQueryArgs): Result | undefined {
  return useQuery(ref, args) as Result | undefined;
}

export function useSdkMutation<Args extends Record<string, unknown>, Result = unknown>(
  ref: SdkMutationRef
): (args: Args) => Promise<Result> {
  return useMutation(ref) as (args: Args) => Promise<Result>;
}

export function useSdkAction<Args extends Record<string, unknown>, Result = unknown>(
  ref: SdkActionRef
): (args: Args) => Promise<Result> {
  return useAction(ref) as (args: Args) => Promise<Result>;
}
