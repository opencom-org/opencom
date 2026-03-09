import { useQuery } from "convex/react";
import { useOpencomContext } from "../components/OpencomProvider";
import type { Id } from "@opencom/convex/dataModel";
import { makeFunctionReference, type FunctionReference } from "convex/server";

function getQueryRef(name: string): FunctionReference<"query"> {
  return makeFunctionReference(name) as FunctionReference<"query">;
}

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
    getQueryRef("automationSettings:get"),
    workspaceId ? { workspaceId: workspaceId as Id<"workspaces"> } : "skip"
  );

  return settings ?? DEFAULT_SETTINGS;
}
