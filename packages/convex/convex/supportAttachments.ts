import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { getAuthenticatedUserFromSession } from "./auth";
import { requirePermission } from "./permissions";
import {
  MAX_SUPPORT_ATTACHMENT_BYTES,
  MAX_SUPPORT_ATTACHMENTS_PER_PARENT,
  STAGED_SUPPORT_ATTACHMENT_TTL_MS,
  SUPPORTED_SUPPORT_ATTACHMENT_TYPE_LABEL,
} from "./supportAttachmentTypes";
import { createError } from "./utils/errors";
import { resolveVisitorFromSession } from "./widgetSessions";
import { getShallowRunAfter } from "./notifications/functionRefs";
import {
  cleanupExpiredStagedUploadsRef,
  type CleanupExpiredStagedUploadsArgs,
} from "./supportAttachmentFunctionRefs";

type SupportAttachmentWorkspaceArgs = {
  workspaceId: Id<"workspaces">;
  visitorId?: Id<"visitors">;
  sessionToken?: string;
};

type SupportAttachmentActor =
  | { accessType: "agent"; userId: Id<"users"> }
  | { accessType: "visitor"; visitorId: Id<"visitors"> };

export type SupportAttachmentDescriptor = {
  _id: Id<"supportAttachments">;
  fileName: string;
  mimeType: string;
  size: number;
  url?: string;
};

const DEFAULT_CLEANUP_LIMIT = 100;
const MAX_CLEANUP_LIMIT = 500;
const CLEANUP_SCHEDULE_GRACE_MS = 1_000;
const CLEANUP_EXPIRED_STAGED_UPLOADS_REF = cleanupExpiredStagedUploadsRef;
const SUPPORT_ATTACHMENT_MIME_TYPE_BY_EXTENSION = {
  csv: "text/csv",
  json: "application/json",
  pdf: "application/pdf",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  txt: "text/plain",
  webp: "image/webp",
  zip: "application/zip",
} as const;

function normalizeAttachmentIds(
  attachmentIds?: readonly Id<"supportAttachments">[]
): Id<"supportAttachments">[] {
  if (!attachmentIds || attachmentIds.length === 0) {
    return [];
  }

  return [...new Set(attachmentIds)];
}

function normalizeAttachmentFileName(fileName?: string): string {
  const normalized = fileName?.split(/[/\\]/).at(-1)?.trim();
  return normalized && normalized.length > 0 ? normalized : "attachment";
}

function getSupportAttachmentExtension(
  fileName: string
): keyof typeof SUPPORT_ATTACHMENT_MIME_TYPE_BY_EXTENSION | null {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex <= 0 || lastDotIndex === fileName.length - 1) {
    return null;
  }

  const extension = fileName.slice(lastDotIndex + 1).toLowerCase();
  return extension in SUPPORT_ATTACHMENT_MIME_TYPE_BY_EXTENSION
    ? (extension as keyof typeof SUPPORT_ATTACHMENT_MIME_TYPE_BY_EXTENSION)
    : null;
}

function getSupportAttachmentMimeTypeForFileName(fileName: string): string | null {
  const extension = getSupportAttachmentExtension(fileName);
  return extension ? SUPPORT_ATTACHMENT_MIME_TYPE_BY_EXTENSION[extension] : null;
}
function validateSupportAttachmentFileName(
  normalizedFileName: string
):
  | {
      status: "accepted";
      mimeType: string;
    }
  | {
      status: "rejected";
      message: string;
    }
{
  const extension = getSupportAttachmentExtension(normalizedFileName);
  if (!extension) {
    return {
      status: "rejected",
      message: `Unsupported file type. Allowed: ${SUPPORTED_SUPPORT_ATTACHMENT_TYPE_LABEL}.`,
    };
  }

  return {
    status: "accepted",
    mimeType: getSupportAttachmentMimeTypeForFileName(normalizedFileName)!,
  };
}

function getActorUploadId(actor: SupportAttachmentActor): string {
  return actor.accessType === "agent" ? actor.userId : actor.visitorId;
}

async function ensureWorkspaceExists(
  ctx: Pick<QueryCtx, "db">,
  workspaceId: Id<"workspaces">
): Promise<void> {
  const workspace = await ctx.db.get(workspaceId);
  if (!workspace) {
    throw createError("NOT_FOUND", "Workspace not found");
  }
}

