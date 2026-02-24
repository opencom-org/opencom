import { useState, useCallback, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "@opencom/convex";
import { getVisitorState } from "@opencom/sdk-core";
import { useOpencomContext } from "../components/OpencomProvider";
import type { Id } from "@opencom/convex/dataModel";

export interface ArticleSuggestion {
  id: string;
  title: string;
  snippet: string;
  score: number;
}

export function useArticleSuggestions() {
  const { workspaceId } = useOpencomContext();
  const [suggestions, setSuggestions] = useState<ArticleSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchAction = useAction(api.suggestions.searchForWidget);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    async (query: string, debounceMs: number = 300): Promise<void> => {
      const { visitorId, sessionToken } = getVisitorState();
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
            visitorId: visitorId as Id<"visitors">,
            sessionToken,
            query,
            limit: 3,
          });
          setSuggestions(results as ArticleSuggestion[]);
        } catch (error) {
          console.error("[useArticleSuggestions] Search failed:", error);
          setSuggestions([]);
        } finally {
          setIsSearching(false);
        }
      }, debounceMs);
    },
    [workspaceId, searchAction]
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
