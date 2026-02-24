import type { VisitorState, UserIdentification, VisitorId } from "../types";

let visitorState: VisitorState = {
  visitorId: null,
  sessionId: "",
  sessionToken: null,
  sessionExpiresAt: null,
  isIdentified: false,
  user: null,
};

export function getVisitorState(): VisitorState {
  return { ...visitorState };
}

export function setVisitorId(visitorId: VisitorId): void {
  visitorState.visitorId = visitorId;
}

export function setSessionId(sessionId: string): void {
  visitorState.sessionId = sessionId;
}

export function setUser(user: UserIdentification): void {
  visitorState.user = user;
  visitorState.isIdentified = !!(user.email || user.userId);
}

export function clearUser(): void {
  visitorState.user = null;
  visitorState.isIdentified = false;
}

export function setSessionToken(sessionToken: string): void {
  visitorState.sessionToken = sessionToken;
}

export function setSessionExpiresAt(expiresAt: number): void {
  visitorState.sessionExpiresAt = expiresAt;
}

export function clearSessionToken(): void {
  visitorState.sessionToken = null;
  visitorState.sessionExpiresAt = null;
}

export function resetVisitorState(): void {
  visitorState = {
    visitorId: null,
    sessionId: "",
    sessionToken: null,
    sessionExpiresAt: null,
    isIdentified: false,
    user: null,
  };
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
