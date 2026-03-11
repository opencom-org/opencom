import { useAction, useMutation, useQuery } from "convex/react";
import { makeFunctionReference, type FunctionReference } from "convex/server";

type WidgetArgs = Record<string, unknown>;

export type WidgetQueryRef<Args extends WidgetArgs, Result> = FunctionReference<
  "query",
  "public",
  Args,
  Result
>;

export type WidgetMutationRef<Args extends WidgetArgs, Result> = FunctionReference<
  "mutation",
  "public",
  Args,
  Result
>;

export type WidgetActionRef<Args extends WidgetArgs, Result> = FunctionReference<
  "action",
  "public",
  Args,
  Result
>;

export function widgetQueryRef<Args extends WidgetArgs, Result>(
  functionName: string
): WidgetQueryRef<Args, Result> {
  return makeFunctionReference<"query", Args, Result>(functionName) as WidgetQueryRef<
    Args,
    Result
  >;
}

export function widgetMutationRef<Args extends WidgetArgs, Result>(
  functionName: string
): WidgetMutationRef<Args, Result> {
  return makeFunctionReference<"mutation", Args, Result>(functionName) as WidgetMutationRef<
    Args,
    Result
  >;
}

export function widgetActionRef<Args extends WidgetArgs, Result>(
  functionName: string
): WidgetActionRef<Args, Result> {
  return makeFunctionReference<"action", Args, Result>(functionName) as WidgetActionRef<
    Args,
    Result
  >;
}

export function useWidgetQuery<Args extends WidgetArgs, Result>(
  queryRef: WidgetQueryRef<Args, Result>,
  args: Args | "skip"
): Result | undefined {
  return useQuery(queryRef as never, args as never) as Result | undefined;
}

export function useWidgetMutation<Args extends WidgetArgs, Result>(
  mutationRef: WidgetMutationRef<Args, Result>
): (args: Args) => Promise<Result> {
  return useMutation(mutationRef as never) as unknown as (args: Args) => Promise<Result>;
}

export function useWidgetAction<Args extends WidgetArgs, Result>(
  actionRef: WidgetActionRef<Args, Result>
): (args: Args) => Promise<Result> {
  return useAction(actionRef as never) as unknown as (args: Args) => Promise<Result>;
}
