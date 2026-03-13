import { makeFunctionReference, type FunctionReference } from "convex/server";
import type { Id } from "../_generated/dataModel";

type EmbeddingContentType = "article" | "internalArticle" | "snippet";

type InternalSchedulableRef<
  Type extends "action" | "mutation",
  Args extends Record<string, unknown>,
  Return = unknown,
> = FunctionReference<Type, "internal", Args, Return>;

function makeInternalActionRef<Args extends Record<string, unknown>, Return = unknown>(
  name: string
): InternalSchedulableRef<"action", Args, Return> {
  return makeFunctionReference<"action", Args, Return>(name) as unknown as InternalSchedulableRef<
    "action",
    Args,
    Return
  >;
}

function makeInternalMutationRef<Args extends Record<string, unknown>, Return = unknown>(
  name: string
): InternalSchedulableRef<"mutation", Args, Return> {
  return makeFunctionReference<"mutation", Args, Return>(name) as unknown as InternalSchedulableRef<
    "mutation",
    Args,
    Return
  >;
}

type GenerateEmbeddingArgs = {
  workspaceId: Id<"workspaces">;
  contentType: EmbeddingContentType;
  contentId: string;
  title: string;
  content: string;
  model?: string;
};

type RemoveEmbeddingArgs = {
  contentType: EmbeddingContentType;
  contentId: string;
};

export const generateInternalEmbeddingRef = makeInternalActionRef<GenerateEmbeddingArgs>(
  "embeddings:generateInternal"
);

export const removeEmbeddingRef = makeInternalMutationRef<RemoveEmbeddingArgs>("embeddings:remove");

export function getShallowRunAfter(ctx: { scheduler: { runAfter: unknown } }) {
  return ctx.scheduler.runAfter as unknown as <
    Type extends "action" | "mutation",
    Args extends Record<string, unknown>,
    Return = unknown,
  >(
    delayMs: number,
    functionRef: InternalSchedulableRef<Type, Args, Return>,
    runArgs: Args
  ) => Promise<unknown>;
}
