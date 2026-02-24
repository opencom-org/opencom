import { describe, it, expect, beforeEach } from "vitest";
import {
  getVisitorState,
  setVisitorId,
  setSessionId,
  setUser,
  clearUser,
  resetVisitorState,
  generateSessionId,
} from "../src/state/visitor";
import {
  getConversationState,
  setConversations,
  addConversation,
  setActiveConversation,
  setMessages,
  addMessage,
  setLoading,
  resetConversationState,
} from "../src/state/conversation";
import type { VisitorId, ConversationId, MessageId } from "../src/types";

describe("Visitor State", () => {
  beforeEach(() => {
    resetVisitorState();
  });

  it("should have initial state", () => {
    const state = getVisitorState();
    expect(state.visitorId).toBeNull();
    expect(state.sessionId).toBe("");
    expect(state.isIdentified).toBe(false);
    expect(state.user).toBeNull();
  });

  it("should set visitor ID", () => {
    const visitorId = "test-visitor-id" as VisitorId;
    setVisitorId(visitorId);
    expect(getVisitorState().visitorId).toBe(visitorId);
  });

  it("should set session ID", () => {
    setSessionId("test-session");
    expect(getVisitorState().sessionId).toBe("test-session");
  });

  it("should set user and mark as identified with email", () => {
    setUser({ email: "test@example.com", name: "Test User" });
    const state = getVisitorState();
    expect(state.user?.email).toBe("test@example.com");
    expect(state.isIdentified).toBe(true);
  });

  it("should set user and mark as identified with userId", () => {
    setUser({ userId: "user-123" });
    const state = getVisitorState();
    expect(state.user?.userId).toBe("user-123");
    expect(state.isIdentified).toBe(true);
  });

  it("should clear user", () => {
    setUser({ email: "test@example.com" });
    clearUser();
    const state = getVisitorState();
    expect(state.user).toBeNull();
    expect(state.isIdentified).toBe(false);
  });

  it("should generate unique session IDs", () => {
    const id1 = generateSessionId();
    const id2 = generateSessionId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^session_\d+_[a-z0-9]+$/);
  });
});

describe("Conversation State", () => {
  beforeEach(() => {
    resetConversationState();
  });

  it("should have initial state", () => {
    const state = getConversationState();
    expect(state.conversations).toEqual([]);
    expect(state.activeConversationId).toBeNull();
    expect(state.messages).toEqual([]);
    expect(state.isLoading).toBe(false);
  });

  it("should set conversations", () => {
    const conversations = [
      {
        id: "conv-1" as ConversationId,
        lastMessage: "Hello",
        unreadCount: 1,
        createdAt: Date.now(),
      },
    ];
    setConversations(conversations);
    expect(getConversationState().conversations).toEqual(conversations);
  });

  it("should add conversation to front", () => {
    const conv1 = {
      id: "conv-1" as ConversationId,
      unreadCount: 0,
      createdAt: Date.now(),
    };
    const conv2 = {
      id: "conv-2" as ConversationId,
      unreadCount: 0,
      createdAt: Date.now(),
    };
    setConversations([conv1]);
    addConversation(conv2);
    const state = getConversationState();
    expect(state.conversations[0].id).toBe("conv-2");
    expect(state.conversations[1].id).toBe("conv-1");
  });

  it("should set active conversation", () => {
    const convId = "conv-1" as ConversationId;
    setActiveConversation(convId);
    expect(getConversationState().activeConversationId).toBe(convId);
  });

  it("should set messages", () => {
    const messages = [
      {
        id: "msg-1" as MessageId,
        conversationId: "conv-1" as ConversationId,
        senderId: "visitor-1",
        senderType: "visitor" as const,
        content: "Hello",
        createdAt: Date.now(),
      },
    ];
    setMessages(messages);
    expect(getConversationState().messages).toEqual(messages);
  });

  it("should add message", () => {
    const msg1 = {
      id: "msg-1" as MessageId,
      conversationId: "conv-1" as ConversationId,
      senderId: "visitor-1",
      senderType: "visitor" as const,
      content: "Hello",
      createdAt: Date.now(),
    };
    const msg2 = {
      id: "msg-2" as MessageId,
      conversationId: "conv-1" as ConversationId,
      senderId: "agent-1",
      senderType: "agent" as const,
      content: "Hi there",
      createdAt: Date.now(),
    };
    setMessages([msg1]);
    addMessage(msg2);
    const state = getConversationState();
    expect(state.messages.length).toBe(2);
    expect(state.messages[1].id).toBe("msg-2");
  });

  it("should set loading state", () => {
    setLoading(true);
    expect(getConversationState().isLoading).toBe(true);
    setLoading(false);
    expect(getConversationState().isLoading).toBe(false);
  });
});
