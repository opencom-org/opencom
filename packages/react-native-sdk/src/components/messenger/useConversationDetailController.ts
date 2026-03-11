import { useEffect, useRef, useState } from "react";
import type { FlatList } from "react-native";
import type { Id } from "@opencom/convex/dataModel";
import { OpencomSDK } from "../../OpencomSDK";
import { useConversation } from "../../hooks/useConversations";
import { useAutomationSettings } from "../../hooks/useAutomationSettings";
import { evaluateEmailCaptureDecision, normalizeOutgoingMessage } from "./messengerFlow";
import { sdkMutationRef, useSdkMutation } from "../../internal/convex";

const IDENTIFY_VISITOR_REF = sdkMutationRef("visitors:identify");

interface UseConversationDetailControllerInput {
  conversationId: Id<"conversations"> | null;
}

export function useConversationDetailController({ conversationId }: UseConversationDetailControllerInput) {
  const { messages, isLoading, sendMessage, markAsRead } = useConversation(conversationId);
  const state = OpencomSDK.getVisitorState();
  const visitorId = state.visitorId;
  const automationSettings = useAutomationSettings();
  const identifyVisitor = useSdkMutation<Record<string, unknown>, unknown>(IDENTIFY_VISITOR_REF);
  const messageItems = messages as Array<{ senderType: string }>;

  const [inputValue, setInputValue] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [emailCaptured, setEmailCaptured] = useState(false);
  const [lastAgentMessageCount, setLastAgentMessageCount] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const visitorMessages = messageItems.filter((message) => message.senderType === "visitor");
  const hasVisitorSentMessage = visitorMessages.length > 0;
  const agentMessageCount = messageItems.filter((message) => message.senderType !== "visitor").length;

  useEffect(() => {
    markAsRead();
  }, [conversationId]);

  useEffect(() => {
    if (messageItems.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messageItems.length]);

  useEffect(() => {
    const decision = evaluateEmailCaptureDecision({
      visitorId: visitorId ?? null,
      hasVisitorSentMessage,
      collectEmailEnabled: Boolean(automationSettings?.collectEmailEnabled),
      showEmailCapture,
      emailCaptured,
      lastAgentMessageCount,
      agentMessageCount,
    });

    if (!decision) {
      return;
    }

    if (decision.shouldOpenPrompt) {
      setShowEmailCapture(true);
    }
    setLastAgentMessageCount(decision.nextLastAgentMessageCount);
  }, [
    visitorId,
    hasVisitorSentMessage,
    showEmailCapture,
    emailCaptured,
    lastAgentMessageCount,
    agentMessageCount,
    automationSettings?.collectEmailEnabled,
  ]);

  const handleEmailSubmit = async () => {
    if (!emailInput.trim() || !visitorId) {
      return;
    }
    try {
      await identifyVisitor({
        visitorId: visitorId as Id<"visitors">,
        sessionToken: state.sessionToken ?? undefined,
        email: emailInput.trim(),
        origin: undefined,
      });
      setShowEmailCapture(false);
      setEmailCaptured(true);
      setEmailInput("");
    } catch (error) {
      console.error("[Opencom] Failed to update email:", error);
    }
  };

  const handleEmailDismiss = () => {
    setShowEmailCapture(false);
  };

  const handleSend = async () => {
    const content = normalizeOutgoingMessage(inputValue);
    if (!content) {
      return;
    }
    setInputValue("");
    await sendMessage(content);
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return {
    messages,
    isLoading,
    inputValue,
    emailInput,
    showEmailCapture,
    flatListRef,
    setInputValue,
    setEmailInput,
    handleSend,
    handleEmailSubmit,
    handleEmailDismiss,
    isValidEmail,
  };
}
