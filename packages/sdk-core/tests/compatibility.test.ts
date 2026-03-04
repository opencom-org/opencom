import { describe, expect, it, vi, afterEach } from "vitest";
import {
  OpencomConvexCompatibilityError,
  assertConvexContractCompatibility,
  discoverBackendContractVersion,
  isConvexContractVersionSupported,
  normalizeContractVersion,
} from "../src/compatibility";

describe("sdk-core convex compatibility", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes compact contract versions", () => {
    expect(normalizeContractVersion("1")).toBe("1.0.0");
    expect(normalizeContractVersion("1.2")).toBe("1.2.0");
    expect(normalizeContractVersion("1.2.3-next.1")).toBe("1.2.3-next.1");
  });

  it("checks major range and minimum version", () => {
    const range = {
      minimum: "1.0.0",
      current: "1.3.0",
      maximum: "1.x",
    };

    expect(isConvexContractVersionSupported("1.0.0", range)).toBe(true);
    expect(isConvexContractVersionSupported("1.9.9", range)).toBe(true);
    expect(isConvexContractVersionSupported("0.9.9", range)).toBe(false);
    expect(isConvexContractVersionSupported("2.0.0", range)).toBe(false);
  });

  it("throws deterministic compatibility error for unsupported contract versions", () => {
    expect(() =>
      assertConvexContractCompatibility("2.0.0", {
        packageName: "@opencom/react-native-sdk",
        range: {
          minimum: "1.0.0",
          current: "1.0.0",
          maximum: "1.x",
        },
      })
    ).toThrow(OpencomConvexCompatibilityError);

    try {
      assertConvexContractCompatibility("2.0.0", {
        packageName: "@opencom/react-native-sdk",
        range: {
          minimum: "1.0.0",
          current: "1.0.0",
          maximum: "1.x",
        },
      });
    } catch (error) {
      const typedError = error as OpencomConvexCompatibilityError;
      expect(typedError.code).toBe("OPENCOM_UNSUPPORTED_CONVEX_CONTRACT");
      expect(typedError.message).toContain("Supported range is 1.0.0 to 1.x");
    }
  });

  it("reads contract version from discovery metadata when available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ version: "1.0" }),
      }))
    );

    await expect(
      discoverBackendContractVersion("https://example.convex.cloud/")
    ).resolves.toBe("1.0.0");
  });

  it("validates OPENCOM_CONVEX_CONTRACT_VERSION matrix entry when provided", () => {
    const contractVersionUnderTest = process.env.OPENCOM_CONVEX_CONTRACT_VERSION;
    if (!contractVersionUnderTest) {
      return;
    }

    expect(() => assertConvexContractCompatibility(contractVersionUnderTest)).not.toThrow();
  });
});
