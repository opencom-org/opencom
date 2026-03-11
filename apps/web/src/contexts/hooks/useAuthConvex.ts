"use client";

import type { Id } from "@opencom/convex/dataModel";
import {
  useWebMutation,
  useWebQuery,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";
import type { User, Workspace } from "../AuthContext";

type CurrentUserRecord = {
  user: User | null;
  workspaces: Workspace[];
} | null;

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

type HostedOnboardingStateRecord = {
  isWidgetVerified: boolean;
};

const CURRENT_USER_QUERY_REF = webQueryRef<Record<string, never>, CurrentUserRecord>(
  "auth:currentUser"
);
const SWITCH_WORKSPACE_REF = webMutationRef<SwitchWorkspaceArgs, unknown>("auth:switchWorkspace");
const COMPLETE_SIGNUP_PROFILE_REF = webMutationRef<CompleteSignupProfileArgs, unknown>(
  "auth:completeSignupProfile"
);
const HOSTED_ONBOARDING_STATE_QUERY_REF = webQueryRef<
  WorkspaceArgs,
  HostedOnboardingStateRecord
>("workspaces:getHostedOnboardingState");

export function useAuthConvex() {
  return {
    completeSignupProfileMutation: useWebMutation(COMPLETE_SIGNUP_PROFILE_REF),
    convexAuthUser: useWebQuery(CURRENT_USER_QUERY_REF, {}),
    switchWorkspaceMutation: useWebMutation(SWITCH_WORKSPACE_REF),
  };
}

export function useAuthHomeRouteConvex(workspaceIdForHomeRouting?: Id<"workspaces"> | null) {
  return {
    hostedOnboardingState: useWebQuery(
      HOSTED_ONBOARDING_STATE_QUERY_REF,
      workspaceIdForHomeRouting ? { workspaceId: workspaceIdForHomeRouting } : "skip"
    ),
  };
}
