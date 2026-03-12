import { v } from "convex/values";

export const supportAttachmentStatusValidator = v.union(
  v.literal("staged"),
  v.literal("attached")
);

export const supportAttachmentUploaderTypeValidator = v.union(
  v.literal("agent"),
  v.literal("visitor")
);

export const supportAttachmentIdArrayValidator = v.array(v.id("supportAttachments"));

export const MAX_SUPPORT_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_SUPPORT_ATTACHMENTS_PER_PARENT = 5;
export const STAGED_SUPPORT_ATTACHMENT_TTL_MS = 60 * 60 * 1000;

export const SUPPORTED_SUPPORT_ATTACHMENT_MIME_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/json",
  "application/pdf",
  "application/x-zip-compressed",
  "application/zip",
  "text/csv",
  "text/plain",
]);

export const SUPPORTED_SUPPORT_ATTACHMENT_TYPE_LABEL =
  "PNG, JPEG, GIF, WEBP, PDF, TXT, CSV, JSON, and ZIP";
