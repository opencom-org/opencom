import { Platform } from "react-native";
import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { registerForPushNotifications, unregisterPushNotifications } from "./push";
import {
  initializeClient,
  isInitialized,
  resetClient,
  bootSession as bootSessionApi,
  refreshSession as refreshSessionApi,
  revokeSession as revokeSessionApi,
  identifyVisitor as identifyVisitorApi,
  trackEvent as trackEventApi,
  trackAutoEvent as trackAutoEventApi,
  heartbeat,
  setStorageAdapter,
  setVisitorId,
  setSessionId,
  setSessionToken,
  setSessionExpiresAt,
  clearSessionToken,
  setUser,
  clearUser,
  resetVisitorState,
  getVisitorState,
  generateSessionId,
  emitEvent,
  addEventListener,
  getOrCreateConversation as getOrCreateConversationApi,
  createConversation as createConversationApi,
  getMessages as getMessagesApi,
  getConversations as getConversationsApi,
  sendMessage as sendMessageApi,
  type SDKConfig,
  type UserIdentification,
  type EventProperties,
  type DeviceInfo,
  type VisitorId,
  type SDKEventListener,
  type ConversationId,
} from "@opencom/sdk-core";

// Storage adapter using AsyncStorage
const storageAdapter = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

function getStorage() {
  return storageAdapter;
}

let isSDKInitialized = false;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let sessionStartTracked = false;
const surveyTriggerListeners = new Set<(eventName: string) => void>();

const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
const REFRESH_MARGIN_MS = 60000; // refresh 60s before expiry
const SESSION_TOKEN_KEY = "opencom_session_token";
const SESSION_EXPIRES_AT_KEY = "opencom_session_expires_at";
const REACT_NATIVE_SDK_VERSION = "0.1.0";

function emitSurveyTriggerEvent(eventName: string): void {
  for (const listener of surveyTriggerListeners) {
    try {
      listener(eventName);
    } catch (error) {
      console.error("[OpencomSDK] Survey trigger listener error:", error);
    }
  }
}

function getDeviceInfo(): DeviceInfo {
  return {
    os: Platform.OS,
    platform: Platform.OS as "ios" | "android",
    deviceType: "mobile",
  };
}

async function getOrCreateSessionId(): Promise<string> {
  const storage = await getStorage();
  const storedSessionId = await storage.getItem("opencom_session_id");
  if (storedSessionId) {
    return storedSessionId;
  }
  const newSessionId = generateSessionId();
  await storage.setItem("opencom_session_id", newSessionId);
  return newSessionId;
}

async function persistVisitorId(visitorId: string): Promise<void> {
  const storage = await getStorage();
  await storage.setItem("opencom_visitor_id", visitorId);
}

async function clearPersistedVisitorId(): Promise<void> {
  const storage = await getStorage();
  await storage.removeItem("opencom_visitor_id");
}

async function persistSessionToken(token: string, expiresAt: number): Promise<void> {
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
  await SecureStore.setItemAsync(SESSION_EXPIRES_AT_KEY, String(expiresAt));
}

async function clearPersistedSessionToken(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  await SecureStore.deleteItemAsync(SESSION_EXPIRES_AT_KEY);
}

