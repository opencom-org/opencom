import { Platform } from "react-native";
import {
  initializeClient,
  setStorageAdapter,
  bootSession as bootSessionApi,
  identifyVisitor as identifyVisitorApi,
  trackAutoEvent as trackAutoEventApi,
  revokeSession as revokeSessionApi,
  setVisitorId,
  setSessionToken,
  setSessionExpiresAt,
  clearSessionToken,
  setSessionId,
  setUser,
  clearUser,
  getVisitorState,
  generateSessionId,
  emitEvent,
  type DeviceInfo,
  type SDKConfig,
  type UserIdentification,
  type VisitorId,
} from "@opencom/sdk-core";
import {
  clearPersistedSessionId,
  clearPersistedSessionToken,
  clearPersistedVisitorId,
  getOrCreateSessionId,
  getStorageAdapter,
  persistSessionId,
  persistSessionToken,
  persistVisitorId,
} from "./storageService";
import type { SessionServiceContract } from "./contracts";
import {
  scheduleRefresh,
  setupAppStateListener,
  startHeartbeat,
  stopHeartbeat,
  stopRefreshTimer,
} from "./lifecycleService";
import { opencomSDKState } from "./state";

const REACT_NATIVE_SDK_VERSION = "0.1.0";

function getDeviceInfo(): DeviceInfo {
  return {
    os: Platform.OS,
    platform: Platform.OS as "ios" | "android",
    deviceType: "mobile",
  };
}

export async function initializeSession(config: SDKConfig): Promise<void> {
  if (opencomSDKState.isSDKInitialized) {
    console.warn("[OpencomSDK] SDK already initialized");
    return;
  }

  const storage = getStorageAdapter();
  setStorageAdapter({
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => storage.setItem(key, value),
    removeItem: (key) => storage.removeItem(key),
  });

  initializeClient(config);

  const sessionId = await getOrCreateSessionId();
  setSessionId(sessionId);

  const device = getDeviceInfo();
  const bootResult = await bootSessionApi({
    sessionId,
    device,
    clientType: "mobile_sdk",
    clientVersion: REACT_NATIVE_SDK_VERSION,
    clientIdentifier: "@opencom/react-native-sdk",
  });

  const visitorId = bootResult.visitor._id as VisitorId;
  setVisitorId(visitorId);
  setSessionToken(bootResult.sessionToken);
  setSessionExpiresAt(bootResult.expiresAt);
  await persistVisitorId(visitorId);
  await persistSessionToken(bootResult.sessionToken, bootResult.expiresAt);
  emitEvent("visitor_created", { visitorId });

  scheduleRefresh(bootResult.expiresAt);
  startHeartbeat(visitorId);

  if (!opencomSDKState.sessionStartTracked) {
    opencomSDKState.sessionStartTracked = true;
    trackAutoEventApi({
      visitorId,
      sessionToken: bootResult.sessionToken,
      eventType: "session_start",
      sessionId,
      properties: {
        platform: Platform.OS,
      },
    }).catch(console.error);
  }

  setupAppStateListener(visitorId, sessionId);
  opencomSDKState.isSDKInitialized = true;

  if (config.debug) {
    console.log("[OpencomSDK] Initialized successfully");
  }
}

export async function identifyUser(user: UserIdentification): Promise<void> {
  if (!opencomSDKState.isSDKInitialized) {
    console.warn("[OpencomSDK] SDK not initialized. Call initialize() first.");
    return;
  }

  const state = getVisitorState();
  if (!state.visitorId) {
    console.warn("[OpencomSDK] No visitor ID available");
    return;
  }

  setUser(user);

  await identifyVisitorApi({
    visitorId: state.visitorId,
    sessionToken: state.sessionToken ?? undefined,
    user,
    device: getDeviceInfo(),
  });

  emitEvent("visitor_identified", { user });
}

export async function logoutSession(): Promise<void> {
  if (!opencomSDKState.isSDKInitialized) {
    return;
  }

  stopHeartbeat();
  stopRefreshTimer();
  clearUser();

  const state = getVisitorState();
  if (state.sessionToken) {
    revokeSessionApi({ sessionToken: state.sessionToken }).catch(console.error);
  }
  clearSessionToken();

  await clearPersistedSessionId();
  await clearPersistedVisitorId();
  await clearPersistedSessionToken();

  const newSessionId = generateSessionId();
  await persistSessionId(newSessionId);
  setSessionId(newSessionId);

  const device = getDeviceInfo();
  const bootResult = await bootSessionApi({
    sessionId: newSessionId,
    device,
    clientType: "mobile_sdk",
    clientVersion: REACT_NATIVE_SDK_VERSION,
    clientIdentifier: "@opencom/react-native-sdk",
  });

  const visitorId = bootResult.visitor._id as VisitorId;
  setVisitorId(visitorId);
  setSessionToken(bootResult.sessionToken);
  setSessionExpiresAt(bootResult.expiresAt);
  await persistVisitorId(visitorId);
  await persistSessionToken(bootResult.sessionToken, bootResult.expiresAt);
  scheduleRefresh(bootResult.expiresAt);
  startHeartbeat(visitorId);
}

export const sessionService: SessionServiceContract = {
  initializeSession,
  identifyUser,
  logoutSession,
};
