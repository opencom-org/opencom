"use client";

import type { Id } from "@opencom/convex/dataModel";
import type { HomeCard, HomeConfig, HomeDefaultSpace, HomeTab } from "@opencom/types";
import {
  useWebAction,
  useWebMutation,
  useWebQuery,
  webActionRef,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type AuditAccessRecord = {
  status: "unauthenticated" | "forbidden" | "ok";
  canManageSecurity?: boolean;
  canRead?: boolean;
  canExport?: boolean;
} | null;

type AuditLogFilters = {
  action?: string;
  actorId?: Id<"users">;
  resourceType?: string;
  resourceId?: string;
  startTime: number;
  endTime: number;
};

type InviteToWorkspaceArgs = {
  workspaceId: Id<"workspaces">;
  email: string;
  role: "admin" | "agent" | "viewer";
  baseUrl: string;
};

type InviteToWorkspaceResult = {
  status: "added" | "invited";
};

type UpdateRoleArgs = {
  membershipId: Id<"workspaceMembers">;
  role: "admin" | "agent" | "viewer";
};

type RemoveMemberArgs = {
  membershipId: Id<"workspaceMembers">;
};

type CancelInvitationArgs = {
  invitationId: Id<"workspaceInvitations">;
};

type TransferOwnershipArgs = {
  workspaceId: Id<"workspaces">;
  newOwnerId: Id<"users">;
};

type SuccessResponse = {
  success: boolean;
};

const AI_SETTINGS_QUERY_REF = webQueryRef<
  WorkspaceArgs,
  {
    enabled: boolean;
    model: string;
    confidenceThreshold: number;
    knowledgeSources: string[];
    personality?: string;
    handoffMessage?: string;
    suggestionsEnabled?: boolean;
    embeddingModel?: string;
    lastConfigError?: {
      message: string;
      code: string;
      provider?: string;
      model?: string;
    } | null;
  } | null
>("aiAgent:getSettings");
const AVAILABLE_MODELS_QUERY_REF = webQueryRef<
  Record<string, never>,
  Array<{ id: string; name: string; provider: string }>
>("aiAgent:listAvailableModels");
const UPDATE_AI_SETTINGS_REF = webMutationRef<
  {
    workspaceId: Id<"workspaces">;
    enabled?: boolean;
    model?: string;
    confidenceThreshold?: number;
    knowledgeSources?: Array<"articles" | "internalArticles" | "snippets">;
    personality?: string;
    handoffMessage?: string;
    suggestionsEnabled?: boolean;
    embeddingModel?: string;
  },
  null
>("aiAgent:updateSettings");
const AUTOMATION_SETTINGS_QUERY_REF = webQueryRef<
  WorkspaceArgs,
  {
    suggestArticlesEnabled: boolean;
    showReplyTimeEnabled: boolean;
    collectEmailEnabled: boolean;
    askForRatingEnabled: boolean;
  } | null
>("automationSettings:get");
const UPSERT_AUTOMATION_SETTINGS_REF = webMutationRef<
  {
    workspaceId: Id<"workspaces">;
    suggestArticlesEnabled?: boolean;
    showReplyTimeEnabled?: boolean;
    collectEmailEnabled?: boolean;
    askForRatingEnabled?: boolean;
  },
  null
>("automationSettings:upsert");
const HOME_CONFIG_QUERY_REF = webQueryRef<WorkspaceArgs, HomeConfig | null>(
  "messengerSettings:getHomeConfig"
);
const UPDATE_HOME_CONFIG_REF = webMutationRef<
  {
    workspaceId: Id<"workspaces">;
    homeConfig: {
      enabled: boolean;
      cards: HomeCard[];
      defaultSpace: HomeDefaultSpace;
      tabs: HomeTab[];
    };
  },
  null
>("messengerSettings:updateHomeConfig");
const TOGGLE_HOME_ENABLED_REF = webMutationRef<
  { workspaceId: Id<"workspaces">; enabled: boolean },
  null
>("messengerSettings:toggleHomeEnabled");
const VISITOR_PUSH_TOKEN_STATS_QUERY_REF = webQueryRef<
  WorkspaceArgs,
  { total: number; ios: number; android: number; uniqueVisitors: number } | null
>("visitorPushTokens:getStats");
const VISITOR_PUSH_TOKENS_WITH_INFO_QUERY_REF = webQueryRef<
  WorkspaceArgs,
  Array<{
    _id: string;
    platform: "ios" | "android";
    visitorId?: Id<"visitors">;
    visitorReadableId?: string;
    visitorName?: string;
    visitorEmail?: string;
    updatedAt: number;
    token: string;
  }>
>("visitorPushTokens:listWithVisitorInfo");
const MY_NOTIFICATION_PREFERENCES_QUERY_REF = webQueryRef<
  WorkspaceArgs,
  {
    effective: {
      newVisitorMessageEmail: boolean;
      newVisitorMessagePush: boolean;
    };
  } | null
>("notificationSettings:getMyPreferences");
const WORKSPACE_NOTIFICATION_DEFAULTS_QUERY_REF = webQueryRef<
  WorkspaceArgs,
  {
    newVisitorMessageEmail: boolean;
    newVisitorMessagePush: boolean;
  } | null
>("notificationSettings:getWorkspaceDefaults");
const UPDATE_MY_NOTIFICATION_PREFERENCES_REF = webMutationRef<
  {
    workspaceId: Id<"workspaces">;
    newVisitorMessageEmail?: boolean;
    newVisitorMessagePush?: boolean;
  },
  null
>("notificationSettings:updateMyPreferences");
const UPDATE_WORKSPACE_NOTIFICATION_DEFAULTS_REF = webMutationRef<
  {
    workspaceId: Id<"workspaces">;
    newVisitorMessageEmail?: boolean;
    newVisitorMessagePush?: boolean;
  },
  null
>("notificationSettings:updateWorkspaceDefaults");
const IDENTITY_SETTINGS_QUERY_REF = webQueryRef<
  WorkspaceArgs,
  { enabled: boolean; mode: "optional" | "required" } | null
>("identityVerification:getSettings");
const IDENTITY_SECRET_QUERY_REF = webQueryRef<
  WorkspaceArgs,
  { secret?: string | null } | null
>("identityVerification:getSecret");
const ENABLE_IDENTITY_REF = webMutationRef<
  WorkspaceArgs,
  { secret?: string | null }
>("identityVerification:enable");
const DISABLE_IDENTITY_REF = webMutationRef<
  { workspaceId: Id<"workspaces">; confirmDisable: boolean },
  null
>("identityVerification:disable");
const UPDATE_IDENTITY_MODE_REF = webMutationRef<
  { workspaceId: Id<"workspaces">; mode: "optional" | "required" },
  null
>("identityVerification:updateMode");
const ROTATE_IDENTITY_SECRET_REF = webMutationRef<
  WorkspaceArgs,
  { secret?: string | null }
>("identityVerification:rotateSecret");
const AUDIT_ACCESS_QUERY_REF = webQueryRef<WorkspaceArgs, AuditAccessRecord>("auditLogs:getAccess");
const AUDIT_LOG_SETTINGS_QUERY_REF = webQueryRef<
  WorkspaceArgs,
  { retentionDays: number } | null
>("auditLogs:getSettings");
const UPDATE_AUDIT_SETTINGS_REF = webMutationRef<
  { workspaceId: Id<"workspaces">; retentionDays: number },
  null
>("auditLogs:updateSettings");
const AUDIT_LOGS_LIST_QUERY_REF = webQueryRef<
  WorkspaceArgs &
    AuditLogFilters & {
      limit: number;
    },
  Array<{
    _id: string;
    action: string;
    timestamp: number;
    actorId?: string;
    actorType?: string;
    actorName?: string;
    actorEmail?: string;
    resourceType?: string;
    resourceId?: string;
    metadata?: unknown;
    details?: unknown;
  }>
>("auditLogs:list");
const AUDIT_ACTIONS_QUERY_REF = webQueryRef<WorkspaceArgs, string[]>("auditLogs:getActions");
const EXPORT_LOGS_QUERY_REF = webQueryRef<
  WorkspaceArgs &
    AuditLogFilters & {
      format: "json";
    },
  { data: unknown; count: number }
>("auditLogs:exportLogs");
const LOG_EXPORT_REF = webMutationRef<
  { workspaceId: Id<"workspaces">; exportType: string; recordCount: number },
  unknown
>("auditLogs:logExport");
const WIDGET_SESSION_SETTINGS_QUERY_REF = webQueryRef<
  WorkspaceArgs,
  { sessionLifetimeMs: number } | null
>("widgetSessions:getSettings");
const UPDATE_WIDGET_SESSION_SETTINGS_REF = webMutationRef<
  { workspaceId: Id<"workspaces">; sessionLifetimeMs: number },
  null
>("widgetSessions:updateSettings");
const INVITE_TO_WORKSPACE_REF = webActionRef<
  InviteToWorkspaceArgs,
  InviteToWorkspaceResult
>("workspaceMembers:inviteToWorkspace");
const UPDATE_ROLE_REF = webMutationRef<UpdateRoleArgs, SuccessResponse>(
  "workspaceMembers:updateRole"
);
const REMOVE_MEMBER_REF = webMutationRef<RemoveMemberArgs, SuccessResponse>(
  "workspaceMembers:remove"
);
const CANCEL_INVITATION_REF = webMutationRef<CancelInvitationArgs, SuccessResponse>(
  "workspaceMembers:cancelInvitation"
);
const TRANSFER_OWNERSHIP_REF = webMutationRef<TransferOwnershipArgs, SuccessResponse>(
  "workspaceMembers:transferOwnership"
);

export function useAIAgentSectionConvex(workspaceId?: Id<"workspaces">) {
  return {
    aiSettings: useWebQuery(AI_SETTINGS_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
    availableModels: useWebQuery(AVAILABLE_MODELS_QUERY_REF, {}),
    updateSettings: useWebMutation(UPDATE_AI_SETTINGS_REF),
  };
}

export function useAutomationSettingsSectionConvex(workspaceId?: Id<"workspaces">) {
  return {
    automationSettings: useWebQuery(
      AUTOMATION_SETTINGS_QUERY_REF,
      workspaceId ? { workspaceId } : "skip"
    ),
    upsertSettings: useWebMutation(UPSERT_AUTOMATION_SETTINGS_REF),
  };
}

export function useHomeSettingsSectionConvex(workspaceId?: Id<"workspaces">) {
  return {
    homeConfig: useWebQuery(HOME_CONFIG_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
    toggleHomeEnabled: useWebMutation(TOGGLE_HOME_ENABLED_REF),
    updateHomeConfig: useWebMutation(UPDATE_HOME_CONFIG_REF),
  };
}

export function useMobileDevicesSectionConvex(workspaceId?: Id<"workspaces">) {
  return {
    devices: useWebQuery(
      VISITOR_PUSH_TOKENS_WITH_INFO_QUERY_REF,
      workspaceId ? { workspaceId } : "skip"
    ),
    stats: useWebQuery(VISITOR_PUSH_TOKEN_STATS_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
  };
}

export function useNotificationSettingsSectionConvex(
  workspaceId?: Id<"workspaces">,
  isAdmin = false
) {
  return {
    myPreferences: useWebQuery(
      MY_NOTIFICATION_PREFERENCES_QUERY_REF,
      workspaceId ? { workspaceId } : "skip"
    ),
    updateMyPreferences: useWebMutation(UPDATE_MY_NOTIFICATION_PREFERENCES_REF),
    updateWorkspaceDefaults: useWebMutation(UPDATE_WORKSPACE_NOTIFICATION_DEFAULTS_REF),
    workspaceDefaults: useWebQuery(
      WORKSPACE_NOTIFICATION_DEFAULTS_QUERY_REF,
      workspaceId && isAdmin ? { workspaceId } : "skip"
    ),
  };
}

export function useSecurityIdentitySettingsCardConvex(workspaceId: Id<"workspaces">) {
  return {
    disableIdentity: useWebMutation(DISABLE_IDENTITY_REF),
    enableIdentity: useWebMutation(ENABLE_IDENTITY_REF),
    identitySecret: useWebQuery(IDENTITY_SECRET_QUERY_REF, { workspaceId }),
    identitySettings: useWebQuery(IDENTITY_SETTINGS_QUERY_REF, { workspaceId }),
    rotateSecret: useWebMutation(ROTATE_IDENTITY_SECRET_REF),
    updateMode: useWebMutation(UPDATE_IDENTITY_MODE_REF),
  };
}

export function useSecuritySettingsSectionConvex(workspaceId?: Id<"workspaces">) {
  const auditAccess = useWebQuery(AUDIT_ACCESS_QUERY_REF, workspaceId ? { workspaceId } : "skip");
  const canManageSecurity =
    workspaceId && auditAccess?.status === "ok" ? auditAccess.canManageSecurity : false;

  return {
    auditAccess,
    auditLogSettings: useWebQuery(
      AUDIT_LOG_SETTINGS_QUERY_REF,
      workspaceId && canManageSecurity ? { workspaceId } : "skip"
    ),
    updateAuditSettings: useWebMutation(UPDATE_AUDIT_SETTINGS_REF),
  };
}

export function useSignedSessionsSettingsConvex(workspaceId: Id<"workspaces">) {
  return {
    settings: useWebQuery(WIDGET_SESSION_SETTINGS_QUERY_REF, { workspaceId }),
    updateSettings: useWebMutation(UPDATE_WIDGET_SESSION_SETTINGS_REF),
  };
}

export function useAuditLogViewerConvex(
  workspaceId: Id<"workspaces">,
  showViewer: boolean,
  filters: AuditLogFilters,
  isExporting: boolean
) {
  const auditAccess = useWebQuery(AUDIT_ACCESS_QUERY_REF, showViewer ? { workspaceId } : "skip");
  const canReadAuditLogs = auditAccess?.status === "ok" ? auditAccess.canRead : false;
  const canExportAuditLogs = auditAccess?.status === "ok" ? auditAccess.canExport : false;

  return {
    auditAccess,
    auditLogs: useWebQuery(
      AUDIT_LOGS_LIST_QUERY_REF,
      showViewer && canReadAuditLogs
        ? {
            workspaceId,
            ...filters,
            limit: 100,
          }
        : "skip"
    ),
    availableActions: useWebQuery(
      AUDIT_ACTIONS_QUERY_REF,
      showViewer && canReadAuditLogs ? { workspaceId } : "skip"
    ),
    canExportAuditLogs,
    canReadAuditLogs,
    exportLogs: useWebQuery(
      EXPORT_LOGS_QUERY_REF,
      isExporting && canReadAuditLogs && canExportAuditLogs
        ? {
            workspaceId,
            ...filters,
            format: "json",
          }
        : "skip"
    ),
    logExportMutation: useWebMutation(LOG_EXPORT_REF),
  };
}

export function useTeamMembersSettingsConvex() {
  return {
    cancelInvitation: useWebMutation(CANCEL_INVITATION_REF),
    inviteToWorkspace: useWebAction(INVITE_TO_WORKSPACE_REF),
    removeMember: useWebMutation(REMOVE_MEMBER_REF),
    transferOwnership: useWebMutation(TRANSFER_OWNERSHIP_REF),
    updateRole: useWebMutation(UPDATE_ROLE_REF),
  };
}