async function requireSupportAttachmentWorkspaceAccess(
  ctx: QueryCtx | MutationCtx,
  args: SupportAttachmentWorkspaceArgs
): Promise<SupportAttachmentActor> {
  const authUser = await getAuthenticatedUserFromSession(ctx);
  if (authUser) {
    await requirePermission(ctx, authUser._id, args.workspaceId, "conversations.reply");
    return {
      accessType: "agent",
      userId: authUser._id,
    };
  }

  if (!args.sessionToken) {
    throw createError("NOT_AUTHENTICATED");
  }

  const resolved = await resolveVisitorFromSession(ctx, {
    sessionToken: args.sessionToken,
    workspaceId: args.workspaceId,
  });
  if (args.visitorId && args.visitorId !== resolved.visitorId) {
    throw createError("NOT_AUTHORIZED", "Not authorized to upload files for this visitor");
  }

  return {
    accessType: "visitor",
    visitorId: resolved.visitorId,
  };
}

async function deleteUploadedFileIfPresent(
  ctx: Pick<MutationCtx, "storage">,
  storageId: Id<"_storage">
): Promise<void> {
  const metadata = await ctx.storage.getMetadata(storageId);
  if (!metadata) {
    return;
  }
  await ctx.storage.delete(storageId);
}

function getSupportAttachmentCleanupScheduledAt(expiresAt: number): number {
  return expiresAt + CLEANUP_SCHEDULE_GRACE_MS;
}

async function getNextStagedSupportAttachment(
  ctx: Pick<MutationCtx, "db">,
  workspaceId: Id<"workspaces">
): Promise<Doc<"supportAttachments"> | null> {
  return await ctx.db
    .query("supportAttachments")
    .withIndex("by_workspace_status_expires", (q) =>
      q.eq("workspaceId", workspaceId).eq("status", "staged")
    )
    .first();
}

async function scheduleSupportAttachmentCleanup(
  ctx: Pick<MutationCtx, "scheduler">,
  args: CleanupExpiredStagedUploadsArgs
): Promise<void> {
  const runAfter = getShallowRunAfter(ctx);
  await runAfter(
    Math.max(0, args.scheduledAt - Date.now()),
    CLEANUP_EXPIRED_STAGED_UPLOADS_REF,
    args
  );
}

async function ensureSupportAttachmentCleanupScheduled(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  workspaceId: Id<"workspaces">,
  scheduledAt: number
): Promise<void> {
  const workspace = await ctx.db.get(workspaceId);
  if (!workspace) {
    throw createError("NOT_FOUND", "Workspace not found");
  }

  const existingScheduledAt = workspace.supportAttachmentCleanupScheduledAt;
  if (typeof existingScheduledAt === "number" && existingScheduledAt <= scheduledAt) {
    return;
  }

  await ctx.db.patch(workspaceId, {
    supportAttachmentCleanupScheduledAt: scheduledAt,
  });

  await scheduleSupportAttachmentCleanup(ctx, {
    workspaceId,
    scheduledAt,
    limit: DEFAULT_CLEANUP_LIMIT,
  });
}

function buildAttachmentCountError(): Error {
  return createError(
    "INVALID_INPUT",
    `You can attach up to ${MAX_SUPPORT_ATTACHMENTS_PER_PARENT} files at a time.`
  );
}

function buildAttachmentPreviewLabel(attachmentCount: number): string {
  return attachmentCount === 1 ? "1 attachment" : `${attachmentCount} attachments`;
}

type SupportAttachmentBinding =
  | {
      kind: "message";
      messageId: Id<"messages">;
    }
  | {
      kind: "ticket";
      ticketId: Id<"tickets">;
    }
  | {
      kind: "ticketComment";
      ticketCommentId: Id<"ticketComments">;
    };

type BindSupportAttachmentsArgs = {
  workspaceId: Id<"workspaces">;
  attachmentIds?: readonly Id<"supportAttachments">[];
  actor: SupportAttachmentActor;
  binding: SupportAttachmentBinding;
};

