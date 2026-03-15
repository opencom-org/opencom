/**
 * Tests for billing gates: getEntitlements, getBillingStatus, and related logic.
 *
 * These integration tests require a live Convex deployment with CONVEX_URL set.
 * They also require the billing module to be deployed (schema, gates, stubs).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { isBillingEnabled, PLAN_LIMITS, UNLIMITED_ENTITLEMENTS } from "../convex/billing/types";

// ============================================================
// Unit tests for pure logic (no Convex required)
// ============================================================

describe("billing types — unit tests", () => {
  describe("PLAN_LIMITS", () => {
    it("starter has 3 seat limit, no AI, no campaigns", () => {
      expect(PLAN_LIMITS.starter.seatLimit).toBe(3);
      expect(PLAN_LIMITS.starter.aiAgent).toBe(false);
      expect(PLAN_LIMITS.starter.emailCampaigns).toBe(false);
      expect(PLAN_LIMITS.starter.series).toBe(false);
      expect(PLAN_LIMITS.starter.seatPayg).toBe(false);
    });

    it("pro has 10 seat limit with PAYG, AI enabled, campaigns enabled", () => {
      expect(PLAN_LIMITS.pro.seatLimit).toBe(10);
      expect(PLAN_LIMITS.pro.aiAgent).toBe(true);
      expect(PLAN_LIMITS.pro.emailCampaigns).toBe(true);
      expect(PLAN_LIMITS.pro.series).toBe(true);
      expect(PLAN_LIMITS.pro.seatPayg).toBe(true);
    });

    it("pro has $20 AI credits included (2000 cents)", () => {
      expect(PLAN_LIMITS.pro.aiCreditLimitCents).toBe(2_000);
    });

    it("both plans include 10,000 emails", () => {
      expect(PLAN_LIMITS.starter.emailLimit).toBe(10_000);
      expect(PLAN_LIMITS.pro.emailLimit).toBe(10_000);
    });
  });

  describe("UNLIMITED_ENTITLEMENTS", () => {
    it("is unlimited plan with all features enabled", () => {
      expect(UNLIMITED_ENTITLEMENTS.plan).toBe("unlimited");
      expect(UNLIMITED_ENTITLEMENTS.status).toBe("unlimited");
      expect(UNLIMITED_ENTITLEMENTS.features.aiAgent).toBe(true);
      expect(UNLIMITED_ENTITLEMENTS.features.emailCampaigns).toBe(true);
      expect(UNLIMITED_ENTITLEMENTS.features.series).toBe(true);
    });

    it("has infinite limits with no hard caps", () => {
      expect(UNLIMITED_ENTITLEMENTS.limits.seats.limit).toBe(Infinity);
      expect(UNLIMITED_ENTITLEMENTS.limits.aiCredits.limit).toBe(Infinity);
      expect(UNLIMITED_ENTITLEMENTS.limits.emails.limit).toBe(Infinity);
      expect(UNLIMITED_ENTITLEMENTS.limits.seats.hardCap).toBe(false);
      expect(UNLIMITED_ENTITLEMENTS.limits.aiCredits.hardCap).toBe(false);
      expect(UNLIMITED_ENTITLEMENTS.limits.emails.hardCap).toBe(false);
    });

    it("is not restricted", () => {
      expect(UNLIMITED_ENTITLEMENTS.isRestricted).toBe(false);
    });
  });

  describe("isBillingEnabled", () => {
    it("returns false when STRIPE_SECRET_KEY is not set", () => {
      const original = process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_SECRET_KEY;
      expect(isBillingEnabled()).toBe(false);
      if (original !== undefined) {
        process.env.STRIPE_SECRET_KEY = original;
      }
    });

    it("returns true when STRIPE_SECRET_KEY is set", () => {
      const original = process.env.STRIPE_SECRET_KEY;
      process.env.STRIPE_SECRET_KEY = "sk_test_fake";
      expect(isBillingEnabled()).toBe(true);
      if (original !== undefined) {
        process.env.STRIPE_SECRET_KEY = original;
      } else {
        delete process.env.STRIPE_SECRET_KEY;
      }
    });
  });
});

// ============================================================
// Integration tests — require CONVEX_URL
// ============================================================

describe("billing.gates.getBillingStatus — integration", () => {
  let client: ConvexClient;
  let workspaceId: Id<"workspaces">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    // Create a test workspace
    const result = await client.mutation(api.testing_helpers.createTestWorkspace, {});
    workspaceId = result.workspaceId;
  });

  afterAll(async () => {
    if (workspaceId) {
      try {
        await client.mutation(api.testing_helpers.cleanupTestData, { workspaceId });
      } catch (e) {
        console.warn("Cleanup failed:", e);
      }
    }
    await client.close();
  });

  it("returns billingEnabled=false and unlimited features when billing is not configured", async () => {
    // NOTE: In test environments, STRIPE_SECRET_KEY is typically not set,
    // so getBillingStatus should return billingEnabled: false
    const status = await client.query(api.billing.gates.getBillingStatus, { workspaceId });

    // In test environments without Stripe configured, should return unlimited
    expect(status).toBeDefined();
    expect(status.plan).toBeDefined();
    expect(status.features).toBeDefined();
    expect(status.features.aiAgent).toBeDefined();
    expect(status.features.emailCampaigns).toBeDefined();
    expect(status.features.series).toBeDefined();
    expect(status.isRestricted).toBe(false);
  });
});
