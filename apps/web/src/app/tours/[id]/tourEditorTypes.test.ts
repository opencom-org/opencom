import { describe, expect, it } from "vitest";
import {
  createDefaultStepData,
  getNormalizedStepSaveData,
  getRouteConsistencyWarning,
  parseRouteForComparison,
  toStepFormData,
} from "./tourEditorTypes";

describe("tourEditorTypes", () => {
  it("returns isolated default step data objects", () => {
    const first = createDefaultStepData();
    const second = createDefaultStepData();

    first.title = "Changed";

    expect(second.title).toBe("");
  });

  it("normalizes trimmed save data and surfaces selector validation", () => {
    const result = getNormalizedStepSaveData({
      ...createDefaultStepData(),
      type: "pointer",
      content: "Body",
      elementSelector: "   ",
      routePath: " https://example.com/dashboard?tab=1 ",
    });

    expect(result.normalizedSelector).toBe("");
    expect(result.normalizedRoutePath).toBe("https://example.com/dashboard?tab=1");
    expect(result.validationError).toBe("This step requires an element selector.");
  });

  it("compares routes consistently across relative and absolute paths", () => {
    expect(parseRouteForComparison("/dashboard")).toBe("/dashboard");
    expect(parseRouteForComparison("https://example.com/dashboard?tab=1")).toBe(
      "https://example.com/dashboard?tab=1"
    );
    expect(getRouteConsistencyWarning("/settings", "/dashboard")).toContain("different route");
    expect(
      getRouteConsistencyWarning(
        "https://example.com/dashboard?tab=1",
        "https://example.com/dashboard?tab=1"
      )
    ).toBeNull();
  });

  it("hydrates form state from a saved step document", () => {
    const step = {
      type: "video",
      title: "Watch this",
      content: "Demo",
      elementSelector: "#hero-video",
      routePath: "/dashboard",
      position: "below",
      size: "large",
      advanceOn: "elementClick",
      customButtonText: "Continue",
      mediaUrl: "https://cdn.example.com/demo.mp4",
      mediaType: "video",
    } as Parameters<typeof toStepFormData>[0];

    expect(toStepFormData(step)).toEqual({
      type: "video",
      title: "Watch this",
      content: "Demo",
      elementSelector: "#hero-video",
      routePath: "/dashboard",
      position: "below",
      size: "large",
      advanceOn: "elementClick",
      customButtonText: "Continue",
      mediaUrl: "https://cdn.example.com/demo.mp4",
      mediaType: "video",
    });
  });
});
