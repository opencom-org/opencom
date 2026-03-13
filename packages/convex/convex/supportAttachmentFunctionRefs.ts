import { makeFunctionReference, type FunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";

type InternalMutationRef<
  Args extends Record<string, unknown>,
  Return = unknown,
> = FunctionReference<"mutation", "internal", Args, Return>;

export type CleanupExpiredStagedUploadsArgs = {
  workspaceId: Id<"workspaces">;
  scheduledAt: number;
  limit?: number;
};

type CleanupExpiredStagedUploadsResult = {
  deleted: number;
  hasMore: boolean;
};

export const cleanupExpiredStagedUploadsRef = makeFunctionReference<
  "mutation",
  CleanupExpiredStagedUploadsArgs,
  CleanupExpiredStagedUploadsResult
>("supportAttachments:cleanupExpiredStagedUploads") as unknown as InternalMutationRef<
  CleanupExpiredStagedUploadsArgs,
  CleanupExpiredStagedUploadsResult
>;
