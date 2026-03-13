import { describe, expect, it } from "vitest";
import { evaluateRouteMatch } from "@opencom/types";

describe("evaluateRouteMatch", () => {
  it("matches relative routes against the current pathname", () => {
    expect(evaluateRouteMatch("/pricing", "https://opencom.dev/pricing")).toEqual({
      matches: true,
      invalidRoute: false,
    });
  });

  it("matches wildcard absolute URLs", () => {
    expect(
      evaluateRouteMatch(
        "https://opencom.dev/docs/*",
        "https://opencom.dev/docs/widget?tab=tours"
      )
    ).toEqual({
      matches: true,
      invalidRoute: false,
    });
  });

  it("flags invalid absolute route patterns", () => {
    expect(evaluateRouteMatch("https://[", "https://opencom.dev/docs")).toEqual({
      matches: false,
      invalidRoute: true,
    });
  });

  it("supports callers that want missing current URLs to soft-match", () => {
    expect(evaluateRouteMatch("/docs", undefined)).toEqual({
      matches: false,
      invalidRoute: false,
    });
    expect(evaluateRouteMatch("/docs", undefined, { matchWhenCurrentUrlMissing: true })).toEqual({
      matches: true,
      invalidRoute: false,
    });
  });
});
