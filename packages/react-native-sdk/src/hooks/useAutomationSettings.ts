import { useQuery } from "convex/react";
import { api } from "@opencom/convex";
import { useOpencomContext } from "../components/OpencomProvider";
import type { Id } from "@opencom/convex/dataModel";

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

export function useAutomationSettings() {
  const { workspaceId } = useOpencomContext();

  const settings = useQuery(
    api.automationSettings.get,
    workspaceId ? { workspaceId: workspaceId as Id<"workspaces"> } : "skip"
  );

  return settings ?? DEFAULT_SETTINGS;
}
