import { describe, it, expect } from "vitest";
import { evaluateTrigger, TriggerConfig, TriggerContext } from "../convex/audienceRules";

describe("evaluateTrigger", () => {
  describe("immediate trigger", () => {
    it("should always return true for immediate trigger", () => {
      const trigger: TriggerConfig = { type: "immediate" };
      const context: TriggerContext = {};

      expect(evaluateTrigger(trigger, context)).toBe(true);
    });
  });

  describe("page_visit trigger", () => {
    it("should match exact URL", () => {
      const trigger: TriggerConfig = {
        type: "page_visit",
        pageUrl: "/pricing",
        pageUrlMatch: "exact",
      };

      expect(evaluateTrigger(trigger, { currentUrl: "/pricing" })).toBe(true);
      expect(evaluateTrigger(trigger, { currentUrl: "/pricing/" })).toBe(false);
      expect(evaluateTrigger(trigger, { currentUrl: "/pricing-page" })).toBe(false);
    });

    it("should match URL containing pattern", () => {
      const trigger: TriggerConfig = {
        type: "page_visit",
        pageUrl: "pricing",
        pageUrlMatch: "contains",
      };

      expect(evaluateTrigger(trigger, { currentUrl: "/pricing" })).toBe(true);
      expect(evaluateTrigger(trigger, { currentUrl: "/pricing-page" })).toBe(true);
      expect(evaluateTrigger(trigger, { currentUrl: "/about" })).toBe(false);
    });

    it("should match URL with regex pattern", () => {
      const trigger: TriggerConfig = {
        type: "page_visit",
        pageUrl: "^/products/\\d+$",
        pageUrlMatch: "regex",
      };

      expect(evaluateTrigger(trigger, { currentUrl: "/products/123" })).toBe(true);
      expect(evaluateTrigger(trigger, { currentUrl: "/products/456" })).toBe(true);
      expect(evaluateTrigger(trigger, { currentUrl: "/products/abc" })).toBe(false);
      expect(evaluateTrigger(trigger, { currentUrl: "/products/" })).toBe(false);
    });

    it("should return false when pageUrl is missing", () => {
      const trigger: TriggerConfig = {
        type: "page_visit",
        pageUrlMatch: "contains",
      };

      expect(evaluateTrigger(trigger, { currentUrl: "/pricing" })).toBe(false);
    });

    it("should return false when currentUrl is missing", () => {
      const trigger: TriggerConfig = {
        type: "page_visit",
        pageUrl: "/pricing",
        pageUrlMatch: "contains",
      };

      expect(evaluateTrigger(trigger, {})).toBe(false);
    });
  });

  describe("time_on_page trigger", () => {
    it("should match when time exceeds threshold", () => {
      const trigger: TriggerConfig = {
        type: "time_on_page",
        delaySeconds: 30,
      };

      expect(evaluateTrigger(trigger, { timeOnPageSeconds: 30 })).toBe(true);
      expect(evaluateTrigger(trigger, { timeOnPageSeconds: 60 })).toBe(true);
      expect(evaluateTrigger(trigger, { timeOnPageSeconds: 29 })).toBe(false);
    });

    it("should return false when delaySeconds is missing", () => {
      const trigger: TriggerConfig = {
        type: "time_on_page",
      };

      expect(evaluateTrigger(trigger, { timeOnPageSeconds: 60 })).toBe(false);
    });

    it("should return false when timeOnPageSeconds is missing", () => {
      const trigger: TriggerConfig = {
        type: "time_on_page",
        delaySeconds: 30,
      };

      expect(evaluateTrigger(trigger, {})).toBe(false);
    });
  });

  describe("scroll_depth trigger", () => {
    it("should match when scroll exceeds threshold", () => {
      const trigger: TriggerConfig = {
        type: "scroll_depth",
        scrollPercent: 50,
      };

      expect(evaluateTrigger(trigger, { scrollPercent: 50 })).toBe(true);
      expect(evaluateTrigger(trigger, { scrollPercent: 75 })).toBe(true);
      expect(evaluateTrigger(trigger, { scrollPercent: 49 })).toBe(false);
    });

    it("should return false when scrollPercent is missing in trigger", () => {
      const trigger: TriggerConfig = {
        type: "scroll_depth",
      };

      expect(evaluateTrigger(trigger, { scrollPercent: 75 })).toBe(false);
    });

    it("should return false when scrollPercent is missing in context", () => {
      const trigger: TriggerConfig = {
        type: "scroll_depth",
        scrollPercent: 50,
      };

      expect(evaluateTrigger(trigger, {})).toBe(false);
    });
  });

  describe("event trigger", () => {
    it("should match when event name matches", () => {
      const trigger: TriggerConfig = {
        type: "event",
        eventName: "button_click",
      };

      expect(evaluateTrigger(trigger, { firedEventName: "button_click" })).toBe(true);
      expect(evaluateTrigger(trigger, { firedEventName: "page_view" })).toBe(false);
    });

    it("should match when event name and properties match", () => {
      const trigger: TriggerConfig = {
        type: "event",
        eventName: "purchase",
        eventProperties: { category: "electronics" },
      };

      expect(
        evaluateTrigger(trigger, {
          firedEventName: "purchase",
          firedEventProperties: { category: "electronics", amount: 100 },
        })
      ).toBe(true);

      expect(
        evaluateTrigger(trigger, {
          firedEventName: "purchase",
          firedEventProperties: { category: "clothing" },
        })
      ).toBe(false);
    });

    it("should return false when eventName is missing in trigger", () => {
      const trigger: TriggerConfig = {
        type: "event",
      };

      expect(evaluateTrigger(trigger, { firedEventName: "button_click" })).toBe(false);
    });

    it("should return false when firedEventName is missing in context", () => {
      const trigger: TriggerConfig = {
        type: "event",
        eventName: "button_click",
      };

      expect(evaluateTrigger(trigger, {})).toBe(false);
    });
  });

  describe("exit_intent trigger", () => {
    it("should match when exit intent is detected", () => {
      const trigger: TriggerConfig = {
        type: "exit_intent",
      };

      expect(evaluateTrigger(trigger, { isExitIntent: true })).toBe(true);
      expect(evaluateTrigger(trigger, { isExitIntent: false })).toBe(false);
      expect(evaluateTrigger(trigger, {})).toBe(false);
    });
  });

  describe("null/undefined trigger", () => {
    it("should return true when trigger is null", () => {
      expect(evaluateTrigger(null, {})).toBe(true);
    });

    it("should return true when trigger is undefined", () => {
      expect(evaluateTrigger(undefined, {})).toBe(true);
    });
  });
});
