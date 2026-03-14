"use client";

import type { Id } from "@opencom/convex/dataModel";
import {
  useWebMutation,
  useWebQuery,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";
import type {
  PendingInvitationRecord,
  TeamMemberRecord,
} from "../TeamMembersSection";

export type WorkspaceSettingsRecord = {
  _id: Id<"workspaces">;
  allowedOrigins?: string[];
  signupMode?: "invite-only" | "domain-allowlist";
  allowedDomains?: string[];
  helpCenterAccessPolicy?: "public" | "restricted";
  authMethods?: Array<"password" | "otp">;
  automationApiEnabled?: boolean;
} | null;

export type EmailConfigRecord = {
  enabled: boolean;
  forwardingAddress?: string;
  fromName?: string;
  fromEmail?: string;
  signature?: string;
};

type AiSettingsRecord = {
  enabled?: boolean;
} | null;

type AutomationSettingsRecord = {
  suggestArticlesEnabled?: boolean;
  showReplyTimeEnabled?: boolean;
  collectEmailEnabled?: boolean;
  askForRatingEnabled?: boolean;
} | null;

type SecurityAccessRecord = {
  status: "unauthenticated" | "forbidden" | "ok";
  canManageSecurity?: boolean;
} | null;

type MobileDeviceStatsRecord = {
  total: number;
} | null;

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type WorkspaceGetArgs = {
  id: Id<"workspaces">;
};

type UpdateAllowedOriginsArgs = {
  workspaceId: Id<"workspaces">;
  allowedOrigins: string[];
};

type UpsertEmailConfigArgs = {
  workspaceId: Id<"workspaces">;
  fromName?: string;
  fromEmail?: string;
  signature?: string;
  enabled: boolean;
};

type UpdateSignupSettingsArgs = {
  workspaceId: Id<"workspaces">;
  signupMode: "invite-only" | "domain-allowlist";
  allowedDomains: string[];
  authMethods: Array<"password" | "otp">;
};

type UpdateHelpCenterAccessPolicyArgs = {
  workspaceId: Id<"workspaces">;
  policy: "public" | "restricted";
};

const WORKSPACE_QUERY_REF = webQueryRef<WorkspaceGetArgs, WorkspaceSettingsRecord>(
  "workspaces:get"
);
const WORKSPACE_MEMBERS_QUERY_REF = webQueryRef<WorkspaceArgs, TeamMemberRecord[]>(
  "workspaceMembers:listByWorkspace"
);
const PENDING_INVITATIONS_QUERY_REF = webQueryRef<WorkspaceArgs, PendingInvitationRecord[]>(
  "workspaceMembers:getWorkspacePendingInvitations"
);
const EMAIL_CONFIG_QUERY_REF = webQueryRef<WorkspaceArgs, EmailConfigRecord | null>(
  "emailChannel:getEmailConfig"
);
const AI_SETTINGS_QUERY_REF = webQueryRef<WorkspaceArgs, AiSettingsRecord>("aiAgent:getSettings");
const AUTOMATION_SETTINGS_QUERY_REF = webQueryRef<WorkspaceArgs, AutomationSettingsRecord>(
  "automationSettings:get"
);
const AUDIT_ACCESS_QUERY_REF = webQueryRef<WorkspaceArgs, SecurityAccessRecord>(
  "auditLogs:getAccess"
);
const MOBILE_DEVICE_STATS_QUERY_REF = webQueryRef<WorkspaceArgs, MobileDeviceStatsRecord>(
  "visitorPushTokens:getStats"
);

const UPDATE_ALLOWED_ORIGINS_REF = webMutationRef<UpdateAllowedOriginsArgs, null>(
  "workspaces:updateAllowedOrigins"
);
const UPSERT_EMAIL_CONFIG_REF = webMutationRef<UpsertEmailConfigArgs, null>(
  "emailChannel:upsertEmailConfig"
);
const UPDATE_SIGNUP_SETTINGS_REF = webMutationRef<UpdateSignupSettingsArgs, null>(
  "workspaces:updateSignupSettings"
);
const UPDATE_HELP_CENTER_ACCESS_POLICY_REF = webMutationRef<
  UpdateHelpCenterAccessPolicyArgs,
  null
>("workspaces:updateHelpCenterAccessPolicy");

export function useSettingsPageConvex(workspaceId?: Id<"workspaces"> | null) {
  const workspace = useWebQuery(
    WORKSPACE_QUERY_REF,
    workspaceId ? { id: workspaceId } : "skip"
  );
  const members = useWebQuery(
    WORKSPACE_MEMBERS_QUERY_REF,
    workspaceId ? { workspaceId } : "skip"
  );
  const pendingInvitations = useWebQuery(
    PENDING_INVITATIONS_QUERY_REF,
    workspaceId ? { workspaceId } : "skip"
  );
  const emailConfig = useWebQuery(
    EMAIL_CONFIG_QUERY_REF,
    workspaceId ? { workspaceId } : "skip"
  );
  const aiSettings = useWebQuery(
    AI_SETTINGS_QUERY_REF,
    workspaceId ? { workspaceId } : "skip"
  );
  const automationSettings = useWebQuery(
    AUTOMATION_SETTINGS_QUERY_REF,
    workspaceId ? { workspaceId } : "skip"
  );
  const securityAccess = useWebQuery(
    AUDIT_ACCESS_QUERY_REF,
    workspaceId ? { workspaceId } : "skip"
  );
  const mobileDeviceStats = useWebQuery(
    MOBILE_DEVICE_STATS_QUERY_REF,
    workspaceId ? { workspaceId } : "skip"
  );

  return {
    aiSettings,
    automationSettings,
    emailConfig,
    members,
    mobileDeviceStats,
    pendingInvitations,
    securityAccess,
    updateAllowedOrigins: useWebMutation(UPDATE_ALLOWED_ORIGINS_REF),
    updateHelpCenterAccessPolicy: useWebMutation(UPDATE_HELP_CENTER_ACCESS_POLICY_REF),
    updateSignupSettings: useWebMutation(UPDATE_SIGNUP_SETTINGS_REF),
    upsertEmailConfig: useWebMutation(UPSERT_EMAIL_CONFIG_REF),
    workspace,
  };
}
