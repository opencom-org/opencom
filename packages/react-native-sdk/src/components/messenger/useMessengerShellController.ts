import { useEffect, useState } from "react";
import type { Id } from "@opencom/convex/dataModel";
import type {
  MessengerCompositionControlProps,
  MessengerConversationId,
  MessengerNestedView,
} from "../messengerCompositionTypes";
import {
  createInitialMessengerShellState,
  selectMessengerConversation,
  shouldResetConversationOnControlledList,
} from "./messengerFlow";

interface MessengerShellControllerInput extends MessengerCompositionControlProps {
  onViewChange?: (view: MessengerNestedView) => void;
}

export interface MessengerShellControllerResult {
  view: MessengerNestedView;
  activeConversationId: MessengerConversationId;
  handleSelectConversation: (conversationId: Id<"conversations">) => void;
  handleNewConversation: (conversationId: Id<"conversations">) => void;
}

export function useMessengerShellController({
  controlledView,
  activeConversationId: controlledConversationId,
  onViewChange,
  onConversationChange,
}: MessengerShellControllerInput): MessengerShellControllerResult {
  const [view, setView] = useState<MessengerNestedView>(
    () => createInitialMessengerShellState(controlledView, controlledConversationId).view
  );
  const [localConversationId, setLocalConversationId] = useState<MessengerConversationId>(
    () => createInitialMessengerShellState(controlledView, controlledConversationId).conversationId
  );

  const activeConversationId =
    controlledConversationId !== undefined ? controlledConversationId : localConversationId;

  const setActiveConversationId = (conversationId: MessengerConversationId) => {
    if (onConversationChange) {
      onConversationChange(conversationId);
      return;
    }
    setLocalConversationId(conversationId);
  };

  useEffect(() => {
    if (controlledView !== undefined && controlledView !== view) {
      setView(controlledView);
      if (shouldResetConversationOnControlledList(controlledView, Boolean(onConversationChange))) {
        onConversationChange?.(null);
      }
    }
  }, [controlledView, view, onConversationChange]);

  const openConversationView = (conversationId: Id<"conversations">) => {
    const nextState = selectMessengerConversation(conversationId, {
      view,
      conversationId: activeConversationId ?? null,
    });
    setActiveConversationId(nextState.conversationId);
    setView(nextState.view);
    onViewChange?.(nextState.view);
  };

  return {
    view,
    activeConversationId,
    handleSelectConversation: openConversationView,
    handleNewConversation: openConversationView,
  };
}
