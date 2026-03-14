import { describe, it, expect } from "vitest";
import {
  isValidScope,
  validateScopes,
  AUTOMATION_SCOPES,
} from "../convex/automationScopes";

describe("Automation Scopes", () => {
  describe("isValidScope", () => {
    it("accepts all defined scopes", () => {
      for (const scope of AUTOMATION_SCOPES) {
        expect(isValidScope(scope)).toBe(true);
      }
    });

    it("rejects invalid scopes", () => {
      expect(isValidScope("invalid.scope")).toBe(false);
      expect(isValidScope("")).toBe(false);
      expect(isValidScope("conversations")).toBe(false);
      expect(isValidScope("conversations.delete")).toBe(false);
    });
  });

  describe("validateScopes", () => {
    it("returns valid scopes array", () => {
      const scopes = validateScopes(["conversations.read", "messages.write"]);
      expect(scopes).toEqual(["conversations.read", "messages.write"]);
    });

    it("throws for invalid scopes", () => {
      expect(() => validateScopes(["conversations.read", "invalid"])).toThrow(
        "Invalid automation scopes: invalid"
      );
    });

    it("throws listing all invalid scopes", () => {
      expect(() => validateScopes(["bad1", "bad2"])).toThrow(
        "Invalid automation scopes: bad1, bad2"
      );
    });

    it("accepts empty array", () => {
      expect(validateScopes([])).toEqual([]);
    });
  });

  describe("scope definitions", () => {
    it("has expected v1 scopes", () => {
      expect(AUTOMATION_SCOPES).toContain("conversations.read");
      expect(AUTOMATION_SCOPES).toContain("conversations.write");
      expect(AUTOMATION_SCOPES).toContain("messages.read");
      expect(AUTOMATION_SCOPES).toContain("messages.write");
      expect(AUTOMATION_SCOPES).toContain("visitors.read");
      expect(AUTOMATION_SCOPES).toContain("visitors.write");
      expect(AUTOMATION_SCOPES).toContain("tickets.read");
      expect(AUTOMATION_SCOPES).toContain("tickets.write");
      expect(AUTOMATION_SCOPES).toContain("events.read");
      expect(AUTOMATION_SCOPES).toContain("events.write");
      expect(AUTOMATION_SCOPES).toContain("webhooks.manage");
      expect(AUTOMATION_SCOPES).toContain("claims.manage");
    });

    it("has exactly 16 v1 scopes", () => {
      expect(AUTOMATION_SCOPES).toHaveLength(16);
    });
  });
});
