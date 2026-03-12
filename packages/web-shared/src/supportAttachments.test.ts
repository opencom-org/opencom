import { describe, expect, it } from "vitest";
import {
  getSupportAttachmentMimeType,
  normalizeSupportAttachmentFileName,
  validateSupportAttachmentFiles,
} from "./supportAttachments";

describe("support attachment validation", () => {
  it("normalizes path-like file names before checking extensions", () => {
    expect(normalizeSupportAttachmentFileName("C:\\fakepath\\invoice.PDF")).toBe("invoice.PDF");
    expect(
      getSupportAttachmentMimeType({
        name: "C:\\fakepath\\invoice.PDF",
        type: "application/pdf",
      } as Pick<File, "name" | "type">)
    ).toBe("application/pdf");
  });

  it("rejects files whose extension is not allowlisted even if the browser type is allowed", () => {
    expect(
      validateSupportAttachmentFiles([
        {
          name: "avatar.png.exe",
          type: "image/png",
          size: 1024,
        } as File,
      ])
    ).toMatchObject({
      message: 'Unsupported file type for "avatar.png.exe".',
    });
  });
});
