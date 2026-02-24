// Main SDK export
export { OpencomSDK, type DeepLinkResult, type DeepLinkType } from "./OpencomSDK";

// Components
export {
  OpencomProvider,
  useOpencomContext,
  OpencomLauncher,
  OpencomMessenger,
  OpencomHelpCenter,
  OpencomCarousel,
  OpencomSurveyRuntime,
  OpencomTickets,
  OpencomTicketDetail,
  OpencomTicketCreate,
  OpencomOutbound,
  OpencomChecklist,
  Opencom,
  type OpencomProps,
  type OpencomRef,
  type OpencomUser,
  type OpencomConfig,
} from "./components";

// Hooks
export {
  useOpencom,
  useConversations,
  useConversation,
  useCreateConversation,
  useArticles,
  useArticleSearch,
  useArticle,
  useTickets,
  useTicket,
  useAIAgent,
  useOutboundMessages,
  useChecklists,
  useOfficeHours,
  useArticleSuggestions,
  useSurveyDelivery,
  useMessengerSettings,
  useOpencomTheme,
  type OpencomTheme,
  type MessengerSettings,
} from "./hooks";

// Push notifications
export {
  registerForPushNotifications,
  unregisterPushNotifications,
  configurePushNotifications,
  setupNotificationListeners,
  getPushToken,
  usePushNotifications,
  updateBadgeCount,
  clearBadgeCount,
  refreshUnreadBadge,
} from "./push";

// Re-export types from sdk-core
export type {
  SDKConfig,
  UserIdentification,
  EventProperties,
  DeviceInfo,
  VisitorState,
  ConversationState,
  ConversationSummary,
  MessageData,
  ArticleData,
  CarouselData,
  CarouselScreen,
  CarouselButton,
  SDKEvent,
  SDKEventType,
  SDKEventListener,
} from "@opencom/sdk-core";
