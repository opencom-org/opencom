import { describe, expect, it } from "vitest";
import { formatReadableVisitorId } from "@opencom/types";
import {
  formatHumanVisitorId,
  formatVisitorEmailLabel,
  formatVisitorIdentityLabel,
} from "../visitorIdentity";

describe("visitorIdentity", () => {
  it("keeps deterministic numbered output aligned with shared formatter", () => {
    expect(formatHumanVisitorId("visitor_1")).toBe("pretty-eyes-95");
    expect(formatHumanVisitorId("visitor_abc123")).toBe("fancy-hats-33");
    expect(formatHumanVisitorId("wst_test")).toBe(formatReadableVisitorId("wst_test"));
  });

  it("keeps deterministic verb output for web-only variant", () => {
    expect(formatHumanVisitorId("visitor_1", "verb")).toBe("pretty-eyes-cover");
    expect(formatHumanVisitorId("visitor_abc123", "verb")).toBe("fancy-hats-leave");
  });

  it("applies identity-label fallback precedence", () => {
    expect(
      formatVisitorIdentityLabel({
        name: "Alex Doe",
        email: "alex@example.com",
        readableId: "calm-otters-05",
        visitorId: "visitor_1",
      })
    ).toBe("Alex Doe");

    expect(
      formatVisitorIdentityLabel({
        email: "alex@example.com",
        readableId: "calm-otters-05",
        visitorId: "visitor_1",
      })
    ).toBe("alex@example.com");

    expect(
      formatVisitorIdentityLabel({
        readableId: "calm-otters-05",
        visitorId: "visitor_1",
      })
    ).toBe("calm-otters-05");

    expect(
      formatVisitorIdentityLabel({
        visitorId: "visitor_1",
      })
    ).toBe("pretty-eyes-95");
  });

  it("applies email label fallback precedence", () => {
    expect(
      formatVisitorEmailLabel({
        email: "alex@example.com",
        readableId: "calm-otters-05",
        visitorId: "visitor_1",
      })
    ).toBe("alex@example.com");

    expect(
      formatVisitorEmailLabel({
        readableId: "calm-otters-05",
        visitorId: "visitor_1",
      })
    ).toBe("calm-otters-05");

    expect(
      formatVisitorEmailLabel({
        visitorId: "visitor_1",
      })
    ).toBe("pretty-eyes-95");
  });
});
