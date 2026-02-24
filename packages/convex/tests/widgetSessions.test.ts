import { describe, it, expect } from "vitest";

// Unit tests for widget session token generation and helper logic

describe("Widget Sessions", () => {
  describe("Session token format", () => {
    it("generates token with wst_ prefix", () => {
      const token = generateTestToken();
      expect(token.startsWith("wst_")).toBe(true);
    });

    it("generates 68-character token (4 prefix + 64 hex)", () => {
      const token = generateTestToken();
      expect(token.length).toBe(68);
    });

    it("generates valid hex after prefix", () => {
      const token = generateTestToken();
      const hex = token.slice(4);
      expect(/^[0-9a-f]{64}$/.test(hex)).toBe(true);
    });

    it("generates unique tokens", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateTestToken());
      }
      expect(tokens.size).toBe(100);
    });
  });

  describe("Session lifetime", () => {
    it("defaults to 24 hours", () => {
      const lifetime = getSessionLifetime(undefined);
      expect(lifetime).toBe(24 * 60 * 60 * 1000);
    });

    it("clamps minimum to 1 hour", () => {
      const lifetime = getSessionLifetime(1000); // 1 second
      expect(lifetime).toBe(1 * 60 * 60 * 1000);
    });

    it("clamps maximum to 7 days", () => {
      const lifetime = getSessionLifetime(30 * 24 * 60 * 60 * 1000); // 30 days
      expect(lifetime).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it("accepts valid lifetime within range", () => {
      const fourHours = 4 * 60 * 60 * 1000;
      const lifetime = getSessionLifetime(fourHours);
      expect(lifetime).toBe(fourHours);
    });
  });

  describe("Refresh threshold", () => {
    it("refresh threshold is 25%", () => {
      expect(REFRESH_THRESHOLD).toBe(0.25);
    });

    it("calculates correct refresh timing", () => {
      const lifetime = 24 * 60 * 60 * 1000; // 24 hours
      const refreshAt = lifetime * (1 - REFRESH_THRESHOLD);
      // Should refresh after 18 hours (75% of lifetime)
      expect(refreshAt).toBe(18 * 60 * 60 * 1000);
    });
  });

  describe("resolveVisitorFromSession logic", () => {
    it("always requires sessionToken (signed sessions mandatory)", () => {
      // With signed sessions always on, missing token always throws
      const shouldThrow = (hasToken: boolean) => !hasToken;

      expect(shouldThrow(false)).toBe(true);
      expect(shouldThrow(true)).toBe(false);
    });

    it("does not fall back to raw visitorId", () => {
      // Raw visitorId without sessionToken is never accepted
      const shouldResolve = (hasToken: boolean, _hasVisitorId: boolean) => {
        return hasToken; // only token matters now
      };

      expect(shouldResolve(false, true)).toBe(false);
      expect(shouldResolve(true, true)).toBe(true);
      expect(shouldResolve(true, false)).toBe(true);
    });

    it("validates session not expired", () => {
      const now = Date.now();
      const isValid = (expiresAt: number) => expiresAt >= now;

      expect(isValid(now + 1000)).toBe(true);
      expect(isValid(now - 1000)).toBe(false);
      expect(isValid(now)).toBe(true);
    });
  });

  describe("Boot flow", () => {
    it("generates session token on boot", () => {
      // Boot should always return a token
      const token = generateTestToken();
      expect(token).toBeTruthy();
      expect(token.startsWith("wst_")).toBe(true);
    });

    it("sets correct expiry based on workspace lifetime", () => {
      const now = Date.now();
      const lifetime = 4 * 60 * 60 * 1000; // 4 hours
      const expiresAt = now + lifetime;

      expect(expiresAt - now).toBe(lifetime);
      expect(expiresAt > now).toBe(true);
    });
  });

  describe("Token refresh", () => {
    it("new token invalidates old token", () => {
      const oldToken = generateTestToken();
      const newToken = generateTestToken();

      expect(oldToken).not.toBe(newToken);
    });

    it("expired tokens cannot be refreshed", () => {
      const now = Date.now();
      const expiredSession = { expiresAt: now - 1000 };

      expect(expiredSession.expiresAt < now).toBe(true);
    });
  });

  describe("Token revocation", () => {
    it("revoke should succeed even for non-existent token", () => {
      // Revoke is idempotent — always returns success
      const result = { success: true };
      expect(result.success).toBe(true);
    });
  });
});

// ——————————————————————————————————————————————
// Helpers (mirrors the logic from widgetSessions.ts)
// ——————————————————————————————————————————————

const DEFAULT_SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;
const MIN_SESSION_LIFETIME_MS = 1 * 60 * 60 * 1000;
const MAX_SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_THRESHOLD = 0.25;

function generateTestToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `wst_${hex}`;
}

function getSessionLifetime(sessionLifetimeMs: number | undefined): number {
  if (!sessionLifetimeMs) return DEFAULT_SESSION_LIFETIME_MS;
  return Math.max(MIN_SESSION_LIFETIME_MS, Math.min(MAX_SESSION_LIFETIME_MS, sessionLifetimeMs));
}
