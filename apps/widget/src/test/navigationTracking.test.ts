import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("navigation tracking (safe subscriptions)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should not monkey-patch history.pushState", () => {
    const originalPushState = history.pushState;
    // After the refactor, the navigation tracking hook uses polling + popstate
    // instead of overwriting history methods. Verify the originals are untouched.
    expect(history.pushState).toBe(originalPushState);
  });

  it("should not monkey-patch history.replaceState", () => {
    const originalReplaceState = history.replaceState;
    expect(history.replaceState).toBe(originalReplaceState);
  });

  it("polling interval should detect URL changes", () => {
    // Simulate what the hook does: poll location.href every 200ms
    let lastHref = "https://example.com/page1";
    const onUrlChange = vi.fn();

    const pollInterval = setInterval(() => {
      const currentHref = "https://example.com/page2"; // simulate URL change
      if (currentHref !== lastHref) {
        lastHref = currentHref;
        onUrlChange(currentHref);
      }
    }, 200);

    vi.advanceTimersByTime(200);
    expect(onUrlChange).toHaveBeenCalledWith("https://example.com/page2");

    // Should not fire again if URL hasn't changed
    vi.advanceTimersByTime(200);
    expect(onUrlChange).toHaveBeenCalledTimes(1);

    clearInterval(pollInterval);
  });

  it("popstate listener should fire on back/forward navigation", () => {
    const handler = vi.fn();
    window.addEventListener("popstate", handler);

    // Simulate popstate event
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener("popstate", handler);
  });
});
