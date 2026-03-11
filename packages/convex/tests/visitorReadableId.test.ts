import { describe, expect, it } from "vitest";
import { formatReadableVisitorId as formatSharedReadableVisitorId } from "@opencom/types";
import { formatReadableVisitorId } from "../convex/visitorReadableId";

describe("visitorReadableId", () => {
  it("matches shared deterministic formatter", () => {
    expect(formatReadableVisitorId("visitor_1")).toBe("pretty-eyes-95");
    expect(formatReadableVisitorId("visitor_abc123")).toBe("fancy-hats-33");
    expect(formatReadableVisitorId("wst_test")).toBe(formatSharedReadableVisitorId("wst_test"));
  });
});
