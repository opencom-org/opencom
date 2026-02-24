import { describe, it, expect } from "vitest";

describe("CORS Validation", () => {
  describe("Origin format validation", () => {
    const isValidOrigin = (origin: string): boolean => {
      try {
        const url = new URL(origin);
        // Origin should only have protocol, hostname, and optional port
        // No path, query, or fragment
        const reconstructed = url.origin;
        return reconstructed === origin && (url.protocol === "http:" || url.protocol === "https:");
      } catch {
        return false;
      }
    };

    it("should accept valid HTTPS origins", () => {
      expect(isValidOrigin("https://example.com")).toBe(true);
      expect(isValidOrigin("https://app.example.com")).toBe(true);
      expect(isValidOrigin("https://example.com:8080")).toBe(true);
    });

    it("should accept valid HTTP origins", () => {
      expect(isValidOrigin("http://localhost")).toBe(true);
      expect(isValidOrigin("http://localhost:3000")).toBe(true);
      expect(isValidOrigin("http://127.0.0.1:8080")).toBe(true);
    });

    it("should reject origins with paths", () => {
      expect(isValidOrigin("https://example.com/path")).toBe(false);
      expect(isValidOrigin("https://example.com/")).toBe(false);
    });

    it("should reject origins with query strings", () => {
      expect(isValidOrigin("https://example.com?query=value")).toBe(false);
    });

    it("should reject invalid URLs", () => {
      expect(isValidOrigin("not-a-url")).toBe(false);
      expect(isValidOrigin("")).toBe(false);
      expect(isValidOrigin("example.com")).toBe(false);
    });

    it("should reject non-http/https protocols", () => {
      expect(isValidOrigin("ftp://example.com")).toBe(false);
      expect(isValidOrigin("file:///path")).toBe(false);
    });
  });

  describe("Origin matching logic", () => {
    const matchOrigin = (origin: string, allowedOrigins: string[]): boolean => {
      if (allowedOrigins.length === 0) {
        return true; // Empty allowlist means all origins allowed
      }
      return allowedOrigins.includes(origin);
    };

    it("should allow any origin when allowlist is empty", () => {
      expect(matchOrigin("https://example.com", [])).toBe(true);
      expect(matchOrigin("https://any.site.com", [])).toBe(true);
    });

    it("should allow exact matches", () => {
      const allowed = ["https://example.com", "https://app.example.com"];
      expect(matchOrigin("https://example.com", allowed)).toBe(true);
      expect(matchOrigin("https://app.example.com", allowed)).toBe(true);
    });

    it("should reject non-matching origins", () => {
      const allowed = ["https://example.com"];
      expect(matchOrigin("https://other.com", allowed)).toBe(false);
      expect(matchOrigin("https://sub.example.com", allowed)).toBe(false);
    });

    it("should be case-sensitive for origins", () => {
      const allowed = ["https://Example.com"];
      expect(matchOrigin("https://example.com", allowed)).toBe(false);
    });

    it("should treat different ports as different origins", () => {
      const allowed = ["https://example.com:8080"];
      expect(matchOrigin("https://example.com:8080", allowed)).toBe(true);
      expect(matchOrigin("https://example.com:3000", allowed)).toBe(false);
      expect(matchOrigin("https://example.com", allowed)).toBe(false);
    });
  });

  describe("Wildcard pattern matching", () => {
    const matchWildcard = (origin: string, pattern: string): boolean => {
      if (!pattern.includes("*")) {
        return origin === pattern;
      }

      // Convert wildcard pattern to regex
      const regexPattern = pattern
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // Escape special regex chars
        .replace(/\*/g, ".*"); // Replace * with .*

      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(origin);
    };

    it("should match subdomain wildcards", () => {
      const pattern = "https://*.example.com";
      expect(matchWildcard("https://app.example.com", pattern)).toBe(true);
      expect(matchWildcard("https://staging.example.com", pattern)).toBe(true);
      expect(matchWildcard("https://example.com", pattern)).toBe(false);
    });

    it("should match exact patterns without wildcards", () => {
      const pattern = "https://example.com";
      expect(matchWildcard("https://example.com", pattern)).toBe(true);
      expect(matchWildcard("https://other.com", pattern)).toBe(false);
    });
  });

  describe("Security considerations", () => {
    it("should not allow null origin attacks", () => {
      const isValidOrigin = (origin: string): boolean => {
        return origin !== "null" && origin.length > 0;
      };

      expect(isValidOrigin("null")).toBe(false);
      expect(isValidOrigin("")).toBe(false);
    });

    it("should handle origins with authentication info", () => {
      // Origins with auth info should be rejected
      const containsAuth = (origin: string): boolean => {
        try {
          const url = new URL(origin);
          return url.username !== "" || url.password !== "";
        } catch {
          return false;
        }
      };

      expect(containsAuth("https://user:pass@example.com")).toBe(true);
      expect(containsAuth("https://example.com")).toBe(false);
    });
  });
});
