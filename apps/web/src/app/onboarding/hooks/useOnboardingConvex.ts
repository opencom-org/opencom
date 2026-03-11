"use client";

import type { Id } from "@opencom/convex/dataModel";
import {
  useWebMutation,
  useWebQuery,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type CompleteWidgetStepArgs = {
  workspaceId: Id<"workspaces">;
  token?: string;
};

export type HostedOnboardingState = {
  status?: string;
  verificationToken?: string | null;
  isWidgetVerified?: boolean;
} | null;

export type HostedOnboardingIntegrationSignals = {
  integrations?: Array<{
    id: string;
    clientType: string;
    clientVersion?: string;
    detectedAt?: number | null;
    isActiveNow?: boolean;
    matchesCurrentVerificationWindow?: boolean;
    origin?: string;
    currentUrl?: string;
    clientIdentifier?: string;
    lastSeenAt?: number | null;
    activeSessionCount?: number;
  }>;
} | null;

const HOSTED_ONBOARDING_STATE_QUERY_REF = webQueryRef<WorkspaceArgs, HostedOnboardingState>(
  "workspaces:getHostedOnboardingState"
);
const ONBOARDING_INTEGRATION_SIGNALS_QUERY_REF = webQueryRef<
  WorkspaceArgs,
  HostedOnboardingIntegrationSignals
>("workspaces:getHostedOnboardingIntegrationSignals");
const START_HOSTED_ONBOARDING_REF = webMutationRef<WorkspaceArgs, unknown>(
  "workspaces:startHostedOnboarding"
);
const ISSUE_VERIFICATION_TOKEN_REF = webMutationRef<WorkspaceArgs, { token: string }>(
  "workspaces:issueHostedOnboardingVerificationToken"
);
const COMPLETE_WIDGET_STEP_REF = webMutationRef<CompleteWidgetStepArgs, { success: boolean }>(
  "workspaces:completeHostedOnboardingWidgetStep"
);

export function useOnboardingConvex(workspaceId?: Id<"workspaces"> | null) {
  return {
    completeWidgetStep: useWebMutation(COMPLETE_WIDGET_STEP_REF),
    integrationSignals: useWebQuery(
      ONBOARDING_INTEGRATION_SIGNALS_QUERY_REF,
      workspaceId ? { workspaceId } : "skip"
    ),
    issueVerificationToken: useWebMutation(ISSUE_VERIFICATION_TOKEN_REF),
    onboardingState: useWebQuery(
      HOSTED_ONBOARDING_STATE_QUERY_REF,
      workspaceId ? { workspaceId } : "skip"
    ),
    startHostedOnboarding: useWebMutation(START_HOSTED_ONBOARDING_REF),
  };
}
