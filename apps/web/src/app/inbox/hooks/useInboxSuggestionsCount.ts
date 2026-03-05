import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Id } from "@opencom/convex/dataModel";

export interface UseInboxSuggestionsCountArgs {
  selectedConversationId: Id<"conversations"> | null;
  isSidecarEnabled: boolean;
  messageCountSignal: number;
  getSuggestionsForConversation: (args: {
    conversationId: Id<"conversations">;
    limit: number;
  }) => Promise<unknown[]>;
}

export interface UseInboxSuggestionsCountResult {
  suggestionsCount: number;
  isSuggestionsCountLoading: boolean;
  setSuggestionsCount: Dispatch<SetStateAction<number>>;
}

export function useInboxSuggestionsCount({
  selectedConversationId,
  isSidecarEnabled,
  messageCountSignal,
  getSuggestionsForConversation,
}: UseInboxSuggestionsCountArgs): UseInboxSuggestionsCountResult {
  const [suggestionsCount, setSuggestionsCount] = useState(0);
  const [isSuggestionsCountLoading, setIsSuggestionsCountLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchSuggestionsCount = async () => {
      if (!selectedConversationId || !isSidecarEnabled) {
        setSuggestionsCount(0);
        setIsSuggestionsCountLoading(false);
        return;
      }

      setIsSuggestionsCountLoading(true);
      try {
        const results = await getSuggestionsForConversation({
          conversationId: selectedConversationId,
          limit: 5,
        });
        if (!cancelled) {
          setSuggestionsCount(results.length);
        }
      } catch (error) {
        console.error("Failed to fetch suggestions count:", error);
        if (!cancelled) {
          setSuggestionsCount(0);
        }
      } finally {
        if (!cancelled) {
          setIsSuggestionsCountLoading(false);
        }
      }
    };

    void fetchSuggestionsCount();

    return () => {
      cancelled = true;
    };
  }, [getSuggestionsForConversation, isSidecarEnabled, messageCountSignal, selectedConversationId]);

  return {
    suggestionsCount,
    isSuggestionsCountLoading,
    setSuggestionsCount,
  };
}
