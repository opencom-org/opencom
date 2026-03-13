import { makeFunctionReference, type FunctionReference } from "convex/server";
import type { Id } from "../_generated/dataModel";

type EmbeddingContentType = "article" | "internalArticle" | "snippet";

type InternalSchedulableRef<
  Type extends "action" | "mutation",
  Args extends Record<string, unknown>,
  Return = unknown,
> = FunctionReference<Type, "internal", Args, Return>;

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

export const generateInternalEmbeddingRef = makeFunctionReference<
  "action",
  GenerateEmbeddingArgs,
  unknown
>("embeddings:generateInternal") as unknown as InternalSchedulableRef<
  "action",
  GenerateEmbeddingArgs
>;

export const removeEmbeddingRef = makeFunctionReference<"mutation", RemoveEmbeddingArgs, unknown>(
  "embeddings:remove"
) as unknown as InternalSchedulableRef<"mutation", RemoveEmbeddingArgs>;

export function getShallowRunAfter(ctx: { scheduler: { runAfter: unknown } }) {
  return ctx.scheduler.runAfter as <
    Type extends "action" | "mutation",
    Args extends Record<string, unknown>,
    Return = unknown,
  >(
    delayMs: number,
    functionRef: InternalSchedulableRef<Type, Args, Return>,
    runArgs: Args
  ) => Promise<unknown>;
}
