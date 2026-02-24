export interface StorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

let storageAdapter: StorageAdapter | null = null;

export function setStorageAdapter(adapter: StorageAdapter): void {
  storageAdapter = adapter;
}

export function getStorageAdapter(): StorageAdapter {
  if (!storageAdapter) {
    if (typeof localStorage !== "undefined") {
      return localStorage;
    }
    throw new Error("[OpencomSDK] No storage adapter available. Call setStorageAdapter() first.");
  }
  return storageAdapter;
}

const STORAGE_PREFIX = "opencom_";

export async function getStoredValue(key: string): Promise<string | null> {
  const adapter = getStorageAdapter();
  const result = adapter.getItem(`${STORAGE_PREFIX}${key}`);
  return result instanceof Promise ? await result : result;
}

export async function setStoredValue(key: string, value: string): Promise<void> {
  const adapter = getStorageAdapter();
  const result = adapter.setItem(`${STORAGE_PREFIX}${key}`, value);
  if (result instanceof Promise) {
    await result;
  }
}

export async function removeStoredValue(key: string): Promise<void> {
  const adapter = getStorageAdapter();
  const result = adapter.removeItem(`${STORAGE_PREFIX}${key}`);
  if (result instanceof Promise) {
    await result;
  }
}

export async function getStoredSessionId(): Promise<string | null> {
  return getStoredValue("session_id");
}

export async function setStoredSessionId(sessionId: string): Promise<void> {
  return setStoredValue("session_id", sessionId);
}

export async function getStoredVisitorId(): Promise<string | null> {
  return getStoredValue("visitor_id");
}

export async function setStoredVisitorId(visitorId: string): Promise<void> {
  return setStoredValue("visitor_id", visitorId);
}
