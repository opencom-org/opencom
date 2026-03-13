import { AppState, type AppStateStatus, Platform } from "react-native";
import {
  refreshSession as refreshSessionApi,
  setSessionExpiresAt,
  setSessionToken,
  getVisitorState,
  heartbeat,
  trackAutoEvent as trackAutoEventApi,
  type VisitorId,
} from "@opencom/sdk-core";
import { persistSessionToken } from "./storageService";
import { opencomSDKState } from "./state";
import type { LifecycleServiceContract } from "./contracts";

const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
const REFRESH_MARGIN_MS = 60000; // refresh 60s before expiry

export function scheduleRefresh(expiresAt: number): void {
  stopRefreshTimer();

  const delay = Math.max(0, expiresAt - Date.now() - REFRESH_MARGIN_MS);
  opencomSDKState.refreshTimer = setTimeout(async () => {
    const state = getVisitorState();
    if (!state.sessionToken) return;
    try {
      const result = await refreshSessionApi({ sessionToken: state.sessionToken });
      setSessionToken(result.sessionToken);
      setSessionExpiresAt(result.expiresAt);
      await persistSessionToken(result.sessionToken, result.expiresAt);
      scheduleRefresh(result.expiresAt);
    } catch (error) {
      console.error("[OpencomSDK] Session refresh failed:", error);
    }
  }, delay);
}

export function stopRefreshTimer(): void {
  if (opencomSDKState.refreshTimer) {
    clearTimeout(opencomSDKState.refreshTimer);
    opencomSDKState.refreshTimer = null;
  }
}

export function startHeartbeat(visitorId: VisitorId): void {
  stopHeartbeat();

  // Send initial heartbeat
  const state = getVisitorState();
  heartbeat(visitorId, state.sessionToken ?? undefined).catch(console.error);

  // Set up interval
  opencomSDKState.heartbeatInterval = setInterval(() => {
    const s = getVisitorState();
    heartbeat(visitorId, s.sessionToken ?? undefined).catch(console.error);
  }, HEARTBEAT_INTERVAL_MS);
}

export function stopHeartbeat(): void {
  if (opencomSDKState.heartbeatInterval) {
    clearInterval(opencomSDKState.heartbeatInterval);
    opencomSDKState.heartbeatInterval = null;
  }
}

export function setupAppStateListener(visitorId: VisitorId, sessionId: string): void {
  cleanupAppStateListener();

  let lastAppState: AppStateStatus = AppState.currentState;

  opencomSDKState.appStateSubscription = AppState.addEventListener(
    "change",
    (nextAppState: AppStateStatus) => {
      // App coming to foreground from background
      if (lastAppState.match(/inactive|background/) && nextAppState === "active") {
        const s = getVisitorState();
        trackAutoEventApi({
          visitorId,
          sessionToken: s.sessionToken ?? undefined,
          eventType: "session_start",
          sessionId,
          properties: {
            platform: Platform.OS,
            resumedFromBackground: true,
          },
        }).catch(console.error);
      }

      // App going to background
      if (lastAppState === "active" && nextAppState.match(/inactive|background/)) {
        const s = getVisitorState();
        trackAutoEventApi({
          visitorId,
          sessionToken: s.sessionToken ?? undefined,
          eventType: "session_end",
          sessionId,
          properties: {
            platform: Platform.OS,
          },
        }).catch(console.error);
      }

      lastAppState = nextAppState;
    }
  );
}

export function cleanupAppStateListener(): void {
  if (opencomSDKState.appStateSubscription) {
    opencomSDKState.appStateSubscription.remove();
    opencomSDKState.appStateSubscription = null;
  }
}

export const lifecycleService: LifecycleServiceContract = {
  scheduleRefresh,
  stopRefreshTimer,
  startHeartbeat,
  stopHeartbeat,
  setupAppStateListener,
  cleanupAppStateListener,
};
