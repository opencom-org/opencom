import React from "react";
import {
  View,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  type ViewStyle,
} from "react-native";
import type { Id } from "@opencom/convex/dataModel";
import { useOpencomContext } from "./OpencomProvider";
import { useMessengerSettings } from "../hooks/useMessengerSettings";
import type { MessengerCompositionControlProps } from "./messengerCompositionTypes";
import { ConversationListView } from "./messenger/ConversationListView";
import { ConversationDetailView } from "./messenger/ConversationDetailView";
import { messengerStyles } from "./messenger/styles";
import { useConversationListController } from "./messenger/useConversationListController";
import { useConversationDetailController } from "./messenger/useConversationDetailController";
import { useMessengerShellController } from "./messenger/useMessengerShellController";

interface OpencomMessengerProps extends MessengerCompositionControlProps {
  onClose?: () => void;
  style?: ViewStyle;
  headerTitle?: string;
  primaryColor?: string;
}

export function OpencomMessenger({
  style,
  primaryColor,
  onViewChange,
  controlledView,
  activeConversationId: controlledConversationId,
  onConversationChange,
}: OpencomMessengerProps) {
  const { theme } = useMessengerSettings();
  const { workspaceId } = useOpencomContext();

  const effectivePrimaryColor = primaryColor ?? theme.primaryColor;

  const { view, activeConversationId, handleSelectConversation, handleNewConversation } =
    useMessengerShellController({
      controlledView,
      activeConversationId: controlledConversationId,
      onViewChange,
      onConversationChange,
    });

  const listController = useConversationListController({
    workspaceId: workspaceId as Id<"workspaces">,
    onSelectConversation: handleSelectConversation,
    onNewConversation: handleNewConversation,
  });

  const detailController = useConversationDetailController({
    conversationId: activeConversationId,
  });

  const showConversation = view === "conversation" && activeConversationId !== null;

  return (
    <SafeAreaView style={[messengerStyles.container, style]}>
      <KeyboardAvoidingView
        style={messengerStyles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {showConversation ? (
          <ConversationDetailView
            messages={detailController.messages}
            isLoading={detailController.isLoading}
            primaryColor={effectivePrimaryColor}
            theme={theme}
            inputValue={detailController.inputValue}
            onInputChange={detailController.setInputValue}
            onSend={detailController.handleSend}
            emailInput={detailController.emailInput}
            onEmailChange={detailController.setEmailInput}
            showEmailCapture={detailController.showEmailCapture}
            onEmailSubmit={detailController.handleEmailSubmit}
            onEmailDismiss={detailController.handleEmailDismiss}
            isValidEmail={detailController.isValidEmail}
            flatListRef={detailController.flatListRef}
          />
        ) : (
          <View style={[messengerStyles.listContainer, { backgroundColor: theme.surfaceColor }]}>
            <ConversationListView
              conversations={listController.conversations}
              isLoading={listController.isLoading}
              onSelectConversation={listController.onSelectConversation}
              onStartConversation={listController.handleNewConversation}
              formatConversationTimestamp={listController.formatConversationTimestamp}
              primaryColor={effectivePrimaryColor}
              theme={theme}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
