import type { Id } from "@opencom/convex/dataModel";
import { makeFunctionReference } from "convex/server";
import { useMobileAction, useMobileMutation, useMobileQuery } from "../../lib/convex/hooks";
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

type MutationSuccessResult = {
  success: true;
};

const MY_NOTIFICATION_PREFERENCES_QUERY_REF = makeFunctionReference<
  "query",
  WorkspaceArgs,
  MobileNotificationPreferencesRecord
>("notificationSettings:getMyPreferences");
const WORKSPACE_GET_QUERY_REF = makeFunctionReference<
  "query",
  WorkspaceGetArgs,
  MobileWorkspaceRecord
>("workspaces:get");
const WORKSPACE_MEMBERS_LIST_QUERY_REF = makeFunctionReference<
  "query",
  WorkspaceArgs,
  MobileWorkspaceMemberRecord[]
>("workspaceMembers:listByWorkspace");
const PUSH_TOKENS_BY_USER_QUERY_REF = makeFunctionReference<
  "query",
  PushTokensByUserArgs,
  MobilePushTokenRecord[]
>("pushTokens:getByUser");
const UPDATE_ALLOWED_ORIGINS_MUTATION_REF = makeFunctionReference<
  "mutation",
  UpdateAllowedOriginsArgs,
  void
>("workspaces:updateAllowedOrigins");
const INVITE_TO_WORKSPACE_ACTION_REF = makeFunctionReference<
  "action",
  InviteToWorkspaceArgs,
  InviteToWorkspaceResult
>("workspaceMembers:inviteToWorkspace");
const UPDATE_WORKSPACE_ROLE_MUTATION_REF = makeFunctionReference<
  "mutation",
  UpdateWorkspaceRoleArgs,
  MutationSuccessResult
>("workspaceMembers:updateRole");
const REMOVE_WORKSPACE_MEMBER_MUTATION_REF = makeFunctionReference<
  "mutation",
  RemoveWorkspaceMemberArgs,
  MutationSuccessResult
>("workspaceMembers:remove");
const UPDATE_SIGNUP_SETTINGS_MUTATION_REF = makeFunctionReference<
  "mutation",
  UpdateSignupSettingsArgs,
  void
>("workspaces:updateSignupSettings");
const UPDATE_MY_NOTIFICATION_PREFERENCES_MUTATION_REF = makeFunctionReference<
  "mutation",
  UpdateMyNotificationPreferencesArgs,
  Id<"notificationPreferences">
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
