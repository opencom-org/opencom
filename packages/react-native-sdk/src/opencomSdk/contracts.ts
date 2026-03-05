import type { SDKConfig, UserIdentification, VisitorId } from "@opencom/sdk-core";
import type { OpencomStorageAdapter } from "./storageService";

export interface SessionServiceContract {
  initializeSession(config: SDKConfig): Promise<void>;
  identifyUser(user: UserIdentification): Promise<void>;
  logoutSession(): Promise<void>;
}

export interface StorageServiceContract {
  getStorageAdapter(): OpencomStorageAdapter;
  getOrCreateSessionId(): Promise<string>;
  persistSessionId(sessionId: string): Promise<void>;
  clearPersistedSessionId(): Promise<void>;
  persistVisitorId(visitorId: string): Promise<void>;
  clearPersistedVisitorId(): Promise<void>;
  persistSessionToken(token: string, expiresAt: number): Promise<void>;
  clearPersistedSessionToken(): Promise<void>;
}

export interface PushServiceContract {
  registerForPush(): Promise<string | null>;
  unregisterFromPush(): Promise<boolean>;
}

export interface LifecycleServiceContract {
  scheduleRefresh(expiresAt: number): void;
  stopRefreshTimer(): void;
  startHeartbeat(visitorId: VisitorId): void;
  stopHeartbeat(): void;
  setupAppStateListener(visitorId: VisitorId, sessionId: string): void;
  cleanupAppStateListener(): void;
}
