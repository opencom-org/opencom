import { Platform } from "react-native";
import type { Id } from "@opencom/convex/dataModel";
import { api } from "@opencom/convex";
import { emitEvent, getClient, getConfig, getVisitorState } from "@opencom/sdk-core";

let expoPushToken: string | null = null;
let registeredBackendToken: string | null = null;

interface PushNotificationConfig {
  onNotificationReceived?: (notification: PushNotification) => void;
  onNotificationPressed?: (notification: PushNotification) => void;
}

interface PushNotification {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

function timingSafeTokenEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    const leftCode = index < left.length ? left.charCodeAt(index) : 0;
    const rightCode = index < right.length ? right.charCodeAt(index) : 0;
    mismatch |= leftCode ^ rightCode;
  }

  return mismatch === 0;
}

let notificationConfig: PushNotificationConfig = {};

export function configurePushNotifications(config: PushNotificationConfig): void {
  notificationConfig = config;
}

type PushRegistrationContext = {
  visitorId: Id<"visitors">;
  sessionToken: string;
  workspaceId: Id<"workspaces">;
};

function getPushRegistrationContext(
  action: "register" | "unregister"
): PushRegistrationContext | null {
  const state = getVisitorState();
  let workspaceId: string | undefined;
  try {
    workspaceId = getConfig().workspaceId;
  } catch {
    workspaceId = undefined;
  }

  if (!state.visitorId || !state.sessionToken || !workspaceId) {
    console.warn(`[OpencomSDK] Cannot ${action} push token - missing visitor session context`);
    return null;
  }

  return {
    visitorId: state.visitorId as Id<"visitors">,
    sessionToken: state.sessionToken,
    workspaceId: workspaceId as Id<"workspaces">,
  };
}

async function registerPushToken(token: string): Promise<boolean> {
  const context = getPushRegistrationContext("register");
  if (!context) {
    return false;
  }

  const platform = Platform.OS === "ios" ? "ios" : "android";
  await getClient().mutation(api.visitorPushTokens.register, {
    visitorId: context.visitorId,
    token,
    platform,
    sessionToken: context.sessionToken,
    workspaceId: context.workspaceId,
  });
  registeredBackendToken = token;
  return true;
}

async function unregisterPushToken(token: string): Promise<boolean> {
  const context = getPushRegistrationContext("unregister");
  if (!context) {
    return false;
  }

  await getClient().mutation(api.visitorPushTokens.unregister, {
    token,
    visitorId: context.visitorId,
    sessionToken: context.sessionToken,
    workspaceId: context.workspaceId,
  });

  if (registeredBackendToken !== null && timingSafeTokenEqual(registeredBackendToken, token)) {
    registeredBackendToken = null;
  }
  return true;
}

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Dynamic import to avoid requiring expo-notifications if not used
    const Notifications = await import("expo-notifications");
    const Device = await import("expo-device");

    if (!Device.isDevice) {
      console.warn("[OpencomSDK] Push notifications require a physical device");
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      if (registeredBackendToken) {
        await unregisterPushToken(registeredBackendToken);
      }
      expoPushToken = null;
      console.warn("[OpencomSDK] Push notification permission not granted");
      return null;
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const nextToken = tokenData.data;

    if (registeredBackendToken && !timingSafeTokenEqual(registeredBackendToken, nextToken)) {
      await unregisterPushToken(registeredBackendToken);
    }

    const registered = await registerPushToken(nextToken);
    expoPushToken = nextToken;
    if (!registered) {
      return null;
    }

    emitEvent("push_token_registered", { token: nextToken });
    return nextToken;
  } catch (error) {
    console.error("[OpencomSDK] Failed to register for push notifications:", error);
    return null;
  }
}

export async function unregisterPushNotifications(): Promise<boolean> {
  try {
    if (!registeredBackendToken) {
      expoPushToken = null;
      return true;
    }

    const unregistered = await unregisterPushToken(registeredBackendToken);
    if (!unregistered) {
      return false;
    }

    expoPushToken = null;
    return true;
  } catch (error) {
    console.error("[OpencomSDK] Failed to unregister push notifications:", error);
    return false;
  }
}

export function getPushToken(): string | null {
  return expoPushToken;
}

export async function setupNotificationListeners(): Promise<() => void> {
  try {
    const Notifications = await import("expo-notifications");

    // Handle notifications received while app is foregrounded
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const data: PushNotification = {
        title: notification.request.content.title ?? undefined,
        body: notification.request.content.body ?? undefined,
        data: notification.request.content.data as Record<string, unknown>,
      };
      notificationConfig.onNotificationReceived?.(data);
    });

    // Handle notification press
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const notification = response.notification;
        const data: PushNotification = {
          title: notification.request.content.title ?? undefined,
          body: notification.request.content.body ?? undefined,
          data: notification.request.content.data as Record<string, unknown>,
        };
        notificationConfig.onNotificationPressed?.(data);

        // Handle deep linking from notification with conversation context
        const notificationData = notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        if (notificationData?.conversationId) {
          // Emit event for the app to handle navigation to specific conversation
          emitEvent("message_received", {
            conversationId: notificationData.conversationId,
            fromPush: true,
          });
          // Emit messenger_opened event for app to handle navigation
          emitEvent("messenger_opened", { conversationId: notificationData.conversationId });
        } else if (notificationData?.ticketId) {
          // Handle ticket notification - emit event for app to handle
          emitEvent("ticket_opened", { ticketId: notificationData.ticketId });
        } else if (notificationData?.articleId) {
          // Handle article notification - emit event for app to handle
          emitEvent("help_center_opened", { articleId: notificationData.articleId });
        } else if (notificationData?.type === "outbound_message" && notificationData?.messageId) {
          // Handle outbound message notification
          emitEvent("outbound_message_shown", {
            messageId: notificationData.messageId,
            fromPush: true,
          });
        }
      }
    );

    // Return cleanup function
    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  } catch (error) {
    console.error("[OpencomSDK] Failed to setup notification listeners:", error);
    return () => {};
  }
}

/**
 * Update the app badge count with unread message count.
 * This should be called when the app receives background fetch updates.
 */
export async function updateBadgeCount(count: number): Promise<void> {
  try {
    const Notifications = await import("expo-notifications");
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error("[OpencomSDK] Failed to update badge count:", error);
  }
}

/**
 * Clear the app badge count.
 */
export async function clearBadgeCount(): Promise<void> {
  await updateBadgeCount(0);
}

/**
 * Fetch unread count and update badge.
 * Call this in background fetch handler.
 * Note: Returns the number of conversations as a proxy for unread count.
 * For accurate unread counts, integrate with your backend's unread tracking.
 */
export async function refreshUnreadBadge(): Promise<number> {
  try {
    const state = getVisitorState();
    if (!state.visitorId) {
      return 0;
    }

    // Note: This function requires the caller to pass in the count
    // since we can't import OpencomSDK here due to circular dependency.
    // Use updateBadgeCount(count) directly with your own count logic.
    console.warn(
      "[OpencomSDK] refreshUnreadBadge requires manual count - use updateBadgeCount(count) instead"
    );
    return 0;
  } catch (error) {
    console.error("[OpencomSDK] Failed to refresh unread badge:", error);
    return 0;
  }
}

export function usePushNotifications() {
  const register = async () => {
    return await registerForPushNotifications();
  };

  const unregister = async () => {
    return await unregisterPushNotifications();
  };

  return {
    register,
    unregister,
    token: expoPushToken,
  };
}
