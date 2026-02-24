import type { SDKEvent, SDKEventType, SDKEventListener } from "../types";

const listeners: Set<SDKEventListener> = new Set();

export function addEventListener(listener: SDKEventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function removeEventListener(listener: SDKEventListener): void {
  listeners.delete(listener);
}

export function emitEvent(type: SDKEventType, data: unknown): void {
  const event: SDKEvent = {
    type,
    data,
    timestamp: Date.now(),
  };

  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.error("[OpencomSDK] Event listener error:", error);
    }
  });
}

export function clearEventListeners(): void {
  listeners.clear();
}
