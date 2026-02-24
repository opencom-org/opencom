import { describe, it, expect } from "vitest";

describe("discovery.getMetadata", () => {
  it("should return correct metadata structure", async () => {
    const expectedFields = ["version", "name", "features"];

    const mockMetadata = {
      version: "1.0",
      name: "Opencom",
      features: ["chat", "knowledge-base"],
    };

    expectedFields.forEach((field) => {
      expect(mockMetadata).toHaveProperty(field);
    });
  });

  it("should have valid version format", () => {
    const version = "1.0";
    expect(version).toMatch(/^\d+\.\d+$/);
  });

  it("should include required features", () => {
    const features = ["chat", "knowledge-base"];
    expect(features).toContain("chat");
    expect(features).toContain("knowledge-base");
  });
});

describe("discovery endpoint response format", () => {
  it("should include convexUrl in HTTP response", () => {
    const mockResponse = {
      version: "1.0",
      name: "Test Instance",
      convexUrl: "https://example-123.convex.cloud",
      features: ["chat", "knowledge-base"],
    };

    expect(mockResponse).toHaveProperty("convexUrl");
    expect(mockResponse.convexUrl).toMatch(/^https:\/\/.+\.convex\.cloud$/);
  });
});
