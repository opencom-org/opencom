import type { Id } from "@opencom/convex/dataModel";
import {
  mobileMutationRef,
  mobileQueryRef,
  useMobileMutation,
  useMobileQuery,
} from "../../lib/convex/hooks";
import type { HostedOnboardingState, MobileCurrentUserRecord } from "./types";

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

const CURRENT_USER_QUERY_REF = mobileQueryRef<Record<string, never>, MobileCurrentUserRecord>(
  "auth:currentUser"
);
const SWITCH_WORKSPACE_MUTATION_REF = mobileMutationRef<SwitchWorkspaceArgs, null>(
  "auth:switchWorkspace"
);
const COMPLETE_SIGNUP_PROFILE_MUTATION_REF = mobileMutationRef<CompleteSignupProfileArgs, null>(
  "auth:completeSignupProfile"
);
const UNREGISTER_ALL_PUSH_TOKENS_MUTATION_REF = mobileMutationRef<Record<string, never>, null>(
  "pushTokens:unregisterAllForCurrentUser"
);
const HOSTED_ONBOARDING_STATE_QUERY_REF = mobileQueryRef<WorkspaceArgs, HostedOnboardingState>(
  "workspaces:getHostedOnboardingState"
);

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
