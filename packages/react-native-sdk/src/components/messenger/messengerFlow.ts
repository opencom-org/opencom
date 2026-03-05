import type { Id } from "@opencom/convex/dataModel";
import type { MessengerConversationId, MessengerNestedView } from "../messengerCompositionTypes";

export interface EmailCaptureDecisionInput {
  visitorId: string | null;
  hasVisitorSentMessage: boolean;
  collectEmailEnabled: boolean;
  showEmailCapture: boolean;
  emailCaptured: boolean;
  lastAgentMessageCount: number;
  agentMessageCount: number;
}

export interface EmailCaptureDecision {
  shouldOpenPrompt: boolean;
  nextLastAgentMessageCount: number;
}

export interface MessengerShellState {
  view: MessengerNestedView;
  conversationId: MessengerConversationId;
}

export function createInitialMessengerShellState(
  controlledView: MessengerNestedView | undefined,
  controlledConversationId: MessengerConversationId | undefined
): MessengerShellState {
  return {
    view: controlledView ?? "list",
    conversationId: controlledConversationId ?? null,
  };
}

export function selectMessengerConversation(
  conversationId: Id<"conversations">,
  currentState: MessengerShellState
): MessengerShellState {
  return {
    ...currentState,
    view: "conversation",
    conversationId,
  };
}

export function shouldResetConversationOnControlledList(
  controlledView: MessengerNestedView | undefined,
  hasExternalConversationController: boolean
): boolean {
  return controlledView === "list" && hasExternalConversationController;
}

export function normalizeOutgoingMessage(inputValue: string): string | null {
  const normalized = inputValue.trim();
  return normalized.length > 0 ? normalized : null;
}

export function formatConversationTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function evaluateEmailCaptureDecision(
  input: EmailCaptureDecisionInput
): EmailCaptureDecision | null {
  if (!input.visitorId || input.emailCaptured) {
    return null;
  }
  if (!input.hasVisitorSentMessage || !input.collectEmailEnabled) {
    return null;
  }

  if (!input.showEmailCapture) {
    return {
      shouldOpenPrompt: true,
      nextLastAgentMessageCount: input.lastAgentMessageCount,
    };
  }

  return {
    shouldOpenPrompt: input.agentMessageCount > input.lastAgentMessageCount,
    nextLastAgentMessageCount: input.agentMessageCount,
  };
}
