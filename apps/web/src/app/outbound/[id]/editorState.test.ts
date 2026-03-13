import { describe, expect, it } from "vitest";
import {
  createDefaultClickActionFormState,
  createDefaultPostButtonFormState,
  getClickActionSummary,
  getPostPreviewButtons,
} from "./editorState";

describe("editorState", () => {
  it("returns isolated default click action state objects", () => {
    const first = createDefaultClickActionFormState();
    const second = createDefaultClickActionFormState();

    first.type = "open_url";
    first.url = "https://example.com/pricing";

    expect(second.type).toBe("open_messenger");
    expect(second.url).toBe("");
  });

  it("returns isolated default post button state objects", () => {
    const first = createDefaultPostButtonFormState();
    const second = createDefaultPostButtonFormState();

    first.primaryButtonText = "Changed";

    expect(second.primaryButtonText).toBe("Learn More");
  });

  it("builds preview button metadata from the post button form state", () => {
    expect(
      getPostPreviewButtons({
        ...createDefaultPostButtonFormState(),
        primaryButtonText: " Learn More ",
        dismissButtonText: " Maybe later ",
      })
    ).toEqual([
      { text: "Learn More", variant: "primary" },
      { text: "Maybe later", variant: "secondary" },
    ]);
  });

  it("summarizes the current click action for the preview panel", () => {
    expect(getClickActionSummary(createDefaultClickActionFormState())).toBe("Open Messenger");
    expect(
      getClickActionSummary({
        ...createDefaultClickActionFormState(),
        type: "open_widget_tab",
        tabId: "help",
      })
    ).toBe("Open Tab (help)");
    expect(
      getClickActionSummary({
        ...createDefaultClickActionFormState(),
        type: "dismiss",
      })
    ).toBe("Dismiss");
  });
});
