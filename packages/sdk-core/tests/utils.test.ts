import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  addEventListener,
  removeEventListener,
  emitEvent,
  clearEventListeners,
} from "../src/utils/events";
import type { SDKEvent } from "../src/types";

describe("Event System", () => {
  beforeEach(() => {
    clearEventListeners();
  });

  it("should add and call event listener", () => {
    const listener = vi.fn();
    addEventListener(listener);
    emitEvent("visitor_created", { visitorId: "test" });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "visitor_created",
        data: { visitorId: "test" },
      })
    );
  });

  it("should include timestamp in event", () => {
    const listener = vi.fn();
    addEventListener(listener);
    const before = Date.now();
    emitEvent("message_sent", {});
    const after = Date.now();
    const event = listener.mock.calls[0][0] as SDKEvent;
    expect(event.timestamp).toBeGreaterThanOrEqual(before);
    expect(event.timestamp).toBeLessThanOrEqual(after);
  });

  it("should remove event listener", () => {
    const listener = vi.fn();
    addEventListener(listener);
    removeEventListener(listener);
    emitEvent("visitor_created", {});
    expect(listener).not.toHaveBeenCalled();
  });

  it("should return unsubscribe function", () => {
    const listener = vi.fn();
    const unsubscribe = addEventListener(listener);
    unsubscribe();
    emitEvent("visitor_created", {});
    expect(listener).not.toHaveBeenCalled();
  });

  it("should call multiple listeners", () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    addEventListener(listener1);
    addEventListener(listener2);
    emitEvent("message_received", { content: "test" });
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it("should handle listener errors gracefully", () => {
    const errorListener = vi.fn(() => {
      throw new Error("Test error");
    });
    const goodListener = vi.fn();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    addEventListener(errorListener);
    addEventListener(goodListener);
    emitEvent("visitor_created", {});

    expect(errorListener).toHaveBeenCalled();
    expect(goodListener).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("should clear all listeners", () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    addEventListener(listener1);
    addEventListener(listener2);
    clearEventListeners();
    emitEvent("visitor_created", {});
    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).not.toHaveBeenCalled();
  });
});
