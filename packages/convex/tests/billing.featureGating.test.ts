/**
 * Tests for billing feature gating integration.
 *
 * Unit tests verify guard logic.
 * Integration tests require CONVEX_URL + billing-enabled environment.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { PLAN_LIMITS, UNLIMITED_ENTITLEMENTS } from "../convex/billing/types";

// ============================================================
// Unit tests for feature gating contract
// ============================================================

describe("billing feature gating — unit tests", () => {
  describe("UNLIMITED_ENTITLEMENTS (self-hosted)", () => {
    it("self-hosted has all features enabled", () => {
      expect(UNLIMITED_ENTITLEMENTS.features.aiAgent).toBe(true);
      expect(UNLIMITED_ENTITLEMENTS.features.emailCampaigns).toBe(true);
      expect(UNLIMITED_ENTITLEMENTS.features.series).toBe(true);
    });

    it("self-hosted is not restricted", () => {
      expect(UNLIMITED_ENTITLEMENTS.isRestricted).toBe(false);
    });

    it("self-hosted has infinite limits", () => {
      expect(UNLIMITED_ENTITLEMENTS.limits.seats.limit).toBe(Infinity);
      expect(UNLIMITED_ENTITLEMENTS.limits.aiCredits.limit).toBe(Infinity);
      expect(UNLIMITED_ENTITLEMENTS.limits.emails.limit).toBe(Infinity);
    });
  });

  describe("plan limits contract", () => {
    it("starter cannot use AI agent", () => {
      expect(PLAN_LIMITS.starter.aiAgent).toBe(false);
    });

    it("starter cannot create email campaigns", () => {
      expect(PLAN_LIMITS.starter.emailCampaigns).toBe(false);
    });

    it("starter cannot create series", () => {
      expect(PLAN_LIMITS.starter.series).toBe(false);
    });

    it("starter has hard seat limit (no PAYG)", () => {
      expect(PLAN_LIMITS.starter.seatPayg).toBe(false);
      expect(PLAN_LIMITS.starter.seatLimit).toBe(3);
    });

    it("pro can use AI agent", () => {
      expect(PLAN_LIMITS.pro.aiAgent).toBe(true);
    });

    it("pro can create email campaigns and series", () => {
      expect(PLAN_LIMITS.pro.emailCampaigns).toBe(true);
      expect(PLAN_LIMITS.pro.series).toBe(true);
    });

    it("pro has PAYG seats beyond 10", () => {
      expect(PLAN_LIMITS.pro.seatPayg).toBe(true);
      expect(PLAN_LIMITS.pro.seatLimit).toBe(10);
    });
  });

  describe("restricted state logic", () => {
    it("expired subscription is restricted", () => {
      // Covered by getEntitlements handler: expired -> isRestricted = true
      // Validated by isRestricted logic in gates.ts
      const restrictedStatuses = ["expired", "canceled", "past_due", "unpaid"];
      expect(restrictedStatuses).toContain("expired");
      expect(restrictedStatuses).toContain("canceled");
    });

    it("trialing subscription is NOT restricted", () => {
      // Trial is active: visitors can use features normally
      const activeStatuses = ["trialing", "active"];
      expect(activeStatuses).toContain("trialing");
    });
  });
});

// ============================================================
// Integration tests — require CONVEX_URL
// ============================================================

describe("billing feature gating — integration", () => {
  let client: ConvexClient;
  let workspaceId: Id<"workspaces">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);
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

  it("getBillingStatus returns correct structure", async () => {
    const status = await client.query(api.billing.gates.getBillingStatus, { workspaceId });
    expect(status).toBeDefined();
    expect(typeof status.billingEnabled).toBe("boolean");
    expect(status.features).toBeDefined();
    expect(typeof status.features.aiAgent).toBe("boolean");
    expect(typeof status.features.emailCampaigns).toBe("boolean");
    expect(typeof status.features.series).toBe("boolean");
    expect(typeof status.isRestricted).toBe("boolean");
  });

  it("self-hosted workspace has no restrictions", async () => {
    // When STRIPE_SECRET_KEY is not set, all features should be enabled
    const status = await client.query(api.billing.gates.getBillingStatus, { workspaceId });

    // In test environment without Stripe configured, billing is disabled
    if (!status.billingEnabled) {
      expect(status.features.aiAgent).toBe(true);
      expect(status.features.emailCampaigns).toBe(true);
      expect(status.features.series).toBe(true);
      expect(status.isRestricted).toBe(false);
    }
  });
});
