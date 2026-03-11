import { describe, expect, it } from "vitest";
import { normalizeUnknownError } from "./errorFeedback";

describe("normalizeUnknownError", () => {
  it("uses fallback when unknown values do not contain a usable message", () => {
    const normalized = normalizeUnknownError(undefined, {
      fallbackMessage: "Failed to save settings",
      nextAction: "Review your inputs and try again.",
    });

    expect(normalized).toEqual({
      message: "Failed to save settings",
      nextAction: "Review your inputs and try again.",
    });
  });

  it("prefers explicit error messages from Error instances", () => {
    const normalized = normalizeUnknownError(new Error("Request timed out"), {
      fallbackMessage: "Failed to save settings",
    });

    expect(normalized).toEqual({
      message: "Request timed out",
      nextAction: undefined,
    });
  });

  it("extracts message from object-like thrown values", () => {
    const normalized = normalizeUnknownError(
      { message: "Upload failed" },
      {
        fallbackMessage: "Failed to upload logo",
        nextAction: "Try a smaller image and retry.",
      }
    );

    expect(normalized).toEqual({
      message: "Upload failed",
      nextAction: "Try a smaller image and retry.",
    });
  });
});
