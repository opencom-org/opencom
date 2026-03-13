import { useState, useCallback, useRef } from "react";
import type { Id } from "@opencom/convex/dataModel";
import { sdkActionRef, useSdkAction } from "../internal/convex";
import { useSdkTransportContext } from "../internal/opencomContext";

const SEARCH_ARTICLE_SUGGESTIONS_REF = sdkActionRef("suggestions:searchForWidget");

export interface ArticleSuggestion {
  id: string;
  title: string;
  snippet: string;
  score: number;
}

export function useArticleSuggestions() {
  const [suggestions, setSuggestions] = useState<ArticleSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { workspaceId, visitorId, sessionToken } = useSdkTransportContext();
  const searchAction = useSdkAction<
    Record<string, unknown>,
    ArticleSuggestion[]
  >(SEARCH_ARTICLE_SUGGESTIONS_REF);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    async (query: string, debounceMs: number = 300): Promise<void> => {
      if (!workspaceId || !visitorId || !sessionToken) return;

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // If query is too short, clear suggestions
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }

      // Debounce the search
      debounceTimerRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const results = await searchAction({
            workspaceId: workspaceId as Id<"workspaces">,
            visitorId,
            sessionToken,
            query,
            limit: 3,
          });
          setSuggestions(results);
        } catch (error) {
          console.error("[useArticleSuggestions] Search failed:", error);
          setSuggestions([]);
        } finally {
          setIsSearching(false);
        }
      }, debounceMs);
    },
    [searchAction, sessionToken, visitorId, workspaceId]
  );

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  return {
    suggestions,
    isSearching,
    search,
    clearSuggestions,
  };
}
