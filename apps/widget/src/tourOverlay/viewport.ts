import type { VisualViewportBounds } from "./types";

export const SCROLL_SETTLE_DELAY_MS = 150;
export const SCROLL_SETTLE_MAX_WAIT_MS = 1400;

export function getVisualViewportBounds(): VisualViewportBounds {
  if (typeof window === "undefined") {
    return {
      top: 0,
      left: 0,
      width: 0,
      height: 0,
    };
  }

  const visualViewport = window.visualViewport;
  return {
    top: visualViewport?.offsetTop ?? 0,
    left: visualViewport?.offsetLeft ?? 0,
    width: visualViewport?.width ?? window.innerWidth,
    height: visualViewport?.height ?? window.innerHeight,
  };
}

export function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}
