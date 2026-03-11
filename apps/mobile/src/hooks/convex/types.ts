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

export type HostedOnboardingStatus = "not_started" | "in_progress" | "completed";

export type HostedOnboardingView = {
  status: HostedOnboardingStatus;
  currentStep: number;
  completedSteps: string[];
  onboardingVerificationToken: string | null;
  verificationToken: string | null;
  verificationTokenIssuedAt: number | null;
  widgetVerifiedAt: number | null;
  isWidgetVerified: boolean;
  updatedAt: number | null;
};

export type HostedOnboardingState =
  | (HostedOnboardingView & {
      hasRecognizedInstall: boolean;
      latestDetectedAt: number | null;
      latestRecognizedDetectedAt: number | null;
      detectedIntegrationCount: number;
    })
  | null;

export type HostedOnboardingVerificationTokenResult = {
  token: string;
  issuedAt: number;
};

export type CompleteHostedOnboardingWidgetStepResult =
  | {
      success: true;
      status: "completed";
      currentStep: number;
      completedSteps: string[];
      updatedAt: number;
    }
  | {
      success: false;
      reason: "token_mismatch" | "not_verified";
    };

export type HostedOnboardingIntegrationSignal = {
  id: string;
  clientType: string;
  clientVersion: string | null;
  clientIdentifier: string | null;
  origin: string | null;
  currentUrl: string | null;
  devicePlatform: string | null;
  sessionCount: number;
  activeSessionCount: number;
  lastSeenAt: number;
  latestSessionExpiresAt: number;
  isActiveNow: boolean;
  matchesCurrentVerificationWindow: boolean;
};

export type HostedOnboardingIntegrationSignals = {
  tokenIssuedAt: number | null;
  hasRecognizedInstall: boolean;
  latestDetectedAt: number | null;
  latestRecognizedDetectedAt: number | null;
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