export function describeSupportAttachmentSelection(
  attachmentIds?: readonly Id<"supportAttachments">[]
): string | null {
  const normalizedIds = normalizeAttachmentIds(attachmentIds);
  if (normalizedIds.length === 0) {
    return null;
  }
  return buildAttachmentPreviewLabel(normalizedIds.length);
}

export async function bindStagedSupportAttachments(
  ctx: MutationCtx,
  args: BindSupportAttachmentsArgs
): Promise<Id<"supportAttachments">[]> {
  const attachmentIds = normalizeAttachmentIds(args.attachmentIds);
  if (attachmentIds.length === 0) {
    return [];
  }
  if (attachmentIds.length > MAX_SUPPORT_ATTACHMENTS_PER_PARENT) {
    throw buildAttachmentCountError();
  }

  const now = Date.now();
  const attachments = await Promise.all(
    attachmentIds.map(
      async (attachmentId) =>
        [attachmentId, (await ctx.db.get(attachmentId)) as Doc<"supportAttachments"> | null] as const
    )
  );

  for (const [attachmentId, attachment] of attachments) {
    if (!attachment || attachment.workspaceId !== args.workspaceId) {
      throw createError("NOT_FOUND", `Attachment ${attachmentId} was not found`);
    }
    if (attachment.status !== "staged") {
      throw createError("INVALID_INPUT", "Attachment has already been used");
    }
    if (!attachment.expiresAt || attachment.expiresAt <= now) {
      throw createError("INVALID_INPUT", "Attachment upload expired. Please upload again.");
    }
    if (
      attachment.messageId ||
      attachment.ticketId ||
      attachment.ticketCommentId
    ) {
      throw createError("INVALID_INPUT", "Attachment has already been attached");
    }
    if (attachment.uploadedByType !== args.actor.accessType) {
      throw createError("NOT_AUTHORIZED", "Not authorized to use this attachment");
    }
    if (attachment.uploadedById !== getActorUploadId(args.actor)) {
      throw createError("NOT_AUTHORIZED", "Not authorized to use this attachment");
    }
  }

  for (const [, attachment] of attachments) {
    if (!attachment) {
      continue;
    }
    await ctx.db.patch(attachment._id, {
      status: "attached",
      messageId: args.binding.kind === "message" ? args.binding.messageId : undefined,
      ticketId: args.binding.kind === "ticket" ? args.binding.ticketId : undefined,
      ticketCommentId:
        args.binding.kind === "ticketComment" ? args.binding.ticketCommentId : undefined,
      attachedAt: now,
      expiresAt: undefined,
    });
  }

  return attachmentIds;
}

type AttachmentReadCtx = Pick<QueryCtx, "db" | "storage">;

export async function loadSupportAttachmentDescriptorMap(
  ctx: AttachmentReadCtx,
  attachmentIds: readonly Id<"supportAttachments">[]
): Promise<Map<string, SupportAttachmentDescriptor>> {
  const normalizedIds = normalizeAttachmentIds(attachmentIds);
  if (normalizedIds.length === 0) {
    return new Map();
  }

  const rawEntries = await Promise.all(
    normalizedIds.map(async (attachmentId) => {
      const attachment = (await ctx.db.get(attachmentId)) as Doc<"supportAttachments"> | null;
      if (!attachment || attachment.status !== "attached") {
        return null;
      }
      return [
        attachmentId.toString(),
        {
          _id: attachment._id,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          size: attachment.size,
          url: (await ctx.storage.getUrl(attachment.storageId)) ?? undefined,
        } satisfies SupportAttachmentDescriptor,
      ] as const;
    })
  );

  const entries: Array<readonly [string, SupportAttachmentDescriptor]> = [];
  for (const entry of rawEntries) {
    if (entry) {
      entries.push(entry);
    }
  }

  return new Map(entries);
}

export function materializeSupportAttachmentDescriptors(
  attachmentIds: readonly Id<"supportAttachments">[] | undefined,
  descriptorMap: Map<string, SupportAttachmentDescriptor>
): SupportAttachmentDescriptor[] {
  const normalizedIds = normalizeAttachmentIds(attachmentIds);
  return normalizedIds.flatMap((attachmentId) => {
    const descriptor = descriptorMap.get(attachmentId.toString());
    return descriptor ? [descriptor] : [];
  });
}

