"use client";

import type { Id } from "@opencom/convex/dataModel";

export type InboxAiWorkflowFilter = "all" | "ai_handled" | "handoff";
export type InboxCompactPanel = "ai-review" | "suggestions" | null;

export interface InboxConversation {
  _id: Id<"conversations">;
  createdAt: number;
  lastMessageAt?: number;
  unreadByAgent?: number;
  status: "open" | "closed" | "snoozed";
  channel?: "chat" | "email";
  subject?: string;
  visitorId?: Id<"visitors">;
  visitor?: {
    name?: string;
    email?: string;
    readableId?: string;
    identityVerified?: boolean;
  } | null;
  aiWorkflow?: {
    state?: "none" | "ai_handled" | "handoff";
    handoffReason?: string | null;
  } | null;
  lastMessage?: {
    _id: string;
    content: string;
    createdAt?: number;
    senderType?: "agent" | "visitor" | "bot";
  } | null;
}

export interface InboxMessage {
  _id: Id<"messages">;
  senderType: "agent" | "visitor" | "bot";
  content: string;
  createdAt: number;
  channel?: "chat" | "email";
  deliveryStatus?: "pending" | "sent" | "delivered" | "failed";
  emailMetadata?: {
    subject?: string;
    from?: string;
    attachments?: Array<{ filename?: string; contentType?: string }>;
  } | null;
}

export interface InboxSnippet {
  _id: Id<"snippets">;
  name: string;
  content: string;
  shortcut?: string;
}

export interface InboxArticle {
  _id: Id<"articles">;
  title: string;
  slug: string;
  content: string;
}

export type InboxKnowledgeType = "article" | "internalArticle" | "snippet";

export interface InboxKnowledgeItem {
  id: string;
  type: InboxKnowledgeType;
  title: string;
  content: string;
  snippet?: string;
  slug?: string;
  tags?: string[];
}

export interface InboxAiSource {
  type: string;
  id: string;
  title: string;
  articleId?: string;
}

export interface InboxAiResponse {
  _id: Id<"aiResponses">;
  createdAt: number;
  query: string;
  response: string;
  confidence: number;
  handedOff: boolean;
  handoffReason?: string | null;
  messageId: Id<"messages">;
  feedback?: "helpful" | "not_helpful" | null;
  sources: InboxAiSource[];
  deliveredResponseContext?: {
    response: string;
    confidence: number | null;
    sources: InboxAiSource[];
  } | null;
  generatedResponseContext?: {
    response: string;
    confidence: number;
    sources: InboxAiSource[];
  } | null;
}
