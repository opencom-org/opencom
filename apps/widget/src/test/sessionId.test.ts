import { describe, it, expect, beforeEach } from "vitest";
import { generateSessionId } from "../utils/session";

describe("generateSessionId", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should generate a session ID with the correct prefix and length", () => {
    const id = generateSessionId();
    expect(id).toMatch(/^session_[0-9a-f]{48}$/);
  });

  it("should persist session ID to localStorage", () => {
    const id = generateSessionId();
    expect(localStorage.getItem("opencom_session_id")).toBe(id);
  });

  it("should return the same session ID on subsequent calls", () => {
    const first = generateSessionId();
    const second = generateSessionId();
    expect(first).toBe(second);
  });

  it("should return stored session ID from localStorage", () => {
    localStorage.setItem("opencom_session_id", "session_existing123");
    const id = generateSessionId();
    expect(id).toBe("session_existing123");
  });

  it("should generate unique IDs across calls (after clearing storage)", () => {
    const id1 = generateSessionId();
    localStorage.clear();
    const id2 = generateSessionId();
    expect(id1).not.toBe(id2);
  });

  it("should use cryptographically random bytes", () => {
    // Generate many IDs and verify they are all unique (collision extremely unlikely with 24 bytes)
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      localStorage.clear();
      ids.add(generateSessionId());
    }
    expect(ids.size).toBe(100);
  });
});
