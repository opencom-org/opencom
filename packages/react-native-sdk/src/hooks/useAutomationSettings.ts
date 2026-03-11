import { sdkQueryRef, useSdkQuery } from "../internal/convex";
import { useSdkResolvedWorkspaceId } from "../internal/opencomContext";

export interface AutomationSettings {
  suggestArticlesEnabled: boolean;
  showReplyTimeEnabled: boolean;
  collectEmailEnabled: boolean;
  askForRatingEnabled: boolean;
}

const DEFAULT_SETTINGS: AutomationSettings = {
  suggestArticlesEnabled: false,
  showReplyTimeEnabled: false,
  collectEmailEnabled: true, // Default to true for better UX
  askForRatingEnabled: false,
};

const AUTOMATION_SETTINGS_REF = sdkQueryRef("automationSettings:get");

export function useAutomationSettings() {
  const workspaceId = useSdkResolvedWorkspaceId();

  const settings = useSdkQuery<AutomationSettings>(
    AUTOMATION_SETTINGS_REF,
    workspaceId ? { workspaceId } : "skip"
  );

  return settings ?? DEFAULT_SETTINGS;
}
