import { describe, expect, it } from "vitest";
import { isAuthorizedAdminSecret, isTestDataGatewayEnabled } from "../convex/testAdmin";

describe("testAdmin secret validation", () => {
  it("authorizes matching secrets", () => {
    expect(isAuthorizedAdminSecret("local-dev-secret", "local-dev-secret")).toBe(true);
  });

  it("authorizes canonically equivalent unicode secrets", () => {
    expect(isAuthorizedAdminSecret("Cafe\u0301", "Café")).toBe(true);
  });

  it("rejects mismatched secrets with the same length", () => {
    expect(isAuthorizedAdminSecret("aaaaaaaa", "aaaaaaab")).toBe(false);
  });

  it("rejects secrets with different lengths", () => {
    expect(isAuthorizedAdminSecret("short", "much-longer")).toBe(false);
  });

  it("rejects empty secrets", () => {
    expect(isAuthorizedAdminSecret("", "configured-secret")).toBe(false);
    expect(isAuthorizedAdminSecret("configured-secret", "")).toBe(false);
  });

  it("enables the test data gateway only when ALLOW_TEST_DATA is exactly true", () => {
    expect(isTestDataGatewayEnabled({ ALLOW_TEST_DATA: "true" })).toBe(true);
    expect(isTestDataGatewayEnabled({ ALLOW_TEST_DATA: "false" })).toBe(false);
    expect(isTestDataGatewayEnabled({ ALLOW_TEST_DATA: "TRUE" })).toBe(false);
    expect(isTestDataGatewayEnabled({})).toBe(false);
  });
});
