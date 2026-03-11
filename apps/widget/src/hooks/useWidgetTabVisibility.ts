import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import { normalizeHomeTabs, type HomeConfig, type HomeTab, type HomeTabId } from "@opencom/types";

export type MainTab = HomeTabId;
export type TabConfig = HomeTab;
type HomeConfigInput = Partial<Pick<HomeConfig, "enabled" | "defaultSpace" | "tabs">>;

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
    const configuredTabs = normalizeHomeTabs(homeConfig?.tabs, {
      includeOnlyConfiguredIds: true,
    });
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