function scheduleRefresh(expiresAt: number): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  const delay = Math.max(0, expiresAt - Date.now() - REFRESH_MARGIN_MS);
  refreshTimer = setTimeout(async () => {
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

function stopRefreshTimer(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

export const OpencomSDK = {
  /**
   * Initialize the SDK with workspace configuration.
   * This should be called once when your app starts.
   */
  async initialize(config: SDKConfig): Promise<void> {
    if (!config.workspaceId?.trim()) {
      throw new Error("[OpencomSDK] workspaceId is required.");
    }
    if (!config.convexUrl?.trim()) {
      throw new Error("[OpencomSDK] convexUrl is required.");
    }

    if (isSDKInitialized) {
      console.warn("[OpencomSDK] SDK already initialized");
      return;
    }

    // Set up storage adapter for sdk-core
    const storage = await getStorage();
    setStorageAdapter({
      getItem: (key) => storage.getItem(key),
      setItem: (key, value) => storage.setItem(key, value),
      removeItem: (key) => storage.removeItem(key),
    });

    // Initialize Convex client
    initializeClient(config);

    // Get or create session
    const sessionId = await getOrCreateSessionId();
    setSessionId(sessionId);

    // Boot a signed session
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

    // Schedule token refresh
    scheduleRefresh(bootResult.expiresAt);

    // Start heartbeat
    startHeartbeat(visitorId);

    // Track session start
    if (!sessionStartTracked) {
      sessionStartTracked = true;
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

    // Set up app state listener for session tracking
    setupAppStateListener(visitorId, sessionId);

    isSDKInitialized = true;

    if (config.debug) {
      console.log("[OpencomSDK] Initialized successfully");
    }
  },

  /**
   * Track a screen view event.
   * Call this when a screen becomes visible.
   */
  async trackScreenView(screenName: string, properties?: EventProperties): Promise<void> {
    if (!isSDKInitialized) {
      console.warn("[OpencomSDK] SDK not initialized. Call initialize() first.");
      return;
    }

    const state = getVisitorState();
    if (!state.visitorId) {
      console.warn("[OpencomSDK] No visitor ID available");
      return;
    }

    await trackAutoEventApi({
      visitorId: state.visitorId,
      sessionToken: state.sessionToken ?? undefined,
      eventType: "screen_view",
      sessionId: state.sessionId,
      properties: {
        screenName,
        ...properties,
      },
    });
    emitSurveyTriggerEvent("screen_view");
  },

  /**
   * Identify the current user with their attributes.
   * Call this when a user logs in or when you have user information.
   */
  async identify(user: UserIdentification): Promise<void> {
    if (!isSDKInitialized) {
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
  },

  /**
   * Track a custom event.
   */
  async trackEvent(name: string, properties?: EventProperties): Promise<void> {
    if (!isSDKInitialized) {
      console.warn("[OpencomSDK] SDK not initialized. Call initialize() first.");
      return;
    }

    const state = getVisitorState();
    if (!state.visitorId) {
      console.warn("[OpencomSDK] No visitor ID available");
      return;
    }

    await trackEventApi({
      visitorId: state.visitorId,
      sessionToken: state.sessionToken ?? undefined,
      name,
      properties,
      sessionId: state.sessionId,
    });
    emitSurveyTriggerEvent(name);
  },

  /**
   * Subscribe to survey trigger events emitted by runtime event tracking.
   */
  addSurveyTriggerListener(listener: (eventName: string) => void): () => void {
    surveyTriggerListeners.add(listener);
    return () => {
      surveyTriggerListeners.delete(listener);
    };
  },

  /**
   * Log out the current user and reset the session.
   */
  async logout(): Promise<void> {
    if (!isSDKInitialized) {
      return;
    }

    stopHeartbeat();
    stopRefreshTimer();
    clearUser();

    // Revoke current session
    const state = getVisitorState();
    if (state.sessionToken) {
      revokeSessionApi({ sessionToken: state.sessionToken }).catch(console.error);
    }
    clearSessionToken();

    // Clear stored session and visitor ID
    const storage = await getStorage();
    await storage.removeItem("opencom_session_id");
    await clearPersistedVisitorId();
    await clearPersistedSessionToken();

    // Generate new session
    const newSessionId = generateSessionId();
    await storage.setItem("opencom_session_id", newSessionId);
    setSessionId(newSessionId);

    // Boot a new signed session
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
  },

  /**
   * Check if the SDK is initialized.
   */
  isInitialized(): boolean {
    return isSDKInitialized && isInitialized();
  },

  /**
   * Get the current visitor state.
   */
  getVisitorState() {
    return getVisitorState();
  },

  /**
   * Add an event listener for SDK events.
   */
  addEventListener(listener: SDKEventListener): () => void {
    return addEventListener(listener);
  },

  /**
   * Reset the SDK (for testing or logout scenarios).
   */
  async reset(): Promise<void> {
    stopHeartbeat();
    stopRefreshTimer();
    cleanupAppStateListener();
    surveyTriggerListeners.clear();
    resetVisitorState();
    resetClient();
    const storage = await getStorage();
    await storage.removeItem("opencom_session_id");
    await clearPersistedVisitorId();
    await clearPersistedSessionToken();
    isSDKInitialized = false;
    sessionStartTracked = false;
  },

  /**
   * Register for push notifications.
   * Returns the push token if successful, null otherwise.
   */
  async registerForPush(): Promise<string | null> {
    if (!isSDKInitialized) {
      console.warn("[OpencomSDK] SDK not initialized. Call initialize() first.");
      return null;
    }
    return registerForPushNotifications();
  },

  /**
   * Unregister the current device from push notifications for this visitor session.
   */
  async unregisterFromPush(): Promise<boolean> {
    if (!isSDKInitialized) {
      console.warn("[OpencomSDK] SDK not initialized. Call initialize() first.");
      return false;
    }
    return unregisterPushNotifications();
  },

  /**
   * Present the messenger UI.
   * This is a placeholder that emits an event for the app to handle.
   * In practice, the app should use the OpencomMessenger component.
   */
  present(): void {
    if (!isSDKInitialized) {
      console.warn("[OpencomSDK] SDK not initialized. Call initialize() first.");
      return;
    }
    emitEvent("messenger_opened", {});
  },

  /**
   * Present a carousel by ID.
   */
  presentCarousel(carouselId: string): void {
    if (!isSDKInitialized) {
      console.warn("[OpencomSDK] SDK not initialized. Call initialize() first.");
      return;
    }
    emitEvent("carousel_opened", { carouselId });
  },

  /**
   * Present the help center.
   */
  presentHelpCenter(): void {
    if (!isSDKInitialized) {
      console.warn("[OpencomSDK] SDK not initialized. Call initialize() first.");
      return;
    }
    emitEvent("help_center_opened", {});
  },

  /**
   * Get or create a conversation for the current visitor.
   * Returns an existing open conversation if one exists, otherwise creates a new one.
   */
  async getOrCreateConversation(): Promise<{ _id: ConversationId } | null> {
    if (!isSDKInitialized) {
      console.warn("[OpencomSDK] SDK not initialized. Call initialize() first.");
      return null;
    }
    const state = getVisitorState();
    if (!state.visitorId) {
      console.warn("[OpencomSDK] No visitor ID available");
      return null;
    }
    return getOrCreateConversationApi(state.visitorId, state.sessionToken ?? undefined);
  },

  /**
   * Create a new conversation for the current visitor.
   * Always creates a new conversation, even if open conversations exist.
   */
  async createConversation(): Promise<{ _id: ConversationId } | null> {
    if (!isSDKInitialized) {
      console.warn("[OpencomSDK] SDK not initialized. Call initialize() first.");
      return null;
    }
    const state = getVisitorState();
    if (!state.visitorId) {
      console.warn("[OpencomSDK] No visitor ID available");
      return null;
    }
    return createConversationApi(state.visitorId, state.sessionToken ?? undefined);
  },

  /**
   * Get messages for a conversation.
   */
  async getMessages(conversationId: ConversationId) {
    if (!isSDKInitialized) {
      console.warn("[OpencomSDK] SDK not initialized. Call initialize() first.");
      return [];
    }
    const state = getVisitorState();
    return getMessagesApi(
      conversationId,
      state.visitorId ?? undefined,
      state.sessionToken ?? undefined
    );
  },

  /**
   * Get all conversations for the current visitor.
   */
  async getConversations() {
    if (!isSDKInitialized) {
      console.warn("[OpencomSDK] SDK not initialized. Call initialize() first.");
      return [];
    }
    const state = getVisitorState();
    if (!state.visitorId) {
      console.warn("[OpencomSDK] No visitor ID available");
      return [];
    }
    return getConversationsApi(state.visitorId, state.sessionToken ?? undefined);
  },

  /**
   * Send a message in a conversation.
   */
  async sendMessage(conversationId: ConversationId, content: string): Promise<void> {
    if (!isSDKInitialized) {
      console.warn("[OpencomSDK] SDK not initialized. Call initialize() first.");
      return;
    }
    const state = getVisitorState();
    if (!state.visitorId) {
      console.warn("[OpencomSDK] No visitor ID available");
      return;
    }
    await sendMessageApi({
      conversationId,
      visitorId: state.visitorId,
      sessionToken: state.sessionToken ?? undefined,
      content,
    });
  },

  /**
   * Handle a deep link URL.
   * Supported URL schemes:
   * - opencom://conversation/{id} - Open a specific conversation
   * - opencom://article/{id} - Open a specific article
   * - opencom://tickets - Open the tickets list
   * - opencom://ticket/{id} - Open a specific ticket
   * - opencom://messenger - Open the messenger
   * - opencom://help-center - Open the help center
   *
   * Returns the parsed deep link data or null if invalid.
   */
  handleDeepLink(url: string): DeepLinkResult | null {
    if (!isSDKInitialized) {
      console.warn("[OpencomSDK] SDK not initialized. Call initialize() first.");
      return null;
    }

    try {
      // Parse the URL
      const parsed = parseDeepLink(url);
      if (!parsed) {
        console.warn("[OpencomSDK] Invalid deep link URL:", url);
        return null;
      }

      // Emit appropriate event based on deep link type
      switch (parsed.type) {
        case "conversation":
          emitEvent("messenger_opened", { conversationId: parsed.id });
          break;
        case "article":
          emitEvent("help_center_opened", { articleId: parsed.id });
          break;
        case "tickets":
          emitEvent("tickets_opened", {});
          break;
        case "ticket":
          emitEvent("ticket_opened", { ticketId: parsed.id });
          break;
        case "messenger":
          emitEvent("messenger_opened", {});
          break;
        case "help-center":
          emitEvent("help_center_opened", {});
          break;
      }

      return parsed;
    } catch (error) {
      console.error("[OpencomSDK] Error handling deep link:", error);
      return null;
    }
  },

  /**
   * Present the tickets view.
   */
  presentTickets(): void {
    if (!isSDKInitialized) {
      console.warn("[OpencomSDK] SDK not initialized. Call initialize() first.");
      return;
    }
    emitEvent("tickets_opened", {});
  },

  /**
   * Present a specific ticket.
   */
  presentTicket(ticketId: string): void {
    if (!isSDKInitialized) {
      console.warn("[OpencomSDK] SDK not initialized. Call initialize() first.");
      return;
    }
    emitEvent("ticket_opened", { ticketId });
  },

  /**
   * Present a specific article.
   */
  presentArticle(articleId: string): void {
    if (!isSDKInitialized) {
      console.warn("[OpencomSDK] SDK not initialized. Call initialize() first.");
      return;
    }
    emitEvent("help_center_opened", { articleId });
  },

  /**
   * Present a specific conversation.
   */
  presentConversation(conversationId: string): void {
    if (!isSDKInitialized) {
      console.warn("[OpencomSDK] SDK not initialized. Call initialize() first.");
      return;
    }
    emitEvent("messenger_opened", { conversationId });
  },
};

export type DeepLinkType =
  | "conversation"
  | "article"
  | "tickets"
  | "ticket"
  | "messenger"
  | "help-center";

export interface DeepLinkResult {
  type: DeepLinkType;
  id?: string;
  url: string;
}

function parseDeepLink(url: string): DeepLinkResult | null {
  // Support both opencom:// and https://opencom.app/ schemes
  const opencomScheme = /^opencom:\/\/(.+)$/;
  const httpsScheme = /^https:\/\/opencom\.app\/(.+)$/;

  let path: string | null = null;

  const opencomMatch = url.match(opencomScheme);
  if (opencomMatch) {
    path = opencomMatch[1];
  }

  const httpsMatch = url.match(httpsScheme);
  if (httpsMatch) {
    path = httpsMatch[1];
  }

  if (!path) {
    return null;
  }

  // Remove query params and hash
  const cleanPath = path.split("?")[0].split("#")[0];
  const segments = cleanPath.split("/").filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  const type = segments[0];
  const id = segments[1];

  switch (type) {
    case "conversation":
      if (!id) return null;
      return { type: "conversation", id, url };
    case "article":
      if (!id) return null;
      return { type: "article", id, url };
    case "tickets":
      return { type: "tickets", url };
    case "ticket":
      if (!id) return null;
      return { type: "ticket", id, url };
    case "messenger":
      return { type: "messenger", url };
    case "help-center":
    case "helpcenter":
      return { type: "help-center", url };
    default:
      return null;
  }
}

function startHeartbeat(visitorId: VisitorId): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  // Send initial heartbeat
  const state = getVisitorState();
  heartbeat(visitorId, state.sessionToken ?? undefined).catch(console.error);

  // Set up interval
  heartbeatInterval = setInterval(() => {
    const s = getVisitorState();
    heartbeat(visitorId, s.sessionToken ?? undefined).catch(console.error);
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

function setupAppStateListener(visitorId: VisitorId, sessionId: string): void {
  // Remove existing subscription if any
  if (appStateSubscription) {
    appStateSubscription.remove();
  }

  let lastAppState: AppStateStatus = AppState.currentState;

  appStateSubscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
    // App coming to foreground from background
    if (lastAppState.match(/inactive|background/) && nextAppState === "active") {
      // Track session start when app becomes active
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
      // Track session end when app goes to background
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
  });
}

function cleanupAppStateListener(): void {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
}
