export interface OpencomSDKOrchestratorState {
  isSDKInitialized: boolean;
  heartbeatInterval: ReturnType<typeof setInterval> | null;
  refreshTimer: ReturnType<typeof setTimeout> | null;
  appStateSubscription: { remove: () => void } | null;
  sessionStartTracked: boolean;
  surveyTriggerListeners: Set<(eventName: string) => void>;
}

export const opencomSDKState: OpencomSDKOrchestratorState = {
  isSDKInitialized: false,
  heartbeatInterval: null,
  refreshTimer: null,
  appStateSubscription: null,
  sessionStartTracked: false,
  surveyTriggerListeners: new Set<(eventName: string) => void>(),
};

export function resetOpencomSDKState(): void {
  opencomSDKState.isSDKInitialized = false;
  opencomSDKState.heartbeatInterval = null;
  opencomSDKState.refreshTimer = null;
  opencomSDKState.appStateSubscription = null;
  opencomSDKState.sessionStartTracked = false;
  opencomSDKState.surveyTriggerListeners.clear();
}
