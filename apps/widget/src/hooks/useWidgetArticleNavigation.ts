import { useCallback, useEffect, useRef, useState } from "react";
import type { Id } from "@opencom/convex/dataModel";
import type { MainTab } from "./useWidgetTabVisibility";
import type { WidgetView } from "../widgetShell/types";

interface UseWidgetArticleNavigationOptions {
  view: WidgetView;
  onViewChange: (view: WidgetView) => void;
  onTabChange: (tab: MainTab) => void;
}

export function useWidgetArticleNavigation({
  view,
  onViewChange,
  onTabChange,
}: UseWidgetArticleNavigationOptions) {
  const [articleSearchQuery, setArticleSearchQuery] = useState("");
  const [selectedArticleId, setSelectedArticleId] = useState<Id<"articles"> | null>(null);
  const [selectedHelpCollectionKey, setSelectedHelpCollectionKey] = useState<string | null>(null);
  const [isArticleLargeMode, setIsArticleLargeMode] = useState(false);
  const [isCollapsingLargeArticle, setIsCollapsingLargeArticle] = useState(false);
  const largeArticleCollapseTimeoutRef = useRef<number | null>(null);

  const isLargeArticleView =
    view === "article-detail" && (isArticleLargeMode || isCollapsingLargeArticle);

  const clearLargeArticleCollapseTimeout = useCallback(() => {
    if (largeArticleCollapseTimeoutRef.current !== null) {
      window.clearTimeout(largeArticleCollapseTimeoutRef.current);
      largeArticleCollapseTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearLargeArticleCollapseTimeout();
    };
  }, [clearLargeArticleCollapseTimeout]);

  const clearArticlePresentation = useCallback(() => {
    clearLargeArticleCollapseTimeout();
    setIsArticleLargeMode(false);
    setIsCollapsingLargeArticle(false);
  }, [clearLargeArticleCollapseTimeout]);

  const openArticleDetail = useCallback(
    (articleId: Id<"articles">) => {
      clearArticlePresentation();
      setSelectedArticleId(articleId);
      onViewChange("article-detail");
    },
    [clearArticlePresentation, onViewChange]
  );

  const navigateBackFromArticle = useCallback(() => {
    clearArticlePresentation();
    setSelectedArticleId(null);
    onTabChange("help");
    onViewChange("conversation-list");
  }, [clearArticlePresentation, onTabChange, onViewChange]);

  const collapseLargeArticle = useCallback(
    (onCollapsed?: () => void) => {
      if (isCollapsingLargeArticle) {
        return;
      }
      if (!isArticleLargeMode) {
        onCollapsed?.();
        return;
      }

      setIsCollapsingLargeArticle(true);
      clearLargeArticleCollapseTimeout();
      largeArticleCollapseTimeoutRef.current = window.setTimeout(() => {
        largeArticleCollapseTimeoutRef.current = null;
        setIsArticleLargeMode(false);
        setIsCollapsingLargeArticle(false);
        onCollapsed?.();
      }, 280);
    },
    [clearLargeArticleCollapseTimeout, isArticleLargeMode, isCollapsingLargeArticle]
  );

  const handleBackFromArticle = useCallback(() => {
    collapseLargeArticle(navigateBackFromArticle);
  }, [collapseLargeArticle, navigateBackFromArticle]);

  const handleToggleArticleLargeScreen = useCallback(() => {
    if (isCollapsingLargeArticle) {
      return;
    }

    if (isArticleLargeMode) {
      collapseLargeArticle();
      return;
    }

    clearLargeArticleCollapseTimeout();
    setIsCollapsingLargeArticle(false);
    setIsArticleLargeMode(true);
  }, [
    clearLargeArticleCollapseTimeout,
    collapseLargeArticle,
    isArticleLargeMode,
    isCollapsingLargeArticle,
  ]);

  return {
    articleSearchQuery,
    setArticleSearchQuery,
    selectedArticleId,
    clearSelectedArticle: useCallback(() => {
      setSelectedArticleId(null);
    }, []),
    selectedHelpCollectionKey,
    setSelectedHelpCollectionKey,
    isCollapsingLargeArticle,
    isLargeArticleView,
    clearArticlePresentation,
    openArticleDetail,
    handleBackFromArticle,
    handleToggleArticleLargeScreen,
  };
}
