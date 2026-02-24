declare module "expo-notifications" {
  export interface Notification {
    request: {
      identifier: string;
      content: NotificationContent;
      trigger: NotificationTrigger;
    };
    date: number;
  }

  export interface NotificationContent {
    title: string | null;
    subtitle: string | null;
    body: string | null;
    data: Record<string, unknown>;
    sound: string | null;
    badge: number | null;
  }

  export interface NotificationTrigger {
    type: string;
  }

  export interface NotificationResponse {
    notification: Notification;
    actionIdentifier: string;
    userText?: string;
  }

  export interface Subscription {
    remove: () => void;
  }

  export interface NotificationHandler {
    handleNotification: (notification: Notification) => Promise<{
      shouldShowAlert: boolean;
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
      shouldShowBanner?: boolean;
      shouldShowList?: boolean;
    }>;
  }

  export enum AndroidImportance {
    MIN = 1,
    LOW = 2,
    DEFAULT = 3,
    HIGH = 4,
    MAX = 5,
  }

  export function setNotificationHandler(handler: NotificationHandler): void;
  export function getPermissionsAsync(): Promise<{ status: string }>;
  export function requestPermissionsAsync(): Promise<{ status: string }>;
  export function getExpoPushTokenAsync(options?: {
    projectId?: string;
  }): Promise<{ data: string }>;
  export function setNotificationChannelAsync(
    channelId: string,
    channel: {
      name: string;
      importance?: AndroidImportance;
      vibrationPattern?: number[];
      lightColor?: string;
      sound?: string;
      enableVibrate?: boolean;
      enableLights?: boolean;
      lockscreenVisibility?: number;
      bypassDnd?: boolean;
    }
  ): Promise<unknown>;
  export function addNotificationReceivedListener(
    listener: (notification: Notification) => void
  ): Subscription;
  export function addNotificationResponseReceivedListener(
    listener: (response: NotificationResponse) => void
  ): Subscription;
}
