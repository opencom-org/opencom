import {
  type OptionalRestArgsOrSkip,
  type ReactAction,
  type ReactMutation,
  useAction,
  useMutation,
  useQuery,
} from "convex/react";
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
  return makeFunctionReference<"query", Args, Result>(functionName);
}

export function widgetMutationRef<Args extends WidgetArgs, Result>(
  functionName: string
): WidgetMutationRef<Args, Result> {
  return makeFunctionReference<"mutation", Args, Result>(functionName);
}

export function widgetActionRef<Args extends WidgetArgs, Result>(
  functionName: string
): WidgetActionRef<Args, Result> {
  return makeFunctionReference<"action", Args, Result>(functionName);
}

function toWidgetQueryArgs<Args extends WidgetArgs, Result>(
  args: Args | "skip"
): OptionalRestArgsOrSkip<WidgetQueryRef<Args, Result>> {
  return (args === "skip" ? ["skip"] : [args]) as OptionalRestArgsOrSkip<
    WidgetQueryRef<Args, Result>
  >;
}

export function useWidgetQuery<Args extends WidgetArgs, Result>(
  queryRef: WidgetQueryRef<Args, Result>,
  args: Args | "skip"
): Result | undefined {
  return useQuery(queryRef, ...toWidgetQueryArgs<Args, Result>(args));
}

export function useWidgetMutation<Args extends WidgetArgs, Result>(
  mutationRef: WidgetMutationRef<Args, Result>
): ReactMutation<WidgetMutationRef<Args, Result>> {
  return useMutation(mutationRef);
}

export function useWidgetAction<Args extends WidgetArgs, Result>(
  actionRef: WidgetActionRef<Args, Result>
): ReactAction<WidgetActionRef<Args, Result>> {
  return useAction(actionRef);
}
