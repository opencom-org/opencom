import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useMutation } from "convex/react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import type { WidgetView } from "../widgetShell/types";

type ConversationStatus = "open" | "closed" | "snoozed";

export interface WidgetConversationSummary {
  _id: Id<"conversations">;
  status: ConversationStatus;
  createdAt: number;
  lastMessageAt?: number;
}

interface UseWidgetConversationFlowOptions {
  activeWorkspaceId?: string;
  visitorId: Id<"visitors"> | null;
  visitorIdRef: MutableRefObject<Id<"visitors"> | null>;
  sessionTokenRef: MutableRefObject<string | null | undefined>;
  visitorConversations: WidgetConversationSummary[] | undefined;
  onViewChange: (view: WidgetView) => void;
}

function getReusableDraftConversationId(
  conversations: WidgetConversationSummary[] | undefined
): Id<"conversations"> | null {
  if (!conversations || conversations.length === 0) {
    return null;
  }

  const draftConversation = conversations.find((conversation) => {
    if (conversation.status !== "open") {
      return false;
    }
    const lastMessageAt = conversation.lastMessageAt ?? conversation.createdAt;
    return lastMessageAt === conversation.createdAt;
  });

  return draftConversation?._id ?? null;
}

function resolveCreatedConversationId(
  createdConversation:
    | { _id: Id<"conversations"> }
    | Id<"conversations">
    | null
    | undefined
): Id<"conversations"> | null {
  if (!createdConversation) {
    return null;
  }

  if (typeof createdConversation === "string") {
    return createdConversation as Id<"conversations">;
  }

  return createdConversation._id ?? null;
}

export function useWidgetConversationFlow({
  activeWorkspaceId,
  visitorId,
  visitorIdRef,
  sessionTokenRef,
  visitorConversations,
  onViewChange,
}: UseWidgetConversationFlowOptions) {
  const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);
  const createConversationRequestRef = useRef<Promise<Id<"conversations"> | null> | null>(null);
  const latestDraftConversationIdRef = useRef<Id<"conversations"> | null>(null);

  const createConversation = useMutation(api.conversations.createForVisitor);
  const markAsRead = useMutation(api.conversations.markAsRead);

  const selectedConversation = useMemo(() => {
    if (!conversationId) {
      return null;
    }
    return (
      visitorConversations?.find((conversation) => conversation._id === conversationId) ?? null
    );
  }, [conversationId, visitorConversations]);

  const reusableDraftConversationId = useMemo(
    () => getReusableDraftConversationId(visitorConversations),
    [visitorConversations]
  );

  useEffect(() => {
    if (!visitorConversations) {
      return;
    }

    if (reusableDraftConversationId) {
      latestDraftConversationIdRef.current = reusableDraftConversationId;
      return;
    }

    const latestDraftConversationId = latestDraftConversationIdRef.current;
    if (!latestDraftConversationId) {
      return;
    }

    const latestConversation = visitorConversations.find(
      (conversation) => conversation._id === latestDraftConversationId
    );

    if (!latestConversation) {
      latestDraftConversationIdRef.current = null;
      return;
    }

    const latestConversationLastMessageAt =
      latestConversation.lastMessageAt ?? latestConversation.createdAt;
    const isLatestConversationStillDraft =
      latestConversation.status === "open" &&
      latestConversationLastMessageAt === latestConversation.createdAt;

    if (!isLatestConversationStillDraft) {
      latestDraftConversationIdRef.current = null;
    }
  }, [reusableDraftConversationId, visitorConversations]);

  const openConversation = useCallback(
    (id: Id<"conversations">) => {
      setConversationId(id);
      onViewChange("conversation");
    },
    [onViewChange]
  );

  const clearConversationSelection = useCallback(() => {
    setConversationId(null);
  }, []);

  const resetDraftConversationState = useCallback(() => {
    latestDraftConversationIdRef.current = null;
    createConversationRequestRef.current = null;
  }, []);

  const waitForVisitorId = useCallback(async () => {
    let currentVisitorId = visitorIdRef.current;
    if (currentVisitorId) {
      return currentVisitorId;
    }

    for (let attempt = 0; attempt < 30 && !visitorIdRef.current; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return visitorIdRef.current;
  }, [visitorIdRef]);

  const createFreshConversation = useCallback(async () => {
    const resolvedVisitorId = visitorIdRef.current ?? (await waitForVisitorId());
    if (!resolvedVisitorId || !activeWorkspaceId) {
      console.warn("[Opencom Widget] Cannot create conversation - visitor not initialized", {
        visitorId: resolvedVisitorId,
        activeWorkspaceId,
      });
      return null;
    }

    try {
      const createdConversation = await createConversation({
        workspaceId: activeWorkspaceId as Id<"workspaces">,
        visitorId: resolvedVisitorId,
        sessionToken: sessionTokenRef.current ?? "",
      });
      return resolveCreatedConversationId(createdConversation);
    } catch (error) {
      console.error("Failed to create conversation:", error);
      return null;
    }
  }, [activeWorkspaceId, createConversation, sessionTokenRef, waitForVisitorId]);

  const openFreshConversation = useCallback(async () => {
    const createdConversationId = await createFreshConversation();
    if (!createdConversationId) {
      return null;
    }

    latestDraftConversationIdRef.current = createdConversationId;
    openConversation(createdConversationId);
    return createdConversationId;
  }, [createFreshConversation, openConversation]);

  const handleNewConversation = useCallback(async () => {
    const existingDraftConversationId =
      reusableDraftConversationId ?? latestDraftConversationIdRef.current;
    if (existingDraftConversationId) {
      openConversation(existingDraftConversationId);
      return;
    }

    if (createConversationRequestRef.current) {
      const inFlightConversationId = await createConversationRequestRef.current;
      if (inFlightConversationId) {
        latestDraftConversationIdRef.current = inFlightConversationId;
        openConversation(inFlightConversationId);
      }
      return;
    }

    const createConversationRequest = createFreshConversation();
    createConversationRequestRef.current = createConversationRequest;

    try {
      const createdConversationId = await createConversationRequest;
      if (createdConversationId) {
        latestDraftConversationIdRef.current = createdConversationId;
        openConversation(createdConversationId);
      }
    } finally {
      if (createConversationRequestRef.current === createConversationRequest) {
        createConversationRequestRef.current = null;
      }
    }
  }, [createFreshConversation, openConversation, reusableDraftConversationId]);

  const syncConversationReadState = useCallback(
    (conversationIdToSync: Id<"conversations">) => {
      markAsRead({
        id: conversationIdToSync,
        readerType: "visitor",
        visitorId: visitorId ?? undefined,
        sessionToken: sessionTokenRef.current ?? undefined,
      }).catch(console.error);
    },
    [markAsRead, sessionTokenRef, visitorId]
  );

  const handleSelectConversation = useCallback(
    (selectedConversationId: Id<"conversations">) => {
      openConversation(selectedConversationId);
      syncConversationReadState(selectedConversationId);
    },
    [openConversation, syncConversationReadState]
  );

  const handleBackToList = useCallback(() => {
    if (conversationId) {
      syncConversationReadState(conversationId);
    }
    onViewChange("conversation-list");
  }, [conversationId, onViewChange, syncConversationReadState]);

  return {
    conversationId,
    selectedConversation,
    openConversation,
    clearConversationSelection,
    resetDraftConversationState,
    createFreshConversation,
    openFreshConversation,
    handleNewConversation,
    handleSelectConversation,
    handleBackToList,
    syncConversationReadState,
  };
}
