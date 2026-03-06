import type { Id } from "@opencom/convex/dataModel";
import type {
  MessageButton as SharedMessageButton,
  OutboundButtonAction,
  OutboundClickAction,
  OutboundClickActionType,
  OutboundMessageContent as SharedOutboundMessageContent,
  OutboundMessageType,
} from "@opencom/types";

export type MessageType = OutboundMessageType;
export type MessageClickActionType = OutboundClickActionType;
export type PostPrimaryActionType = Extract<
  OutboundButtonAction,
  "url" | "open_new_conversation" | "open_help_article" | "open_widget_tab"
>;
export type SupportedMessageButtonAction = Exclude<OutboundButtonAction, "reply" | "chat">;

export type MessageClickAction = OutboundClickAction<Id<"articles">>;

export type MessageButton = Omit<SharedMessageButton<Id<"tours">, Id<"articles">>, "action"> & {
  action: SupportedMessageButtonAction;
};

export type MessageContent = Omit<
  SharedOutboundMessageContent<Id<"users">, Id<"tours">, Id<"articles">>,
  "buttons" | "clickAction"
> & {
  buttons?: MessageButton[];
  clickAction?: MessageClickAction;
};

export interface ClickActionFormState {
  type: MessageClickActionType;
  tabId: string;
  articleId: string;
  url: string;
  prefillMessage: string;
}

export interface PostButtonFormState {
  primaryButtonText: string;
  primaryActionType: PostPrimaryActionType;
  primaryActionUrl: string;
  primaryActionTabId: string;
  primaryActionArticleId: string;
  primaryActionPrefillMessage: string;
  dismissEnabled: boolean;
  dismissButtonText: string;
}

const DEFAULT_CLICK_ACTION_STATE: ClickActionFormState = {
  type: "open_messenger",
  tabId: "",
  articleId: "",
  url: "",
  prefillMessage: "",
};

const DEFAULT_POST_BUTTON_STATE: PostButtonFormState = {
  primaryButtonText: "Learn More",
  primaryActionType: "open_new_conversation",
  primaryActionUrl: "",
  primaryActionTabId: "messages",
  primaryActionArticleId: "",
  primaryActionPrefillMessage: "",
  dismissEnabled: true,
  dismissButtonText: "Dismiss",
};

export function createDefaultClickActionFormState(): ClickActionFormState {
  return { ...DEFAULT_CLICK_ACTION_STATE };
}

export function toClickActionFormState(
  clickAction: MessageClickAction | undefined
): ClickActionFormState {
  if (!clickAction) {
    return createDefaultClickActionFormState();
  }

  return {
    type: clickAction.type,
    tabId: clickAction.tabId ?? "",
    articleId: (clickAction.articleId as string | undefined) ?? "",
    url: clickAction.url ?? "",
    prefillMessage: clickAction.prefillMessage ?? "",
  };
}

export function toMessageClickAction(formState: ClickActionFormState): MessageClickAction {
  return {
    type: formState.type,
    ...(formState.type === "open_widget_tab" && formState.tabId ? { tabId: formState.tabId } : {}),
    ...(formState.type === "open_help_article" && formState.articleId
      ? { articleId: formState.articleId as Id<"articles"> }
      : {}),
    ...(formState.type === "open_url" && formState.url ? { url: formState.url } : {}),
    ...(formState.type === "open_new_conversation" && formState.prefillMessage
      ? { prefillMessage: formState.prefillMessage }
      : {}),
  };
}

export function createDefaultPostButtonFormState(): PostButtonFormState {
  return { ...DEFAULT_POST_BUTTON_STATE };
}

export function toPostButtonFormState(buttons: MessageButton[] | undefined): PostButtonFormState {
  if (!buttons || buttons.length === 0) {
    return createDefaultPostButtonFormState();
  }

  const primaryButton = buttons.find((button) => button.action !== "dismiss");
  const dismissButton = buttons.find((button) => button.action === "dismiss");
  const hasExistingPostButtons = buttons.length > 0;

  if (!primaryButton) {
    return {
      ...createDefaultPostButtonFormState(),
      dismissEnabled: dismissButton ? true : !hasExistingPostButtons,
      dismissButtonText: dismissButton?.text ?? DEFAULT_POST_BUTTON_STATE.dismissButtonText,
    };
  }

  const parsedPrimaryAction: PostPrimaryActionType =
    primaryButton.action === "url" ||
    primaryButton.action === "open_new_conversation" ||
    primaryButton.action === "open_widget_tab" ||
    primaryButton.action === "open_help_article"
      ? primaryButton.action
      : "open_new_conversation";

  return {
    primaryButtonText: primaryButton.text || DEFAULT_POST_BUTTON_STATE.primaryButtonText,
    primaryActionType: parsedPrimaryAction,
    primaryActionUrl: primaryButton.url || "",
    primaryActionTabId: primaryButton.tabId || DEFAULT_POST_BUTTON_STATE.primaryActionTabId,
    primaryActionArticleId: (primaryButton.articleId as string | undefined) || "",
    primaryActionPrefillMessage: primaryButton.prefillMessage || "",
    dismissEnabled: dismissButton ? true : !hasExistingPostButtons,
    dismissButtonText: dismissButton?.text || DEFAULT_POST_BUTTON_STATE.dismissButtonText,
  };
}

export function toPostButtons(formState: PostButtonFormState): MessageButton[] | undefined {
  const buttons: MessageButton[] = [];

  const trimmedPrimaryText = formState.primaryButtonText.trim();
  if (trimmedPrimaryText) {
    buttons.push({
      text: trimmedPrimaryText,
      action: formState.primaryActionType,
      ...(formState.primaryActionType === "url" && formState.primaryActionUrl.trim()
        ? { url: formState.primaryActionUrl.trim() }
        : {}),
      ...(formState.primaryActionType === "open_widget_tab" && formState.primaryActionTabId
        ? { tabId: formState.primaryActionTabId }
        : {}),
      ...(formState.primaryActionType === "open_help_article" && formState.primaryActionArticleId
        ? { articleId: formState.primaryActionArticleId as Id<"articles"> }
        : {}),
      ...(formState.primaryActionType === "open_new_conversation" &&
      formState.primaryActionPrefillMessage.trim()
        ? { prefillMessage: formState.primaryActionPrefillMessage.trim() }
        : {}),
    });
  }

  const trimmedDismissText = formState.dismissButtonText.trim();
  if (formState.dismissEnabled && trimmedDismissText) {
    buttons.push({
      text: trimmedDismissText,
      action: "dismiss",
    });
  }

  return buttons.length > 0 ? buttons : undefined;
}
