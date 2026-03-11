import type { Id } from "@opencom/convex/dataModel";
import {
  mobileActionRef,
  mobileMutationRef,
  mobileQueryRef,
  useMobileAction,
  useMobileMutation,
  useMobileQuery,
} from "../../lib/convex/hooks";
import type {
  InviteToWorkspaceResult,
  MobileNotificationPreferencesRecord,
  MobilePushTokenRecord,
  MobileWorkspaceMemberRecord,
  MobileWorkspaceRecord,
} from "./types";

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type WorkspaceGetArgs = {
  id: Id<"workspaces">;
};

type PushTokensByUserArgs = {
  userId: Id<"users">;
};

type UpdateAllowedOriginsArgs = {
  workspaceId: Id<"workspaces">;
  allowedOrigins: string[];
};

type InviteToWorkspaceArgs = {
  workspaceId: Id<"workspaces">;
  email: string;
  role: "admin" | "agent";
  baseUrl: string;
};

type UpdateWorkspaceRoleArgs = {
  membershipId: Id<"workspaceMembers">;
  role: "admin" | "agent";
};

type RemoveWorkspaceMemberArgs = {
  membershipId: Id<"workspaceMembers">;
};

type UpdateSignupSettingsArgs = {
  workspaceId: Id<"workspaces">;
  signupMode: "invite-only" | "domain-allowlist";
  allowedDomains: string[];
};

type UpdateMyNotificationPreferencesArgs = {
  workspaceId: Id<"workspaces">;
  muted: boolean;
};

const MY_NOTIFICATION_PREFERENCES_QUERY_REF = mobileQueryRef<
  WorkspaceArgs,
  MobileNotificationPreferencesRecord
>("notificationSettings:getMyPreferences");
const WORKSPACE_GET_QUERY_REF = mobileQueryRef<WorkspaceGetArgs, MobileWorkspaceRecord>(
  "workspaces:get"
);
const WORKSPACE_MEMBERS_LIST_QUERY_REF = mobileQueryRef<
  WorkspaceArgs,
  MobileWorkspaceMemberRecord[]
>("workspaceMembers:listByWorkspace");
const PUSH_TOKENS_BY_USER_QUERY_REF = mobileQueryRef<PushTokensByUserArgs, MobilePushTokenRecord[]>(
  "pushTokens:getByUser"
);
const UPDATE_ALLOWED_ORIGINS_MUTATION_REF = mobileMutationRef<UpdateAllowedOriginsArgs, null>(
  "workspaces:updateAllowedOrigins"
);
const INVITE_TO_WORKSPACE_ACTION_REF = mobileActionRef<
  InviteToWorkspaceArgs,
  InviteToWorkspaceResult
>("workspaceMembers:inviteToWorkspace");
const UPDATE_WORKSPACE_ROLE_MUTATION_REF = mobileMutationRef<UpdateWorkspaceRoleArgs, null>(
  "workspaceMembers:updateRole"
);
const REMOVE_WORKSPACE_MEMBER_MUTATION_REF = mobileMutationRef<RemoveWorkspaceMemberArgs, null>(
  "workspaceMembers:remove"
);
const UPDATE_SIGNUP_SETTINGS_MUTATION_REF = mobileMutationRef<UpdateSignupSettingsArgs, null>(
  "workspaces:updateSignupSettings"
);
const UPDATE_MY_NOTIFICATION_PREFERENCES_MUTATION_REF = mobileMutationRef<
  UpdateMyNotificationPreferencesArgs,
  null
>("notificationSettings:updateMyPreferences");

type UseSettingsConvexOptions = {
  workspaceId?: Id<"workspaces"> | null;
  userId?: Id<"users"> | null;
};

export function useSettingsConvex({ workspaceId, userId }: UseSettingsConvexOptions) {
  return {
    inviteToWorkspace: useMobileAction(INVITE_TO_WORKSPACE_ACTION_REF),
    members: useMobileQuery(
      WORKSPACE_MEMBERS_LIST_QUERY_REF,
      workspaceId ? { workspaceId } : "skip"
    ),
    myNotificationPreferences: useMobileQuery(
      MY_NOTIFICATION_PREFERENCES_QUERY_REF,
      workspaceId ? { workspaceId } : "skip"
    ),
    pushTokens: useMobileQuery(PUSH_TOKENS_BY_USER_QUERY_REF, userId ? { userId } : "skip"),
    removeMember: useMobileMutation(REMOVE_WORKSPACE_MEMBER_MUTATION_REF),
    updateAllowedOrigins: useMobileMutation(UPDATE_ALLOWED_ORIGINS_MUTATION_REF),
    updateMyNotificationPreferences: useMobileMutation(
      UPDATE_MY_NOTIFICATION_PREFERENCES_MUTATION_REF
    ),
    updateRole: useMobileMutation(UPDATE_WORKSPACE_ROLE_MUTATION_REF),
    updateSignupSettings: useMobileMutation(UPDATE_SIGNUP_SETTINGS_MUTATION_REF),
    workspace: useMobileQuery(WORKSPACE_GET_QUERY_REF, workspaceId ? { id: workspaceId } : "skip"),
  };
}
