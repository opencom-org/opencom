import { describe, it, expect } from "vitest";
import {
  parsePaginationParams,
  buildPaginatedResponse,
  jsonResponse,
  errorResponse,
} from "../convex/lib/apiHelpers";

describe("API Helpers", () => {
  describe("parsePaginationParams", () => {
    it("returns defaults when no params given", () => {
      const url = new URL("https://example.com/api/v1/conversations");
      const { cursor, limit, updatedSince } = parsePaginationParams(url);

      expect(cursor).toBeNull();
      expect(limit).toBe(20);
      expect(updatedSince).toBeNull();
    });

    it("parses cursor param", () => {
      const url = new URL("https://example.com/api?cursor=abc123");
      const { cursor } = parsePaginationParams(url);
      expect(cursor).toBe("abc123");
    });

    it("parses limit param", () => {
      const url = new URL("https://example.com/api?limit=50");
      const { limit } = parsePaginationParams(url);
      expect(limit).toBe(50);
    });

    it("clamps limit to max 100", () => {
      const urlHigh = new URL("https://example.com/api?limit=500");
      expect(parsePaginationParams(urlHigh).limit).toBe(100);
    });

    it("clamps limit to min 1", () => {
      const urlNeg = new URL("https://example.com/api?limit=-5");
      expect(parsePaginationParams(urlNeg).limit).toBe(1);
    });

    it("parses updatedSince param", () => {
      const url = new URL("https://example.com/api?updatedSince=1700000000000");
      const { updatedSince } = parsePaginationParams(url);
      expect(updatedSince).toBe(1700000000000);
    });

    it("handles invalid limit gracefully", () => {
      const url = new URL("https://example.com/api?limit=abc");
      expect(parsePaginationParams(url).limit).toBe(20);
    });
  });

  describe("buildPaginatedResponse", () => {
    it("returns all items when under limit", () => {
      const items = [{ id: 1 }, { id: 2 }];
      const result = buildPaginatedResponse(items, 10);

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it("truncates and returns nextCursor when over limit", () => {
      const items = [{ id: 1, _ct: "a" }, { id: 2, _ct: "b" }, { id: 3, _ct: "c" }];
      const result = buildPaginatedResponse(items, 2, (item) => item._ct);

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe("b");
    });

    it("returns null nextCursor without extractor", () => {
      const items = [1, 2, 3];
      const result = buildPaginatedResponse(items, 2);

      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe("jsonResponse", () => {
    it("creates JSON response with default 200 status", async () => {
      const resp = jsonResponse({ foo: "bar" });
      expect(resp.status).toBe(200);
      expect(resp.headers.get("Content-Type")).toBe("application/json");

      const body = await resp.json();
      expect(body).toEqual({ foo: "bar" });
    });

    it("supports custom status code", () => {
      const resp = jsonResponse({ id: "123" }, 201);
      expect(resp.status).toBe(201);
    });
  });

  describe("errorResponse", () => {
    it("creates error JSON response", async () => {
      const resp = errorResponse("Not found", 404);
      expect(resp.status).toBe(404);

      const body = await resp.json();
      expect(body).toEqual({ error: "Not found" });
    });
  });
});
