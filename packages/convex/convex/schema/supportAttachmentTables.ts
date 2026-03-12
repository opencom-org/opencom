import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  supportAttachmentStatusValidator,
  supportAttachmentUploaderTypeValidator,
} from "../supportAttachmentTypes";

export const supportAttachmentTables = {
  supportAttachments: defineTable({
    workspaceId: v.id("workspaces"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
    status: supportAttachmentStatusValidator,
    messageId: v.optional(v.id("messages")),
    ticketId: v.optional(v.id("tickets")),
    ticketCommentId: v.optional(v.id("ticketComments")),
    uploadedByType: supportAttachmentUploaderTypeValidator,
    uploadedById: v.optional(v.string()),
    createdAt: v.number(),
    attachedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_message", ["messageId"])
    .index("by_ticket", ["ticketId"])
    .index("by_ticket_comment", ["ticketCommentId"])
    .index("by_status_expires", ["status", "expiresAt"]),
};
