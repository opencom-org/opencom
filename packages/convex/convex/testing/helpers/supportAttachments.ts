import { internalMutation, type MutationCtx } from "../../_generated/server";
import { v } from "convex/values";
import { type Id } from "../../_generated/dataModel";

async function deleteStoredFileIfPresent(
  ctx: Pick<MutationCtx, "storage">,
  storageId: Id<"_storage">
): Promise<void> {
  const metadata = await ctx.storage.getMetadata(storageId);
  if (metadata) {
    await ctx.storage.delete(storageId);
  }
}

const getTestSupportAttachment = internalMutation({
  args: {
    attachmentId: v.id("supportAttachments"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.attachmentId);
  },
});

const expireTestSupportAttachment = internalMutation({
  args: {
    attachmentId: v.id("supportAttachments"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.attachmentId, {
      status: "staged",
      expiresAt: Date.now() - 1_000,
    });
  },
});

const cleanupExpiredSupportAttachments = internalMutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const limit = Math.max(1, Math.min(args.limit ?? 100, 500));
    const attachments = await ctx.db
      .query("supportAttachments")
      .withIndex("by_status_expires", (q) => q.eq("status", "staged").lt("expiresAt", now))
      .take(limit);

    for (const attachment of attachments) {
      await deleteStoredFileIfPresent(ctx, attachment.storageId);
      await ctx.db.delete(attachment._id);
    }

    return {
      deleted: attachments.length,
      hasMore: attachments.length === limit,
    };
  },
});

const hasTestStoredFile = internalMutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    return Boolean(await ctx.storage.getMetadata(args.storageId));
  },
});

export const supportAttachmentTestHelpers: Record<string, ReturnType<typeof internalMutation>> = {
  cleanupExpiredSupportAttachments,
  expireTestSupportAttachment,
  getTestSupportAttachment,
  hasTestStoredFile,
} as const;
