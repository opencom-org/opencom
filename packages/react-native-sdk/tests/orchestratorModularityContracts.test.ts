import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { opencomSDKState, resetOpencomSDKState } from "../src/opencomSdk/state";

describe("orchestrator modularity contracts", () => {
  it("resets shared orchestrator state deterministically", () => {
    opencomSDKState.isSDKInitialized = true;
    opencomSDKState.sessionStartTracked = true;
    opencomSDKState.heartbeatInterval = {} as ReturnType<typeof setInterval>;
    opencomSDKState.refreshTimer = {} as ReturnType<typeof setTimeout>;
    opencomSDKState.appStateSubscription = { remove: () => undefined };
    opencomSDKState.surveyTriggerListeners.add(() => undefined);

    resetOpencomSDKState();

    expect(opencomSDKState.isSDKInitialized).toBe(false);
    expect(opencomSDKState.sessionStartTracked).toBe(false);
    expect(opencomSDKState.heartbeatInterval).toBeNull();
    expect(opencomSDKState.refreshTimer).toBeNull();
    expect(opencomSDKState.appStateSubscription).toBeNull();
    expect(opencomSDKState.surveyTriggerListeners.size).toBe(0);
  });

  it("keeps OpencomSDK facade free of monolith-owned helpers and globals", () => {
    const opencomSource = readFileSync(new URL("../src/OpencomSDK.ts", import.meta.url), "utf8");

    expect(opencomSource).toContain('from "./opencomSdk/sessionService"');
    expect(opencomSource).toContain('from "./opencomSdk/storageService"');
    expect(opencomSource).toContain('from "./opencomSdk/lifecycleService"');
    expect(opencomSource).toContain('from "./opencomSdk/pushService"');

    const legacyMonolithTokens = [
      "let isSDKInitialized",
      "let heartbeatInterval",
      "let refreshTimer",
      "let appStateSubscription",
      "let sessionStartTracked",
      "function getOrCreateSessionId(",
      "function persistSessionToken(",
      "function scheduleRefresh(",
      "function startHeartbeat(",
      "function setupAppStateListener(",
    ];

    for (const token of legacyMonolithTokens) {
      expect(opencomSource).not.toContain(token);
    }
  });

  it("defines explicit internal service contracts", () => {
    const contractsSource = readFileSync(new URL("../src/opencomSdk/contracts.ts", import.meta.url), "utf8");
    const lifecycleSource = readFileSync(
      new URL("../src/opencomSdk/lifecycleService.ts", import.meta.url),
      "utf8"
    );
    const pushSource = readFileSync(new URL("../src/opencomSdk/pushService.ts", import.meta.url), "utf8");
    const sessionSource = readFileSync(
      new URL("../src/opencomSdk/sessionService.ts", import.meta.url),
      "utf8"
    );
    const storageSource = readFileSync(
      new URL("../src/opencomSdk/storageService.ts", import.meta.url),
      "utf8"
    );

    expect(contractsSource).toContain("export interface SessionServiceContract");
    expect(contractsSource).toContain("export interface StorageServiceContract");
    expect(contractsSource).toContain("export interface PushServiceContract");
    expect(contractsSource).toContain("export interface LifecycleServiceContract");

    expect(sessionSource).toContain("export const sessionService: SessionServiceContract");
    expect(storageSource).toContain("export const storageService: StorageServiceContract");
    expect(pushSource).toContain("export const pushService: PushServiceContract");
    expect(lifecycleSource).toContain("export const lifecycleService: LifecycleServiceContract");
  });
});
