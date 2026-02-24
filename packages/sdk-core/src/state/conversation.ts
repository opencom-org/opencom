import type { ConversationState, ConversationSummary, MessageData, ConversationId } from "../types";

let conversationState: ConversationState = {
  conversations: [],
  activeConversationId: null,
  messages: [],
  isLoading: false,
};

export function getConversationState(): ConversationState {
  return { ...conversationState };
}

export function setConversations(conversations: ConversationSummary[]): void {
  conversationState.conversations = conversations;
}

export function addConversation(conversation: ConversationSummary): void {
  conversationState.conversations = [conversation, ...conversationState.conversations];
}

export function setActiveConversation(conversationId: ConversationId | null): void {
  conversationState.activeConversationId = conversationId;
}

export function setMessages(messages: MessageData[]): void {
  conversationState.messages = messages;
}

export function addMessage(message: MessageData): void {
  conversationState.messages = [...conversationState.messages, message];
}

export function setLoading(isLoading: boolean): void {
  conversationState.isLoading = isLoading;
}

export function resetConversationState(): void {
  conversationState = {
    conversations: [],
    activeConversationId: null,
    messages: [],
    isLoading: false,
  };
}
