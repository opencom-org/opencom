import type { ErrorFeedbackMessage } from "./errorFeedback";

export type SupportAttachmentDescriptor = {
  _id: string;
  fileName: string;
  mimeType: string;
  size: number;
  url?: string;
};

export type StagedSupportAttachment<AttachmentId = string> = {
  attachmentId: AttachmentId;
  fileName: string;
  mimeType: string;
  size: number;
  status: "staged";
};

export type RejectedSupportAttachmentUpload = {
  status: "rejected";
  message: string;
};

export type SupportAttachmentFinalizeResult<AttachmentId = string> =
  | StagedSupportAttachment<AttachmentId>
  | RejectedSupportAttachmentUpload;

const MAX_SUPPORT_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_SUPPORT_ATTACHMENTS_PER_PARENT = 5;

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  csv: "text/csv",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  json: "application/json",
  pdf: "application/pdf",
  png: "image/png",
  txt: "text/plain",
  webp: "image/webp",
  zip: "application/zip",
};

const SUPPORTED_SUPPORT_ATTACHMENT_MIME_TYPES = new Set(Object.values(MIME_TYPE_BY_EXTENSION));
SUPPORTED_SUPPORT_ATTACHMENT_MIME_TYPES.add("application/x-zip-compressed");

export const SUPPORT_ATTACHMENT_ACCEPT = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".pdf",
  ".txt",
  ".csv",
  ".json",
  ".zip",
].join(",");

function inferMimeTypeFromFileName(fileName: string): string | null {
  const extension = fileName.split(".").pop()?.trim().toLowerCase();
  if (!extension) {
    return null;
  }
  return MIME_TYPE_BY_EXTENSION[extension] ?? null;
}

export function getSupportAttachmentMimeType(file: Pick<File, "name" | "type">): string | null {
  const normalizedType = file.type?.trim().toLowerCase();
  if (normalizedType && SUPPORTED_SUPPORT_ATTACHMENT_MIME_TYPES.has(normalizedType)) {
    return normalizedType;
  }
  return inferMimeTypeFromFileName(file.name);
}

export function formatSupportAttachmentSize(size: number): string {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }
  if (size >= 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }
  return `${size} B`;
}

export function validateSupportAttachmentFiles(
  files: readonly File[],
  currentCount = 0
): ErrorFeedbackMessage | null {
  if (files.length === 0) {
    return null;
  }

  if (currentCount + files.length > MAX_SUPPORT_ATTACHMENTS_PER_PARENT) {
    return {
      message: `You can attach up to ${MAX_SUPPORT_ATTACHMENTS_PER_PARENT} files at a time.`,
      nextAction: "Remove a file or send this message first, then upload again.",
    };
  }

  for (const file of files) {
    const mimeType = getSupportAttachmentMimeType(file);
    if (!mimeType) {
      return {
        message: `Unsupported file type for "${file.name}".`,
        nextAction: "Use PNG, JPG, GIF, WEBP, PDF, TXT, CSV, JSON, or ZIP files.",
      };
    }

    if (file.size > MAX_SUPPORT_ATTACHMENT_BYTES) {
      return {
        message: `"${file.name}" is larger than 10 MB.`,
        nextAction: "Choose a smaller file and try again.",
      };
    }
  }

  return null;
}

type UploadUrlArgs<WorkspaceId, VisitorId> = {
  workspaceId: WorkspaceId;
  visitorId?: VisitorId;
  sessionToken?: string;
};

type FinalizeUploadArgs<WorkspaceId, VisitorId, StorageId> = UploadUrlArgs<WorkspaceId, VisitorId> & {
  storageId: StorageId;
  fileName?: string;
};

type UploadedStoragePayload<StorageId> = {
  storageId?: StorageId;
};

export async function uploadSupportAttachments<
  WorkspaceId,
  VisitorId,
  StorageId,
  AttachmentId,
>(args: {
  files: readonly File[];
  currentCount?: number;
  workspaceId: WorkspaceId;
  visitorId?: VisitorId;
  sessionToken?: string;
  generateUploadUrl: (args: UploadUrlArgs<WorkspaceId, VisitorId>) => Promise<string>;
  finalizeUpload: (
    args: FinalizeUploadArgs<WorkspaceId, VisitorId, StorageId>
  ) => Promise<SupportAttachmentFinalizeResult<AttachmentId>>;
  fetchImpl?: typeof fetch;
}): Promise<StagedSupportAttachment<AttachmentId>[]> {
  const validationError = validateSupportAttachmentFiles(args.files, args.currentCount ?? 0);
  if (validationError) {
    throw new Error(validationError.message);
  }

  const fetchImpl = args.fetchImpl ?? fetch;
  const uploadedAttachments: StagedSupportAttachment<AttachmentId>[] = [];

  for (const file of args.files) {
    const mimeType = getSupportAttachmentMimeType(file);
    if (!mimeType) {
      throw new Error(`Unsupported file type for "${file.name}".`);
    }

    const uploadUrl = await args.generateUploadUrl({
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
    });
    const response = await fetchImpl(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": mimeType },
      body: file,
    });
    if (!response.ok) {
      throw new Error(`Upload failed for "${file.name}".`);
    }

    const payload = (await response.json()) as UploadedStoragePayload<StorageId>;
    if (!payload.storageId) {
      throw new Error(`Upload failed for "${file.name}".`);
    }

    const attachment = await args.finalizeUpload({
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
      storageId: payload.storageId,
      fileName: file.name,
    });
    if (attachment.status === "rejected") {
      throw new Error(attachment.message);
    }
    uploadedAttachments.push(attachment);
  }

  return uploadedAttachments;
}
