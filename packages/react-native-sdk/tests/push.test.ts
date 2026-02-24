import { beforeEach, describe, expect, it, vi } from "vitest";

const mutationMock = vi.fn();
const getVisitorStateMock = vi.fn();
const getConfigMock = vi.fn();
const emitEventMock = vi.fn();

const getPermissionsAsyncMock = vi.fn();
const requestPermissionsAsyncMock = vi.fn();
const getExpoPushTokenAsyncMock = vi.fn();
const receivedSubscriptionRemoveMock = vi.fn();
const responseSubscriptionRemoveMock = vi.fn();
let receivedNotificationListener: ((notification: any) => void) | null = null;
let responseNotificationListener: ((response: any) => void) | null = null;
const addNotificationReceivedListenerMock = vi.fn((listener: (notification: any) => void) => {
  receivedNotificationListener = listener;
  return { remove: receivedSubscriptionRemoveMock };
});
const addNotificationResponseReceivedListenerMock = vi.fn((listener: (response: any) => void) => {
  responseNotificationListener = listener;
  return { remove: responseSubscriptionRemoveMock };
});
const setBadgeCountAsyncMock = vi.fn();

vi.mock("@opencom/convex", () => ({
  api: {
    visitorPushTokens: {
      register: "visitorPushTokens.register",
      unregister: "visitorPushTokens.unregister",
    },
  },
}));

vi.mock("@opencom/sdk-core", () => ({
  emitEvent: emitEventMock,
  getClient: vi.fn(() => ({ mutation: mutationMock })),
  getConfig: getConfigMock,
  getVisitorState: getVisitorStateMock,
}));

vi.mock("expo-device", () => ({
  isDevice: true,
}));

vi.mock("expo-notifications", () => ({
  getPermissionsAsync: getPermissionsAsyncMock,
  requestPermissionsAsync: requestPermissionsAsyncMock,
  getExpoPushTokenAsync: getExpoPushTokenAsyncMock,
  addNotificationReceivedListener: addNotificationReceivedListenerMock,
  addNotificationResponseReceivedListener: addNotificationResponseReceivedListenerMock,
  setBadgeCountAsync: setBadgeCountAsyncMock,
}));

describe("push registration lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    getVisitorStateMock.mockReturnValue({
      visitorId: "visitor_123",
      sessionToken: "wst_test",
    });
    getConfigMock.mockReturnValue({
      workspaceId: "workspace_123",
    });

    getPermissionsAsyncMock.mockResolvedValue({ status: "granted" });
    requestPermissionsAsyncMock.mockResolvedValue({ status: "granted" });
    getExpoPushTokenAsyncMock.mockResolvedValue({
      data: "ExponentPushToken[first-token]",
    });
    receivedNotificationListener = null;
    responseNotificationListener = null;
  });

  it("registers visitor push token through the backend mutation", async () => {
    const { registerForPushNotifications } = await import("../src/push");

    const token = await registerForPushNotifications();

    expect(token).toBe("ExponentPushToken[first-token]");
    expect(mutationMock).toHaveBeenCalledWith("visitorPushTokens.register", {
      visitorId: "visitor_123",
      token: "ExponentPushToken[first-token]",
      platform: "ios",
      sessionToken: "wst_test",
      workspaceId: "workspace_123",
    });
    expect(emitEventMock).toHaveBeenCalledWith("push_token_registered", {
      token: "ExponentPushToken[first-token]",
    });
  });

  it("returns null and skips backend persistence when session context is missing", async () => {
    getVisitorStateMock.mockReturnValue({
      visitorId: "visitor_123",
      sessionToken: null,
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { registerForPushNotifications } = await import("../src/push");

    const token = await registerForPushNotifications();

    expect(token).toBeNull();
    expect(mutationMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "[OpencomSDK] Cannot register push token - missing visitor session context"
    );
    warnSpy.mockRestore();
  });

  it("unregisters the old token before re-registering when the token changes", async () => {
    getExpoPushTokenAsyncMock
      .mockResolvedValueOnce({ data: "ExponentPushToken[first-token]" })
      .mockResolvedValueOnce({ data: "ExponentPushToken[second-token]" });

    const { registerForPushNotifications } = await import("../src/push");
    await registerForPushNotifications();
    await registerForPushNotifications();

    expect(mutationMock.mock.calls).toEqual([
      [
        "visitorPushTokens.register",
        {
          visitorId: "visitor_123",
          token: "ExponentPushToken[first-token]",
          platform: "ios",
          sessionToken: "wst_test",
          workspaceId: "workspace_123",
        },
      ],
      [
        "visitorPushTokens.unregister",
        {
          token: "ExponentPushToken[first-token]",
          visitorId: "visitor_123",
          sessionToken: "wst_test",
          workspaceId: "workspace_123",
        },
      ],
      [
        "visitorPushTokens.register",
        {
          visitorId: "visitor_123",
          token: "ExponentPushToken[second-token]",
          platform: "ios",
          sessionToken: "wst_test",
          workspaceId: "workspace_123",
        },
      ],
    ]);
  });

  it("supports explicit unregister flow", async () => {
    const { registerForPushNotifications, unregisterPushNotifications, getPushToken } =
      await import("../src/push");
    await registerForPushNotifications();

    const result = await unregisterPushNotifications();

    expect(result).toBe(true);
    expect(getPushToken()).toBeNull();
    expect(mutationMock).toHaveBeenLastCalledWith("visitorPushTokens.unregister", {
      token: "ExponentPushToken[first-token]",
      visitorId: "visitor_123",
      sessionToken: "wst_test",
      workspaceId: "workspace_123",
    });
  });

  it("hook registration delegates to the same shared registration path", async () => {
    const { usePushNotifications } = await import("../src/push");
    const { register } = usePushNotifications();

    const token = await register();

    expect(token).toBe("ExponentPushToken[first-token]");
    expect(mutationMock).toHaveBeenCalledWith("visitorPushTokens.register", {
      visitorId: "visitor_123",
      token: "ExponentPushToken[first-token]",
      platform: "ios",
      sessionToken: "wst_test",
      workspaceId: "workspace_123",
    });
  });
});

