export type HomeCardType =
  | "welcome"
  | "search"
  | "conversations"
  | "startConversation"
  | "featuredArticles"
  | "announcements";

export type HomeTabId = "home" | "messages" | "help" | "tours" | "tasks" | "tickets";
export type HomeVisibility = "all" | "visitors" | "users";
export type HomeDefaultSpace = "home" | "messages" | "help";

export type HomeCardConfigPrimitive = string | number | boolean | null;
export type HomeCardConfigObject = Record<string, HomeCardConfigPrimitive>;
export type HomeCardConfigValue =
  | HomeCardConfigPrimitive
  | HomeCardConfigPrimitive[]
  | HomeCardConfigObject;
export type HomeCardConfig = Record<string, HomeCardConfigValue>;

export interface HomeCard {
  id: string;
  type: HomeCardType;
  config?: HomeCardConfig;
  visibleTo: HomeVisibility;
}

export interface HomeTab {
  id: HomeTabId;
  enabled: boolean;
  visibleTo: HomeVisibility;
}

export interface HomeConfig {
  enabled: boolean;
  cards: HomeCard[];
  defaultSpace: HomeDefaultSpace;
  launchDirectlyToConversation?: boolean;
  tabs?: HomeTab[];
}

export interface NormalizedHomeConfig extends Omit<HomeConfig, "launchDirectlyToConversation" | "tabs"> {
  launchDirectlyToConversation: boolean;
  tabs: HomeTab[];
}

const HOME_TAB_ORDER: HomeTabId[] = ["home", "messages", "help", "tours", "tasks", "tickets"];

export const DEFAULT_HOME_TABS: ReadonlyArray<HomeTab> = [
  { id: "home", enabled: true, visibleTo: "all" },
  { id: "messages", enabled: true, visibleTo: "all" },
  { id: "help", enabled: true, visibleTo: "all" },
  { id: "tours", enabled: true, visibleTo: "all" },
  { id: "tasks", enabled: true, visibleTo: "all" },
  { id: "tickets", enabled: true, visibleTo: "all" },
];

const DEFAULT_HOME_TABS_BY_ID = new Map<HomeTabId, HomeTab>(
  DEFAULT_HOME_TABS.map((tab) => [tab.id, tab])
);

interface NormalizeHomeTabsOptions {
  includeOnlyConfiguredIds?: boolean;
}

export function getDefaultHomeTabs(): HomeTab[] {
  return DEFAULT_HOME_TABS.map((tab) => ({ ...tab }));
}

export function normalizeHomeTabs(
  tabs: HomeTab[] | undefined,
  options: NormalizeHomeTabsOptions = {}
): HomeTab[] {
  const { includeOnlyConfiguredIds = false } = options;
  if (!tabs) {
    return getDefaultHomeTabs();
  }

  const tabsById = new Map<HomeTabId, HomeTab>(tabs.map((tab) => [tab.id, tab]));
  const orderedIds = includeOnlyConfiguredIds
    ? HOME_TAB_ORDER.filter((tabId) => tabsById.has(tabId))
    : [...HOME_TAB_ORDER];

  if (!orderedIds.includes("messages")) {
    orderedIds.unshift("messages");
  }

  return orderedIds.map((tabId) => {
    const defaultTab = DEFAULT_HOME_TABS_BY_ID.get(tabId);
    if (!defaultTab) {
      return {
        id: tabId,
        enabled: true,
        visibleTo: "all" as const,
      };
    }

    if (tabId === "messages") {
      return { ...defaultTab };
    }

    const configuredTab = tabsById.get(tabId);
    if (!configuredTab) {
      return { ...defaultTab };
    }

    return {
      id: tabId,
      enabled: configuredTab.enabled,
      visibleTo: configuredTab.visibleTo,
    };
  });
}

export function isVisibleToAudience(visibleTo: HomeVisibility, isUser: boolean): boolean {
  if (visibleTo === "all") {
    return true;
  }
  if (visibleTo === "users") {
    return isUser;
  }
  return !isUser;
}

export function resolveDefaultHomeSpace(
  defaultSpace: HomeDefaultSpace,
  visibleTabs: HomeTab[],
  homeEnabled: boolean
): HomeDefaultSpace {
  const visibleTabIds = new Set(visibleTabs.map((tab) => tab.id));
  if (defaultSpace === "home" && homeEnabled && visibleTabIds.has("home")) {
    return "home";
  }
  if (defaultSpace === "help" && visibleTabIds.has("help")) {
    return "help";
  }
  if (visibleTabIds.has("messages")) {
    return "messages";
  }
  if (homeEnabled && visibleTabIds.has("home")) {
    return "home";
  }
  return "help";
}

export function normalizeHomeConfig(
  homeConfig: HomeConfig | undefined,
  fallbackConfig: HomeConfig
): NormalizedHomeConfig {
  const source = homeConfig ?? fallbackConfig;
  return {
    ...source,
    launchDirectlyToConversation: source.launchDirectlyToConversation ?? false,
    tabs: normalizeHomeTabs(source.tabs),
  };
}
