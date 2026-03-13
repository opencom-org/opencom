import { useEffect, useMemo, useRef } from "react";
import type { Id } from "@opencom/convex/dataModel";

export interface InboxSelectionConversationRef {
  _id: Id<"conversations">;
}

export interface InboxSelectionRouter {
  replace: (href: string, options?: { scroll?: boolean }) => void;
}

export interface InboxSelectionSearchParams {
  get: (name: string) => string | null;
  toString: () => string;
}

export interface UseInboxSelectionSyncArgs {
  conversations: InboxSelectionConversationRef[] | undefined;
  isConversationsLoading: boolean;
  selectedConversationId: Id<"conversations"> | null;
  setSelectedConversationId: (id: Id<"conversations"> | null) => void;
  resetCompactPanel: () => void;
  clearWorkflowError: () => void;
  searchParams: InboxSelectionSearchParams;
  router: InboxSelectionRouter;
}

export interface UseInboxSelectionSyncResult {
  queryConversationId: Id<"conversations"> | null;
}

export function getQueryConversationId(
  searchParams: InboxSelectionSearchParams
): Id<"conversations"> | null {
  const requestedConversationId =
    searchParams.get("conversationId") ?? searchParams.get("conversation");
  return requestedConversationId ? (requestedConversationId as Id<"conversations">) : null;
}

export function buildInboxRouteWithConversationId(args: {
  searchParams: InboxSelectionSearchParams;
  selectedConversationId: Id<"conversations"> | null;
}): string {
  const nextSearchParams = new URLSearchParams(args.searchParams.toString());
  if (args.selectedConversationId) {
    nextSearchParams.set("conversationId", args.selectedConversationId);
  } else {
    nextSearchParams.delete("conversationId");
  }
  nextSearchParams.delete("conversation");
  const nextQuery = nextSearchParams.toString();
  return nextQuery ? `/inbox?${nextQuery}` : "/inbox";
}

export function useInboxSelectionSync({
  conversations,
  isConversationsLoading,
  selectedConversationId,
  setSelectedConversationId,
  resetCompactPanel,
  clearWorkflowError,
  searchParams,
  router,
}: UseInboxSelectionSyncArgs): UseInboxSelectionSyncResult {
  const queryConversationId = useMemo(
    () => getQueryConversationId(searchParams),
    [searchParams]
  );
  const lastAppliedQueryConversationIdRef = useRef<Id<"conversations"> | null>(null);

  useEffect(() => {
    if (!selectedConversationId || !conversations) {
      return;
    }
    if (!conversations.some((conversation) => conversation._id === selectedConversationId)) {
      setSelectedConversationId(null);
      resetCompactPanel();
    }
  }, [conversations, resetCompactPanel, selectedConversationId, setSelectedConversationId]);

  useEffect(() => {
    if (!conversations) {
      return;
    }
    const queryHasChanged = lastAppliedQueryConversationIdRef.current !== queryConversationId;
    if (!queryHasChanged) {
      return;
    }
    lastAppliedQueryConversationIdRef.current = queryConversationId;
    if (!queryConversationId) {
      if (selectedConversationId !== null) {
        setSelectedConversationId(null);
        resetCompactPanel();
      }
      return;
    }
    if (!conversations.some((conversation) => conversation._id === queryConversationId)) {
      return;
    }
    if (selectedConversationId !== queryConversationId) {
      setSelectedConversationId(queryConversationId);
      clearWorkflowError();
    }
  }, [
    clearWorkflowError,
    conversations,
    queryConversationId,
    resetCompactPanel,
    selectedConversationId,
    setSelectedConversationId,
  ]);

  useEffect(() => {
    if (isConversationsLoading) {
      return;
    }
    if (
      selectedConversationId === null &&
      queryConversationId &&
      conversations?.some((conversation) => conversation._id === queryConversationId)
    ) {
      return;
    }
    if (selectedConversationId === queryConversationId) {
      return;
    }

    router.replace(
      buildInboxRouteWithConversationId({
        searchParams,
        selectedConversationId,
      }),
      { scroll: false }
    );
  }, [
    conversations,
    isConversationsLoading,
    queryConversationId,
    router,
    searchParams,
    selectedConversationId,
  ]);

  return {
    queryConversationId,
  };
}
