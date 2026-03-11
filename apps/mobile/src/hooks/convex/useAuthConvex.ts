import type { Id } from "@opencom/convex/dataModel";
import { makeFunctionReference } from "convex/server";
import { useMobileMutation, useMobileQuery } from "../../lib/convex/hooks";
import type { HostedOnboardingState, MobileAuthUser, MobileCurrentUserRecord } from "./types";

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type SwitchWorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type CompleteSignupProfileArgs = {
  name?: string;
  workspaceName?: string;
};

type SwitchWorkspaceResult = {
  user: MobileAuthUser;
};

type CompleteSignupProfileResult = {
  success: true;
  userNameUpdated: boolean;
  workspaceNameUpdated: boolean;
};

type UnregisterAllPushTokensResult = {
  success: true;
  removed: number;
};

const CURRENT_USER_QUERY_REF = makeFunctionReference<
  "query",
  Record<string, never>,
  MobileCurrentUserRecord
>("auth:currentUser");
const SWITCH_WORKSPACE_MUTATION_REF = makeFunctionReference<
  "mutation",
  SwitchWorkspaceArgs,
  SwitchWorkspaceResult
>("auth:switchWorkspace");
const COMPLETE_SIGNUP_PROFILE_MUTATION_REF = makeFunctionReference<
  "mutation",
  CompleteSignupProfileArgs,
  CompleteSignupProfileResult
>("auth:completeSignupProfile");
const UNREGISTER_ALL_PUSH_TOKENS_MUTATION_REF = makeFunctionReference<
  "mutation",
  Record<string, never>,
  UnregisterAllPushTokensResult
>("pushTokens:unregisterAllForCurrentUser");
const HOSTED_ONBOARDING_STATE_QUERY_REF = makeFunctionReference<
  "query",
  WorkspaceArgs,
  HostedOnboardingState
>("workspaces:getHostedOnboardingState");

export function useAuthContextConvex() {
  return {
    completeSignupProfile: useMobileMutation(COMPLETE_SIGNUP_PROFILE_MUTATION_REF),
    currentUser: useMobileQuery(CURRENT_USER_QUERY_REF, {}),
    switchWorkspace: useMobileMutation(SWITCH_WORKSPACE_MUTATION_REF),
    unregisterAllPushTokens: useMobileMutation(UNREGISTER_ALL_PUSH_TOKENS_MUTATION_REF),
  };
}

export function useAuthHomeRouteConvex(
  workspaceIdForHomeRouting?: Id<"workspaces"> | null,
  enabled = true
) {
  return {
    hostedOnboardingState: useMobileQuery(
      HOSTED_ONBOARDING_STATE_QUERY_REF,
      enabled && workspaceIdForHomeRouting ? { workspaceId: workspaceIdForHomeRouting } : "skip"
    ),
  };
}