export const generateUploadUrl = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ensureWorkspaceExists(ctx, args.workspaceId);
    await requireSupportAttachmentWorkspaceAccess(ctx, args);
    return await ctx.storage.generateUploadUrl();
  },
});

export const finalizeUpload = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    storageId: v.id("_storage"),
    fileName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ensureWorkspaceExists(ctx, args.workspaceId);
    const actor = await requireSupportAttachmentWorkspaceAccess(ctx, args);
    const normalizedFileName = normalizeAttachmentFileName(args.fileName);

    const metadata = await ctx.storage.getMetadata(args.storageId);
    if (!metadata) {
      throw createError("NOT_FOUND", "Uploaded file not found");
    }

    const fileValidation = validateSupportAttachmentFileName(normalizedFileName);
    if (fileValidation.status === "rejected") {
      await deleteUploadedFileIfPresent(ctx, args.storageId);
      return {
        status: "rejected" as const,
        message: fileValidation.message,
      };
    }

    if (metadata.size > MAX_SUPPORT_ATTACHMENT_BYTES) {
      await deleteUploadedFileIfPresent(ctx, args.storageId);
      return {
        status: "rejected" as const,
        message: `File exceeds ${Math.floor(MAX_SUPPORT_ATTACHMENT_BYTES / (1024 * 1024))}MB maximum size.`,
      };
    }

    const now = Date.now();
    const attachmentId = await ctx.db.insert("supportAttachments", {
      workspaceId: args.workspaceId,
      storageId: args.storageId,
      fileName: normalizedFileName,
      mimeType: fileValidation.mimeType,
      size: metadata.size,
      status: "staged",
      uploadedByType: actor.accessType,
      uploadedById: getActorUploadId(actor),
      createdAt: now,
      expiresAt: now + STAGED_SUPPORT_ATTACHMENT_TTL_MS,
    });

    await ensureSupportAttachmentCleanupScheduled(
      ctx,
      args.workspaceId,
      getSupportAttachmentCleanupScheduledAt(now + STAGED_SUPPORT_ATTACHMENT_TTL_MS)
    );

    return {
      status: "staged" as const,
      attachmentId,
      fileName: normalizedFileName,
      mimeType: fileValidation.mimeType,
      size: metadata.size,
    };
  },
});

export const cleanupExpiredStagedUploads = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    scheduledAt: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      return {
        deleted: 0,
        hasMore: false,
      };
    }
    if (workspace.supportAttachmentCleanupScheduledAt !== args.scheduledAt) {
      return {
        deleted: 0,
        hasMore: false,
      };
    }

    const now = Date.now();
    const limit = Math.max(
      1,
      Math.min(args.limit ?? DEFAULT_CLEANUP_LIMIT, MAX_CLEANUP_LIMIT)
    );

    const expiredUploads = await ctx.db
      .query("supportAttachments")
      .withIndex("by_workspace_status_expires", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "staged").lt("expiresAt", now)
      )
      .take(limit);

    let deleted = 0;
    for (const attachment of expiredUploads) {
      await deleteUploadedFileIfPresent(ctx, attachment.storageId);
      await ctx.db.delete(attachment._id);
      deleted += 1;
    }

    const nextStagedAttachment = await getNextStagedSupportAttachment(ctx, args.workspaceId);
    if (!nextStagedAttachment?.expiresAt) {
      await ctx.db.patch(args.workspaceId, {
        supportAttachmentCleanupScheduledAt: undefined,
      });
      return {
        deleted,
        hasMore: expiredUploads.length === limit,
      };
    }

    const nextScheduledAt = getSupportAttachmentCleanupScheduledAt(nextStagedAttachment.expiresAt);
    await ctx.db.patch(args.workspaceId, {
      supportAttachmentCleanupScheduledAt: nextScheduledAt,
    });
    await scheduleSupportAttachmentCleanup(ctx, {
      workspaceId: args.workspaceId,
      scheduledAt: nextScheduledAt,
      limit: args.limit ?? DEFAULT_CLEANUP_LIMIT,
    });

    return {
      deleted,
      hasMore: expiredUploads.length === limit,
    };
  },
});
