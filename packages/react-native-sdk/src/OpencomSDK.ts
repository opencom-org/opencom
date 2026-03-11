import {
  isInitialized,
  resetClient,
  trackEvent as trackEventApi,
  trackAutoEvent as trackAutoEventApi,
  resetVisitorState,
  getVisitorState,
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
  type SDKEventListener,
  type ConversationId,
} from "@opencom/sdk-core";
import {
  registerForPush as registerForPushService,
  unregisterFromPush as unregisterFromPushService,
} from "./opencomSdk/pushService";
import { initializeSession, identifyUser, logoutSession } from "./opencomSdk/sessionService";
import { cleanupAppStateListener, stopHeartbeat, stopRefreshTimer } from "./opencomSdk/lifecycleService";
import {
  clearPersistedSessionId,
  clearPersistedSessionToken,
  clearPersistedVisitorId,
} from "./opencomSdk/storageService";
import { opencomSDKState, resetOpencomSDKState } from "./opencomSdk/state";

function emitSurveyTriggerEvent(eventName: string): void {
  for (const listener of opencomSDKState.surveyTriggerListeners) {
    try {
      listener(eventName);
    } catch (error) {
      console.error("[OpencomSDK] Survey trigger listener error:", error);
    }
  }
}

function warnIfNotInitialized(): boolean {
  if (!opencomSDKState.isSDKInitialized) {
    console.warn("[OpencomSDK] SDK not initialized. Call initialize() first.");
    return true;
  }
  return false;
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
    await initializeSession(config);
  },

  /**
   * Track a screen view event.
   * Call this when a screen becomes visible.
   */
  async trackScreenView(screenName: string, properties?: EventProperties): Promise<void> {
    if (warnIfNotInitialized()) {
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
    await identifyUser(user);
  },

  /**
   * Track a custom event.
   */
  async trackEvent(name: string, properties?: EventProperties): Promise<void> {
    if (warnIfNotInitialized()) {
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
    opencomSDKState.surveyTriggerListeners.add(listener);
    return () => {
      opencomSDKState.surveyTriggerListeners.delete(listener);
    };
  },

  /**
   * Log out the current user and reset the session.
   */
  async logout(): Promise<void> {
    await logoutSession();
  },

  /**
   * Check if the SDK is initialized.
   */
  isInitialized(): boolean {
    return opencomSDKState.isSDKInitialized && isInitialized();
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
    resetVisitorState();
    resetClient();
    await clearPersistedSessionId();
    await clearPersistedVisitorId();
    await clearPersistedSessionToken();
    resetOpencomSDKState();
  },

  /**
   * Register for push notifications.
   * Returns the push token if successful, null otherwise.
   */
  async registerForPush(): Promise<string | null> {
    return registerForPushService();
  },

  /**
   * Unregister the current device from push notifications for this visitor session.
   */
  async unregisterFromPush(): Promise<boolean> {
    return unregisterFromPushService();
  },

  /**
   * Present the messenger UI.
   * This is a placeholder that emits an event for the app to handle.
   * In practice, the app should use the OpencomMessenger component.
   */
  present(): void {
    if (warnIfNotInitialized()) {
      return;
    }
    emitEvent("messenger_opened", {});
  },

  /**
   * Present a carousel by ID.
   */
  presentCarousel(carouselId: string): void {
    if (warnIfNotInitialized()) {
      return;
    }
    emitEvent("carousel_opened", { carouselId });
  },

  /**
   * Present the help center.
   */
  presentHelpCenter(): void {
    if (warnIfNotInitialized()) {
      return;
    }
    emitEvent("help_center_opened", {});
  },

  /**
   * Get or create a conversation for the current visitor.
   * Returns an existing open conversation if one exists, otherwise creates a new one.
   */
  async getOrCreateConversation(): Promise<{ _id: ConversationId } | null> {
    if (warnIfNotInitialized()) {
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
    if (warnIfNotInitialized()) {
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
    if (warnIfNotInitialized()) {
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
    if (warnIfNotInitialized()) {
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
    if (warnIfNotInitialized()) {
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
    if (warnIfNotInitialized()) {
      return null;
    }

    try {
      const parsed = parseDeepLink(url);
      if (!parsed) {
        console.warn("[OpencomSDK] Invalid deep link URL:", url);
        return null;
      }

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
    if (warnIfNotInitialized()) {
      return;
    }
    emitEvent("tickets_opened", {});
  },

  /**
   * Present a specific ticket.
   */
  presentTicket(ticketId: string): void {
    if (warnIfNotInitialized()) {
      return;
    }
    emitEvent("ticket_opened", { ticketId });
  },

  /**
   * Present a specific article.
   */
  presentArticle(articleId: string): void {
    if (warnIfNotInitialized()) {
      return;
    }
    emitEvent("help_center_opened", { articleId });
  },

  /**
   * Present a specific conversation.
   */
  presentConversation(conversationId: string): void {
    if (warnIfNotInitialized()) {
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
