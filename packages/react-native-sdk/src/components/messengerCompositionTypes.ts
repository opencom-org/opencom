import type { Id } from "@opencom/convex/dataModel";

export type MessengerNestedView = "list" | "conversation";
export type MessengerConversationId = Id<"conversations"> | null;
export type LegacyConversationId = string | null;

export interface MessengerCompositionControlProps {
  onViewChange?: (view: MessengerNestedView) => void;
  controlledView?: MessengerNestedView;
  activeConversationId?: MessengerConversationId;
  onConversationChange?: (conversationId: MessengerConversationId) => void;
}

// Adapter for external/public APIs that still surface conversation IDs as strings.
export function toMessengerConversationId(
  conversationId: LegacyConversationId | undefined
): MessengerConversationId {
  if (!conversationId) {
    return null;
  }
  return conversationId as Id<"conversations">;
}

export function toLegacyConversationId(
  conversationId: MessengerConversationId
): LegacyConversationId {
  return conversationId;
}
