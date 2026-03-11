import type { Id } from "@opencom/convex/dataModel";
import {
  mobileMutationRef,
  mobileQueryRef,
  useMobileMutation,
  useMobileQuery,
} from "../../lib/convex/hooks";
import type { HostedOnboardingIntegrationSignals, HostedOnboardingState } from "./types";

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type CompleteWidgetStepArgs = {
  workspaceId: Id<"workspaces">;
  token?: string;
};

const HOSTED_ONBOARDING_STATE_QUERY_REF = mobileQueryRef<WorkspaceArgs, HostedOnboardingState>(
  "workspaces:getHostedOnboardingState"
);
const HOSTED_ONBOARDING_SIGNALS_QUERY_REF = mobileQueryRef<
  WorkspaceArgs,
  HostedOnboardingIntegrationSignals
>("workspaces:getHostedOnboardingIntegrationSignals");
const START_HOSTED_ONBOARDING_MUTATION_REF = mobileMutationRef<WorkspaceArgs, null>(
  "workspaces:startHostedOnboarding"
);
const ISSUE_VERIFICATION_TOKEN_MUTATION_REF = mobileMutationRef<WorkspaceArgs, { token: string }>(
  "workspaces:issueHostedOnboardingVerificationToken"
);
const COMPLETE_WIDGET_STEP_MUTATION_REF = mobileMutationRef<
  CompleteWidgetStepArgs,
  { success: boolean }
>("workspaces:completeHostedOnboardingWidgetStep");

export function useOnboardingConvex(workspaceId?: Id<"workspaces"> | null) {
  return {
    completeWidgetStep: useMobileMutation(COMPLETE_WIDGET_STEP_MUTATION_REF),
    integrationSignals: useMobileQuery(
      HOSTED_ONBOARDING_SIGNALS_QUERY_REF,
      workspaceId ? { workspaceId } : "skip"
    ),
    issueVerificationToken: useMobileMutation(ISSUE_VERIFICATION_TOKEN_MUTATION_REF),
    onboardingState: useMobileQuery(
      HOSTED_ONBOARDING_STATE_QUERY_REF,
      workspaceId ? { workspaceId } : "skip"
    ),
    startHostedOnboarding: useMobileMutation(START_HOSTED_ONBOARDING_MUTATION_REF),
  };
}
