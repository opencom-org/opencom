import type { Id } from "@opencom/convex/dataModel";

export type MobileWorkspaceRole = "owner" | "admin" | "agent" | "viewer";
export type MobileConversationStatus = "open" | "closed" | "snoozed";

export interface MobileAuthUser {
  _id: Id<"users">;
  email: string;
  name?: string;
  workspaceId: Id<"workspaces">;
  role: MobileWorkspaceRole;
  avatarUrl?: string;
}

export interface MobileWorkspace {
  _id: Id<"workspaces">;
  name: string;
  role: MobileWorkspaceRole;
  allowedOrigins?: string[];
}

export type MobileCurrentUserRecord = {
  user: MobileAuthUser | null;
  workspaces: MobileWorkspace[];
} | null;

export type HostedOnboardingState = {
  status: "not_started" | "started" | "completed";
  isWidgetVerified: boolean;
  verificationToken?: string | null;
} | null;

export type HostedOnboardingIntegrationSignal = {
  id: string;
  integrationKey: string;
  clientType: string;
  clientVersion?: string | null;
  status: "recognized" | "active" | "inactive";
  isActiveNow: boolean;
  matchesCurrentVerificationWindow: boolean;
  origin?: string | null;
  currentUrl?: string | null;
  clientIdentifier?: string | null;
  lastSeenAt?: number | null;
  activeSessionCount: number;
  detectedAt?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type HostedOnboardingIntegrationSignals = {
  integrations: HostedOnboardingIntegrationSignal[];
} | null;

export type MobileNotificationPreferencesRecord = {
  muted: boolean;
} | null;

export type MobileWorkspaceRecord = {
  _id: Id<"workspaces">;
  allowedOrigins?: string[];
  signupMode?: "invite-only" | "domain-allowlist";
  allowedDomains?: string[];
} | null;

export interface MobileWorkspaceMemberRecord {
  _id: Id<"workspaceMembers">;
  userId: Id<"users">;
  name?: string;
  email?: string;
  role: MobileWorkspaceRole;
}

export type InviteToWorkspaceResult = {
  status: "added" | "invited";
};

export type MobilePushTokenRecord = {
  _id: string;
};

export interface MobileConversationItem {
  _id: string;
  visitorId?: string;
  status: MobileConversationStatus;
  lastMessageAt?: number;
  createdAt: number;
  unreadByAgent?: number;
  visitor: {
    name?: string;
    email?: string;
    readableId?: string;
  } | null;
  lastMessage: {
    content: string;
    senderType: string;
    createdAt: number;
  } | null;
}

export type MobileInboxPageResult =
  | MobileConversationItem[]
  | {
      conversations: MobileConversationItem[];
    };

export type MobileConversationRecord = {
  _id: Id<"conversations">;
  visitorId?: Id<"visitors">;
  status: MobileConversationStatus;
};

export type MobileVisitorRecord = {
  _id: Id<"visitors">;
  name?: string;
  email?: string;
  readableId?: string;
  location?: { city?: string; country?: string };
  device?: { browser?: string; os?: string };
} | null;

export interface MobileConversationMessage {
  _id: string;
  content: string;
  senderType: "user" | "visitor" | "agent" | "bot";
  createdAt: number;
}
