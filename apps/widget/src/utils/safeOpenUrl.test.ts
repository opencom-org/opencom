import { afterEach, describe, expect, it, vi } from "vitest";
import { safeOpenUrl } from "./safeOpenUrl";

describe("safeOpenUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens http/https URLs with noopener,noreferrer", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    const opened = safeOpenUrl("https://example.com/path");

    expect(opened).toBe(true);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.calls[0][0]).toMatch(/^https:\/\/example\.com\/path\/?$/);
    expect(openSpy.mock.calls[0][1]).toBe("_blank");
    expect(openSpy.mock.calls[0][2]).toBe("noopener,noreferrer");
  });

  it("rejects javascript URLs", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    const opened = safeOpenUrl("javascript:alert(1)");

    expect(opened).toBe(false);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("rejects data and vbscript URLs", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    expect(safeOpenUrl("data:text/html;base64,abc")).toBe(false);
    expect(safeOpenUrl("vbscript:msgbox('xss')")).toBe(false);
    expect(openSpy).not.toHaveBeenCalled();
  });
});
