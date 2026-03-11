import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { generateSessionId } from "@opencom/sdk-core";
import type { StorageServiceContract } from "./contracts";

export const SESSION_ID_KEY = "opencom_session_id";
export const VISITOR_ID_KEY = "opencom_visitor_id";
export const SESSION_TOKEN_KEY = "opencom_session_token";
export const SESSION_EXPIRES_AT_KEY = "opencom_session_expires_at";

const storageAdapter = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export type OpencomStorageAdapter = typeof storageAdapter;

export function getStorageAdapter(): OpencomStorageAdapter {
  return storageAdapter;
}

export async function getOrCreateSessionId(): Promise<string> {
  const storedSessionId = await storageAdapter.getItem(SESSION_ID_KEY);
  if (storedSessionId) {
    return storedSessionId;
  }
  const newSessionId = generateSessionId();
  await storageAdapter.setItem(SESSION_ID_KEY, newSessionId);
  return newSessionId;
}

export async function persistSessionId(sessionId: string): Promise<void> {
  await storageAdapter.setItem(SESSION_ID_KEY, sessionId);
}

export async function clearPersistedSessionId(): Promise<void> {
  await storageAdapter.removeItem(SESSION_ID_KEY);
}

export async function persistVisitorId(visitorId: string): Promise<void> {
  await storageAdapter.setItem(VISITOR_ID_KEY, visitorId);
}

export async function clearPersistedVisitorId(): Promise<void> {
  await storageAdapter.removeItem(VISITOR_ID_KEY);
}

export async function persistSessionToken(token: string, expiresAt: number): Promise<void> {
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
  await SecureStore.setItemAsync(SESSION_EXPIRES_AT_KEY, String(expiresAt));
}

export async function clearPersistedSessionToken(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  await SecureStore.deleteItemAsync(SESSION_EXPIRES_AT_KEY);
}

export const storageService: StorageServiceContract = {
  getStorageAdapter,
  getOrCreateSessionId,
  persistSessionId,
  clearPersistedSessionId,
  persistVisitorId,
  clearPersistedVisitorId,
  persistSessionToken,
  clearPersistedSessionToken,
};
