import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { useAuth } from "./AuthContext";
import { router, usePathname } from "expo-router";
import {
  getActiveConversationIdFromPath,
  getConversationIdFromPayload,
  getNotificationNavigationTarget,
  shouldSuppressForegroundNotification,
} from "../utils/notificationRouting";

interface NotificationContextType {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  registrationStatus:
    | "idle"
    | "starting"
    | "permission_denied"
    | "no_project_id"
    | "token_received"
    | "registered"
    | "error";
  lastError: string | null;
}

const NotificationContext = createContext<NotificationContextType>({
  expoPushToken: null,
  notification: null,
  registrationStatus: "idle",
  lastError: null,
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [registrationStatus, setRegistrationStatus] =
    useState<NotificationContextType["registrationStatus"]>("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.Subscription>(null);
  const responseListener = useRef<Notifications.Subscription>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const pathname = usePathname();

  const { user, isAuthenticated } = useAuth();
  const registerToken = useMutation(api.pushTokens.register);
  const debugLog = useMutation(api.pushTokens.debugLog);

  useEffect(() => {
    activeConversationIdRef.current = getActiveConversationIdFromPath(pathname);
  }, [pathname]);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async (incomingNotification) => {
        const payload = incomingNotification.request.content.data as
          | Record<string, unknown>
          | undefined;
        const shouldSuppress = shouldSuppressForegroundNotification({
          payload,
          activeConversationId: activeConversationIdRef.current,
        });

        return {
          shouldShowAlert: !shouldSuppress,
          shouldPlaySound: !shouldSuppress,
          shouldSetBadge: true,
          shouldShowBanner: !shouldSuppress,
          shouldShowList: !shouldSuppress,
        };
      },
    });
  }, []);

  const sendDebugLog = async (stage: string, details?: string) => {
    try {
      await debugLog({ stage, details });
    } catch (error) {
      console.warn("Failed to write push registration debug log", error);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const authenticatedUserId = user._id;

    async function registerForPushNotifications() {
      setRegistrationStatus("starting");
      setLastError(null);
      await sendDebugLog("start", `user=${authenticatedUserId}; platform=${Platform.OS}`);

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#792cd4",
        });
        await sendDebugLog("android_channel_set");
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("Push notification permission not granted");
        setRegistrationStatus("permission_denied");
        await sendDebugLog("permission_denied", `existing=${existingStatus}; final=${finalStatus}`);
        return;
      }

      try {
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId ??
          process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

        if (!projectId) {
          console.warn("Skipping push token registration: no Expo projectId configured");
          setRegistrationStatus("no_project_id");
          await sendDebugLog(
            "missing_project_id",
            `expo=${Constants.expoConfig ? "1" : "0"}; eas=${Constants.easConfig ? "1" : "0"}`
          );
          return;
        }
        await sendDebugLog("project_id_resolved", projectId);

        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData.data;
        setExpoPushToken(token);
        setRegistrationStatus("token_received");
        await sendDebugLog("token_received", token.slice(0, 30));

        await registerToken({
          token,
          userId: authenticatedUserId,
          platform: Platform.OS as "ios" | "android",
        });
        console.log("Push token registered for user", authenticatedUserId);
        setRegistrationStatus("registered");
        await sendDebugLog(
          "registered",
          `user=${authenticatedUserId}; tokenPrefix=${token.slice(0, 20)}`
        );
      } catch (error) {
        console.error("Failed to register push notifications:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        setRegistrationStatus("error");
        setLastError(errorMessage);
        await sendDebugLog("error", errorMessage);
      }
    }

    registerForPushNotifications();

    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification: Notifications.Notification) => {
        const data = notification.request.content.data as Record<string, unknown> | undefined;
        const conversationId = getConversationIdFromPayload(data);
        if (
          conversationId &&
          activeConversationIdRef.current &&
          activeConversationIdRef.current === conversationId
        ) {
          return;
        }
        setNotification(notification);
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response: Notifications.NotificationResponse) => {
        const data = response.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        const target = getNotificationNavigationTarget(data);
        if (target) {
          router.push(target);
        }
      }
    );

    return () => {
      if (notificationListener.current?.remove) {
        notificationListener.current.remove();
      }
      if (responseListener.current?.remove) {
        responseListener.current.remove();
      }
    };
  }, [isAuthenticated, user, registerToken]);

  return (
    <NotificationContext.Provider
      value={{ expoPushToken, notification, registrationStatus, lastError }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
