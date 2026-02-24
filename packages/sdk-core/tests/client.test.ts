import { beforeEach, describe, expect, it, vi } from "vitest";

const clientMocks = vi.hoisted(() => {
  const query = vi.fn();
  const mutation = vi.fn();
  const constructor = vi.fn().mockImplementation(function MockConvexReactClient() {
    return { query, mutation };
  });
  return { query, mutation, constructor };
});

vi.mock("convex/react", () => ({
  ConvexReactClient: clientMocks.constructor,
}));

import { getConfig, initializeClient, resetClient, validateConvexUrl } from "../src/api/client";

describe("sdk-core client URL validation", () => {
  beforeEach(() => {
    resetClient();
    clientMocks.constructor.mockClear();
  });

  it("accepts https Convex URLs and normalizes trailing slash", () => {
    initializeClient({
      workspaceId: "workspace_test",
      convexUrl: "https://example.convex.cloud/",
    });

    expect(clientMocks.constructor).toHaveBeenCalledWith("https://example.convex.cloud");
    expect(getConfig().convexUrl).toBe("https://example.convex.cloud");
  });

  it("allows localhost and 127.0.0.1 over http for local development", () => {
    expect(validateConvexUrl("http://localhost:3210")).toBe("http://localhost:3210");
    expect(validateConvexUrl("http://127.0.0.1:3210")).toBe("http://127.0.0.1:3210");
  });

  it("rejects non-localhost http URLs", () => {
    expect(() => validateConvexUrl("http://api.opencom.dev")).toThrow(
      "Insecure http:// convexUrl is only allowed for localhost or 127.0.0.1 development."
    );
  });

  it("rejects invalid URLs and non-http(s) schemes", () => {
    expect(() => validateConvexUrl("not-a-url")).toThrow("convexUrl must be a valid URL");
    expect(() => validateConvexUrl("ws://localhost:3210")).toThrow("convexUrl must use https://.");
  });

  it("reuses existing client for equivalent normalized URLs", () => {
    const first = initializeClient({
      workspaceId: "workspace_test",
      convexUrl: "https://example.convex.cloud/",
    });
    const second = initializeClient({
      workspaceId: "workspace_test",
      convexUrl: "https://example.convex.cloud",
    });

    expect(first).toBe(second);
    expect(clientMocks.constructor).toHaveBeenCalledTimes(1);
  });
});
