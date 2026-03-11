import {
  type OptionalRestArgsOrSkip,
  type ReactAction,
  type ReactMutation,
  useAction,
  useMutation,
  useQuery,
} from "convex/react";
import type { FunctionReference } from "convex/server";

type MobileArgs = Record<string, unknown>;

export type MobileQueryRef<Args extends MobileArgs, Result> = FunctionReference<
  "query",
  "public",
  Args,
  Result
>;

export type MobileMutationRef<Args extends MobileArgs, Result> = FunctionReference<
  "mutation",
  "public",
  Args,
  Result
>;

export type MobileActionRef<Args extends MobileArgs, Result> = FunctionReference<
  "action",
  "public",
  Args,
  Result
>;

function toMobileQueryArgs<Args extends MobileArgs, Result>(
  args: Args | "skip"
): OptionalRestArgsOrSkip<MobileQueryRef<Args, Result>> {
  return (args === "skip" ? ["skip"] : [args]) as OptionalRestArgsOrSkip<
    MobileQueryRef<Args, Result>
  >;
}

export function useMobileQuery<Args extends MobileArgs, Result>(
  queryRef: MobileQueryRef<Args, Result>,
  args: Args | "skip"
): Result | undefined {
  return useQuery(queryRef, ...toMobileQueryArgs<Args, Result>(args));
}

export function useMobileMutation<Args extends MobileArgs, Result>(
  mutationRef: MobileMutationRef<Args, Result>
): ReactMutation<MobileMutationRef<Args, Result>> {
  return useMutation(mutationRef);
}

export function useMobileAction<Args extends MobileArgs, Result>(
  actionRef: MobileActionRef<Args, Result>
): ReactAction<MobileActionRef<Args, Result>> {
  return useAction(actionRef);
}