describe("push listeners and badge helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    receivedNotificationListener = null;
    responseNotificationListener = null;
  });

  it("forwards foreground notifications and cleans up listener subscriptions", async () => {
    const { configurePushNotifications, setupNotificationListeners } = await import("../src/push");
    const onNotificationReceived = vi.fn();
    const onNotificationPressed = vi.fn();
    configurePushNotifications({
      onNotificationReceived,
      onNotificationPressed,
    });

    const cleanup = await setupNotificationListeners();

    expect(addNotificationReceivedListenerMock).toHaveBeenCalledTimes(1);
    expect(addNotificationResponseReceivedListenerMock).toHaveBeenCalledTimes(1);
    expect(receivedNotificationListener).not.toBeNull();

    receivedNotificationListener?.({
      request: {
        content: {
          title: "New message",
          body: "Hello from support",
          data: { conversationId: "conversation_1" },
        },
      },
    });

    expect(onNotificationReceived).toHaveBeenCalledWith({
      title: "New message",
      body: "Hello from support",
      data: { conversationId: "conversation_1" },
    });

    cleanup();
    expect(receivedSubscriptionRemoveMock).toHaveBeenCalledTimes(1);
    expect(responseSubscriptionRemoveMock).toHaveBeenCalledTimes(1);
  });

  it("emits deep-link events for supported notification payload contexts", async () => {
    const { configurePushNotifications, setupNotificationListeners } = await import("../src/push");
    const onNotificationPressed = vi.fn();
    configurePushNotifications({ onNotificationPressed });
    await setupNotificationListeners();

    responseNotificationListener?.({
      notification: {
        request: {
          content: {
            title: "Conversation",
            body: "New reply",
            data: { conversationId: "conversation_7" },
          },
        },
      },
    });

    expect(onNotificationPressed).toHaveBeenCalledWith({
      title: "Conversation",
      body: "New reply",
      data: { conversationId: "conversation_7" },
    });
    expect(emitEventMock).toHaveBeenCalledWith("message_received", {
      conversationId: "conversation_7",
      fromPush: true,
    });
    expect(emitEventMock).toHaveBeenCalledWith("messenger_opened", {
      conversationId: "conversation_7",
    });

    responseNotificationListener?.({
      notification: {
        request: {
          content: {
            title: "Ticket update",
            body: "Ticket changed",
            data: { ticketId: "ticket_9" },
          },
        },
      },
    });
    expect(emitEventMock).toHaveBeenCalledWith("ticket_opened", { ticketId: "ticket_9" });

    responseNotificationListener?.({
      notification: {
        request: {
          content: {
            title: "Help article",
            body: "New article",
            data: { articleId: "article_4" },
          },
        },
      },
    });
    expect(emitEventMock).toHaveBeenCalledWith("help_center_opened", { articleId: "article_4" });

    responseNotificationListener?.({
      notification: {
        request: {
          content: {
            title: "Outbound",
            body: "Campaign",
            data: { type: "outbound_message", messageId: "outbound_2" },
          },
        },
      },
    });
    expect(emitEventMock).toHaveBeenCalledWith("outbound_message_shown", {
      messageId: "outbound_2",
      fromPush: true,
    });
  });

  it("updates and clears app badge counts through Expo notifications", async () => {
    const { updateBadgeCount, clearBadgeCount } = await import("../src/push");

    await updateBadgeCount(5);
    expect(setBadgeCountAsyncMock).toHaveBeenCalledWith(5);

    await clearBadgeCount();
    expect(setBadgeCountAsyncMock).toHaveBeenLastCalledWith(0);
  });
});
