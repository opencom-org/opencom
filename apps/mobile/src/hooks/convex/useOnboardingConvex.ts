import type { Id } from "@opencom/convex/dataModel";
import { makeFunctionReference } from "convex/server";
import { useMobileMutation, useMobileQuery } from "../../lib/convex/hooks";
import type {
  CompleteHostedOnboardingWidgetStepResult,
  HostedOnboardingIntegrationSignals,
  HostedOnboardingState,
  HostedOnboardingVerificationTokenResult,
  HostedOnboardingView,
} from "./types";

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type CompleteWidgetStepArgs = {
  workspaceId: Id<"workspaces">;
  token?: string;
};

const HOSTED_ONBOARDING_STATE_QUERY_REF = makeFunctionReference<
  "query",
  WorkspaceArgs,
  HostedOnboardingState
>("workspaces:getHostedOnboardingState");
const HOSTED_ONBOARDING_SIGNALS_QUERY_REF = makeFunctionReference<
  "query",
  WorkspaceArgs,
  HostedOnboardingIntegrationSignals
>("workspaces:getHostedOnboardingIntegrationSignals");
const START_HOSTED_ONBOARDING_MUTATION_REF = makeFunctionReference<
  "mutation",
  WorkspaceArgs,
  HostedOnboardingView
>("workspaces:startHostedOnboarding");
const ISSUE_VERIFICATION_TOKEN_MUTATION_REF = makeFunctionReference<
  "mutation",
  WorkspaceArgs,
  HostedOnboardingVerificationTokenResult
>("workspaces:issueHostedOnboardingVerificationToken");
const COMPLETE_WIDGET_STEP_MUTATION_REF = makeFunctionReference<
  "mutation",
  CompleteWidgetStepArgs,
  CompleteHostedOnboardingWidgetStepResult
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
