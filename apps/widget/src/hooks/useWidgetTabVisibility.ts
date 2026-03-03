import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from "react";

export type MainTab = "home" | "messages" | "help" | "tours" | "tasks" | "tickets";
type TabVisibility = "all" | "visitors" | "users";

export type TabConfig = {
  id: MainTab;
  enabled: boolean;
  visibleTo: TabVisibility;
};

type HomeConfigInput = {
  enabled?: boolean;
  defaultSpace?: "home" | "messages" | "help";
  tabs?: TabConfig[];
};

const DEFAULT_TAB_CONFIG: TabConfig[] = [
  { id: "home", enabled: true, visibleTo: "all" },
  { id: "messages", enabled: true, visibleTo: "all" },
  { id: "help", enabled: true, visibleTo: "all" },
  { id: "tours", enabled: true, visibleTo: "all" },
  { id: "tasks", enabled: true, visibleTo: "all" },
  { id: "tickets", enabled: true, visibleTo: "all" },
];

function normalizeTabConfig(config: TabConfig[] | undefined): TabConfig[] {
  if (!config) {
    return DEFAULT_TAB_CONFIG.map((tab) => ({ ...tab }));
  }

  const tabsById = new globalThis.Map(config.map((tab) => [tab.id, tab]));
  const configuredIds = new Set(config.map((tab) => tab.id));
  const normalizedTabs = DEFAULT_TAB_CONFIG.filter((tab) => configuredIds.has(tab.id)).map(
    (defaultTab) => {
      if (defaultTab.id === "messages") {
        return { ...defaultTab };
      }

      const configuredTab = tabsById.get(defaultTab.id);
      if (!configuredTab) {
        return { ...defaultTab };
      }

      return {
        id: defaultTab.id,
        enabled: configuredTab.enabled,
        visibleTo: configuredTab.visibleTo,
      };
    }
  );

  if (!normalizedTabs.some((tab) => tab.id === "messages")) {
    normalizedTabs.unshift({ ...DEFAULT_TAB_CONFIG.find((tab) => tab.id === "messages")! });
  }

  return normalizedTabs;
}

interface UseWidgetTabVisibilityOptions {
  activeTab: MainTab;
  setActiveTab: Dispatch<SetStateAction<MainTab>>;
  homeConfig: HomeConfigInput | undefined;
}

export function useWidgetTabVisibility({
  activeTab,
  setActiveTab,
  homeConfig,
}: UseWidgetTabVisibilityOptions) {
  const visibleTabs = useMemo(() => {
    const configuredTabs = normalizeTabConfig(homeConfig?.tabs);
    return configuredTabs.filter((tab) => tab.enabled && (tab.id !== "home" || homeConfig?.enabled));
  }, [homeConfig]);

  const fallbackTab = visibleTabs[0]?.id ?? "messages";
  const isTabVisible = useCallback(
    (tab: MainTab) => visibleTabs.some((configuredTab) => configuredTab.id === tab),
    [visibleTabs]
  );

  useEffect(() => {
    if (!homeConfig || homeConfig.enabled) {
      return;
    }

    if (homeConfig.defaultSpace === "help" && isTabVisible("help")) {
      setActiveTab("help");
      return;
    }

    setActiveTab("messages");
  }, [homeConfig, isTabVisible, setActiveTab]);

  useEffect(() => {
    if (!isTabVisible(activeTab)) {
      setActiveTab(fallbackTab);
    }
  }, [activeTab, fallbackTab, isTabVisible, setActiveTab]);

  return {
    visibleTabs,
    fallbackTab,
    isTabVisible,
  };
}
