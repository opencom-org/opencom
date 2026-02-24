import type { Id } from "@opencom/convex/dataModel";

export type VisitorId = Id<"visitors">;
export type WorkspaceId = Id<"workspaces">;
export type ConversationId = Id<"conversations">;
export type MessageId = Id<"messages">;
export type ArticleId = Id<"articles">;
export type CarouselId = Id<"carousels">;

export interface UserIdentification {
  email?: string;
  name?: string;
  userId?: string;
  userHash?: string;
  company?: string;
  customAttributes?: Record<string, unknown>;
}

export interface DeviceInfo {
  browser?: string;
  os?: string;
  deviceType?: string;
  platform?: "web" | "ios" | "android";
  appVersion?: string;
}

export interface LocationInfo {
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
}

export interface EventProperties {
  [key: string]: unknown;
}

export interface SDKConfig {
  workspaceId: string;
  convexUrl: string;
  debug?: boolean;
}

export interface VisitorState {
  visitorId: VisitorId | null;
  sessionId: string;
  sessionToken: string | null;
  sessionExpiresAt: number | null;
  isIdentified: boolean;
  user: UserIdentification | null;
}

export interface ConversationState {
  conversations: ConversationSummary[];
  activeConversationId: ConversationId | null;
  messages: MessageData[];
  isLoading: boolean;
}

export interface ConversationSummary {
  id: ConversationId;
  lastMessage?: string;
  lastMessageAt?: number;
  unreadCount: number;
  createdAt: number;
}

export interface MessageData {
  id: MessageId;
  conversationId: ConversationId;
  senderId: string;
  senderType: "user" | "visitor" | "agent" | "bot";
  content: string;
  createdAt: number;
}

export interface ArticleData {
  id: ArticleId;
  title: string;
  content: string;
  slug: string;
}

export interface CarouselData {
  id: CarouselId;
  name: string;
  screens: CarouselScreen[];
}

export interface CarouselScreen {
  id: string;
  title?: string;
  body?: string;
  imageUrl?: string;
  buttons?: CarouselButton[];
}

export interface CarouselButton {
  text: string;
  action: "url" | "dismiss" | "next" | "deeplink";
  url?: string;
  deepLink?: string;
}

export type SDKEventType =
  | "visitor_created"
  | "visitor_identified"
  | "conversation_created"
  | "message_received"
  | "message_sent"
  | "push_token_registered"
  | "carousel_shown"
  | "carousel_dismissed"
  | "messenger_opened"
  | "messenger_closed"
  | "carousel_opened"
  | "help_center_opened"
  | "help_center_closed"
  | "tickets_opened"
  | "ticket_opened"
  | "outbound_message_shown"
  | "outbound_message_dismissed"
  | "checklist_completed"
  | "deep_link_received";

export interface SDKEvent {
  type: SDKEventType;
  data: unknown;
  timestamp: number;
}

export type SDKEventListener = (event: SDKEvent) => void;
