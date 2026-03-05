import { useCallback, useEffect, useState } from "react";
import type { Id } from "@opencom/convex/dataModel";

export type InboxCompactPanel = "ai-review" | "suggestions";

export interface UseInboxCompactPanelsArgs {
  isCompactViewport: boolean;
  selectedConversationId: Id<"conversations"> | null;
  isSidecarEnabled: boolean;
  focusReplyInput: () => void;
}

export interface UseInboxCompactPanelsResult {
  activeCompactPanel: InboxCompactPanel | null;
  aiReviewPanelOpen: boolean;
  suggestionsPanelOpen: boolean;
  closeCompactPanel: () => void;
  toggleAuxiliaryPanel: (panel: InboxCompactPanel) => void;
  resetCompactPanel: () => void;
}

export function shouldResetCompactPanelForViewport(args: {
  isCompactViewport: boolean;
  selectedConversationId: Id<"conversations"> | null;
}): boolean {
  return !args.isCompactViewport || !args.selectedConversationId;
}

export function shouldResetSuggestionsPanelForSidecar(args: {
  activeCompactPanel: InboxCompactPanel | null;
  isSidecarEnabled: boolean;
}): boolean {
  return !args.isSidecarEnabled && args.activeCompactPanel === "suggestions";
}

export function useInboxCompactPanels({
  isCompactViewport,
  selectedConversationId,
  isSidecarEnabled,
  focusReplyInput,
}: UseInboxCompactPanelsArgs): UseInboxCompactPanelsResult {
  const [activeCompactPanel, setActiveCompactPanel] = useState<InboxCompactPanel | null>(null);

  useEffect(() => {
    if (
      shouldResetCompactPanelForViewport({
        isCompactViewport,
        selectedConversationId,
      })
    ) {
      setActiveCompactPanel(null);
    }
  }, [isCompactViewport, selectedConversationId]);

  useEffect(() => {
    if (
      shouldResetSuggestionsPanelForSidecar({
        activeCompactPanel,
        isSidecarEnabled,
      })
    ) {
      setActiveCompactPanel(null);
    }
  }, [activeCompactPanel, isSidecarEnabled]);

  const closeCompactPanel = useCallback(() => {
    setActiveCompactPanel(null);
    focusReplyInput();
  }, [focusReplyInput]);

  const toggleAuxiliaryPanel = useCallback((panel: InboxCompactPanel) => {
    setActiveCompactPanel((current) => (current === panel ? null : panel));
  }, []);

  const resetCompactPanel = useCallback(() => {
    setActiveCompactPanel(null);
  }, []);

  return {
    activeCompactPanel,
    aiReviewPanelOpen: Boolean(selectedConversationId) && activeCompactPanel === "ai-review",
    suggestionsPanelOpen:
      Boolean(selectedConversationId) &&
      isSidecarEnabled &&
      activeCompactPanel === "suggestions",
    closeCompactPanel,
    toggleAuxiliaryPanel,
    resetCompactPanel,
  };
}
