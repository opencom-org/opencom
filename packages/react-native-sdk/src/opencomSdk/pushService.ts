import { registerForPushNotifications, unregisterPushNotifications } from "../push";
import { opencomSDKState } from "./state";
import type { PushServiceContract } from "./contracts";

function warnIfNotInitialized(): boolean {
  if (!opencomSDKState.isSDKInitialized) {
    console.warn("[OpencomSDK] SDK not initialized. Call initialize() first.");
    return true;
  }
  return false;
}

export async function registerForPush(): Promise<string | null> {
  if (warnIfNotInitialized()) {
    return null;
  }
  return registerForPushNotifications();
}

export async function unregisterFromPush(): Promise<boolean> {
  if (warnIfNotInitialized()) {
    return false;
  }
  return unregisterPushNotifications();
}

export const pushService: PushServiceContract = {
  registerForPush,
  unregisterFromPush,
};
