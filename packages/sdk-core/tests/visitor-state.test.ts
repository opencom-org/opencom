import { describe, it, expect, beforeEach } from "vitest";
import {
  getVisitorState,
  setVisitorId,
  setSessionId,
  setSessionToken,
  setSessionExpiresAt,
  clearSessionToken,
  setUser,
  clearUser,
  resetVisitorState,
  generateSessionId,
} from "../src/state/visitor";

describe("Visitor State", () => {
  beforeEach(() => {
    resetVisitorState();
  });

  it("should have correct initial state", () => {
    const state = getVisitorState();
    expect(state.visitorId).toBeNull();
    expect(state.sessionId).toBe("");
    expect(state.sessionToken).toBeNull();
    expect(state.sessionExpiresAt).toBeNull();
    expect(state.isIdentified).toBe(false);
    expect(state.user).toBeNull();
  });

  it("should set and get visitorId", () => {
    setVisitorId("visitor_123" as any);
    expect(getVisitorState().visitorId).toBe("visitor_123");
  });

  it("should set and get sessionId", () => {
    setSessionId("session_abc");
    expect(getVisitorState().sessionId).toBe("session_abc");
  });

  it("should set and get sessionToken", () => {
    setSessionToken("token_xyz");
    const state = getVisitorState();
    expect(state.sessionToken).toBe("token_xyz");
  });

  it("should set and get sessionExpiresAt", () => {
    const expiresAt = Date.now() + 3600000;
    setSessionExpiresAt(expiresAt);
    expect(getVisitorState().sessionExpiresAt).toBe(expiresAt);
  });

  it("should clear session token and expiry together", () => {
    setSessionToken("token_xyz");
    setSessionExpiresAt(Date.now() + 3600000);
    clearSessionToken();
    const state = getVisitorState();
    expect(state.sessionToken).toBeNull();
    expect(state.sessionExpiresAt).toBeNull();
  });

  it("should set user and mark as identified", () => {
    setUser({ email: "test@example.com", name: "Test User" });
    const state = getVisitorState();
    expect(state.isIdentified).toBe(true);
    expect(state.user?.email).toBe("test@example.com");
    expect(state.user?.name).toBe("Test User");
  });

  it("should clear user and unmark identification", () => {
    setUser({ email: "test@example.com" });
    clearUser();
    const state = getVisitorState();
    expect(state.isIdentified).toBe(false);
    expect(state.user).toBeNull();
  });

  it("should reset all state including session token", () => {
    setVisitorId("visitor_123" as any);
    setSessionId("session_abc");
    setSessionToken("token_xyz");
    setSessionExpiresAt(Date.now() + 3600000);
    setUser({ email: "test@example.com" });

    resetVisitorState();

    const state = getVisitorState();
    expect(state.visitorId).toBeNull();
    expect(state.sessionId).toBe("");
    expect(state.sessionToken).toBeNull();
    expect(state.sessionExpiresAt).toBeNull();
    expect(state.isIdentified).toBe(false);
    expect(state.user).toBeNull();
  });

  it("should generate unique session IDs", () => {
    const id1 = generateSessionId();
    const id2 = generateSessionId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^session_/);
    expect(id2).toMatch(/^session_/);
  });

  it("should return a copy of state (not mutable reference)", () => {
    setSessionToken("original");
    const state1 = getVisitorState();
    state1.sessionToken = "mutated";
    expect(getVisitorState().sessionToken).toBe("original");
  });
});
