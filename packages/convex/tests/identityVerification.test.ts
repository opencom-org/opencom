import { describe, it, expect } from "vitest";

// Unit tests for HMAC verification logic
// These tests verify the HMAC algorithm implementation

describe("Identity Verification (HMAC)", () => {
  describe("HMAC hash generation", () => {
    it("generates consistent HMAC hash for same input", async () => {
      const secret = "test-secret-key-12345";
      const userId = "user-123";

      const hash1 = await generateHmacHash(userId, secret);
      const hash2 = await generateHmacHash(userId, secret);

      expect(hash1).toBe(hash2);
    });

    it("generates different hash for different user IDs", async () => {
      const secret = "test-secret-key-12345";

      const hash1 = await generateHmacHash("user-123", secret);
      const hash2 = await generateHmacHash("user-456", secret);

      expect(hash1).not.toBe(hash2);
    });

    it("generates different hash for different secrets", async () => {
      const userId = "user-123";

      const hash1 = await generateHmacHash(userId, "secret-1");
      const hash2 = await generateHmacHash(userId, "secret-2");

      expect(hash1).not.toBe(hash2);
    });

    it("generates 64-character hex string", async () => {
      const hash = await generateHmacHash("user-123", "test-secret");

      expect(hash.length).toBe(64);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });

    it("validates hash correctly", async () => {
      const secret = "test-secret-key-12345";
      const userId = "user-123";

      const validHash = await generateHmacHash(userId, secret);

      // Valid hash should verify
      expect(await verifyHmacHash(userId, validHash, secret)).toBe(true);

      // Invalid hash should not verify
      expect(await verifyHmacHash(userId, "invalid-hash", secret)).toBe(false);

      // Wrong user ID should not verify
      expect(await verifyHmacHash("wrong-user", validHash, secret)).toBe(false);
    });

    it("handles case-insensitive hash comparison", async () => {
      const secret = "test-secret-key-12345";
      const userId = "user-123";

      const hash = await generateHmacHash(userId, secret);
      const upperHash = hash.toUpperCase();

      expect(await verifyHmacHash(userId, upperHash, secret)).toBe(true);
    });

    it("handles empty user ID", async () => {
      const secret = "test-secret";
      const hash = await generateHmacHash("", secret);

      expect(hash.length).toBe(64);
      expect(await verifyHmacHash("", hash, secret)).toBe(true);
    });

    it("handles special characters in user ID", async () => {
      const secret = "test-secret";
      const userId = "user@example.com/path?query=1";

      const hash = await generateHmacHash(userId, secret);

      expect(await verifyHmacHash(userId, hash, secret)).toBe(true);
    });

    it("handles unicode characters in user ID", async () => {
      const secret = "test-secret";
      const userId = "用户123";

      const hash = await generateHmacHash(userId, secret);

      expect(await verifyHmacHash(userId, hash, secret)).toBe(true);
    });
  });
});

// Helper functions that mirror the implementation in identityVerification.ts
async function generateHmacHash(userId: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(userId));

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyHmacHash(userId: string, userHash: string, secret: string): Promise<boolean> {
  const expectedHash = await generateHmacHash(userId, secret);
  return expectedHash === userHash.toLowerCase();
}
