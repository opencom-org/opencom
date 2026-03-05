import type { MainTab } from "../hooks/useWidgetTabVisibility";
import type { TicketFormData, WidgetTabHeader } from "./types";

export function normalizeTicketFormData(formData: Record<string, unknown>): TicketFormData {
  const normalized: TicketFormData = {};
  for (const [key, value] of Object.entries(formData)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      normalized[key] = value;
      continue;
    }

    if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
      normalized[key] = value;
      continue;
    }

    normalized[key] = null;
  }
  return normalized;
}

export function resolveWidgetActiveTab(
  activeTab: MainTab,
  fallbackTab: MainTab,
  isTabVisible: (tab: MainTab) => boolean
): MainTab {
  return isTabVisible(activeTab) ? activeTab : fallbackTab;
}

export function getWidgetTabHeader(activeTab: MainTab): WidgetTabHeader {
  switch (activeTab) {
    case "home":
      return { title: "Home", showNew: false };
    case "messages":
      return { title: "Conversations", showNew: true };
    case "help":
      return { title: "Help Center", showNew: false };
    case "tours":
      return { title: "Product Tours", showNew: false };
    case "tasks":
      return { title: "Tasks", showNew: false };
    case "tickets":
      return { title: "My Tickets", showNew: false };
    default:
      return { title: "Home", showNew: false };
  }
}
