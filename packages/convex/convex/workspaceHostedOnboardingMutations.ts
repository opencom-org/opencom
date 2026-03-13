import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import type { AuthenticatedUser } from "./lib/authWrappers";
import { validateVisitorOrigin } from "./originValidation";
import { requireHostedOnboardingWorkspace } from "./workspaceHostedOnboardingAccess";
import {
  collectHostedOnboardingIntegrationSignals,
  generateHostedOnboardingVerificationToken,
  getHostedOnboardingView,
  getHostedOnboardingViewWithSignals,
  HOSTED_ONBOARDING_WIDGET_STEP,
  type HostedOnboardingWorkspaceFields,
} from "./workspaceHostedOnboardingShared";

type HostedOnboardingAuthMutationCtx = MutationCtx & { user: AuthenticatedUser };

type HostedOnboardingWorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type CompleteHostedOnboardingWidgetStepArgs = HostedOnboardingWorkspaceArgs & {
  token?: string;
};

type RecordHostedOnboardingVerificationEventArgs = HostedOnboardingWorkspaceArgs & {
  token: string;
  origin?: string;
  currentUrl?: string;
};

export async function startHostedOnboardingMutationHandler(
  ctx: HostedOnboardingAuthMutationCtx,
  args: HostedOnboardingWorkspaceArgs
) {
  const workspace = await requireHostedOnboardingWorkspace(ctx, args.workspaceId);
  const onboarding = workspace as unknown as HostedOnboardingWorkspaceFields;
  const now = Date.now();
  const view = getHostedOnboardingView(onboarding);
  if (view.status === "completed") {
    return view;
  }

  const patch: Partial<HostedOnboardingWorkspaceFields> = {
    hostedOnboardingStatus: "in_progress",
    hostedOnboardingCurrentStep: view.currentStep,
    hostedOnboardingCompletedSteps: view.completedSteps,
    hostedOnboardingUpdatedAt: now,
  };

  await ctx.db.patch(args.workspaceId, patch);

  const updatedWorkspace = await requireHostedOnboardingWorkspace(ctx, args.workspaceId);
  return getHostedOnboardingView(updatedWorkspace as unknown as HostedOnboardingWorkspaceFields);
}

export async function issueHostedOnboardingVerificationTokenMutationHandler(
  ctx: HostedOnboardingAuthMutationCtx,
  args: HostedOnboardingWorkspaceArgs
) {
  const workspace = await requireHostedOnboardingWorkspace(ctx, args.workspaceId);
  const onboarding = workspace as unknown as HostedOnboardingWorkspaceFields;
  const view = getHostedOnboardingView(onboarding);
  const now = Date.now();
  const token = generateHostedOnboardingVerificationToken();

  const patch: Partial<HostedOnboardingWorkspaceFields> = {
    hostedOnboardingVerificationToken: token,
    hostedOnboardingVerificationTokenIssuedAt: now,
    hostedOnboardingStatus: view.status === "completed" ? "completed" : "in_progress",
    hostedOnboardingCurrentStep: view.currentStep,
    hostedOnboardingCompletedSteps: view.completedSteps,
    hostedOnboardingUpdatedAt: now,
  };

  await ctx.db.patch(args.workspaceId, patch);

  return {
    token,
    issuedAt: now,
  };
}

export async function recordHostedOnboardingVerificationEventMutationHandler(
  ctx: MutationCtx,
  args: RecordHostedOnboardingVerificationEventArgs
) {
  const workspace = await ctx.db.get(args.workspaceId);
  if (!workspace) {
    return { accepted: false as const, reason: "workspace_not_found" as const };
  }

  const onboarding = workspace as unknown as HostedOnboardingWorkspaceFields;
  if (!onboarding.hostedOnboardingVerificationToken) {
    return { accepted: false as const, reason: "token_not_issued" as const };
  }

  if (onboarding.hostedOnboardingVerificationToken !== args.token) {
    return { accepted: false as const, reason: "token_mismatch" as const };
  }

  const originValidation = await validateVisitorOrigin(ctx, args.workspaceId, args.origin);
  if (!originValidation.valid) {
    return { accepted: false as const, reason: "origin_invalid" as const };
  }

  const now = Date.now();
  const existingEvents = onboarding.hostedOnboardingVerificationEvents ?? [];
  const nextEvents = [
    ...existingEvents,
    {
      token: args.token,
      origin: args.origin,
      currentUrl: args.currentUrl,
      createdAt: now,
    },
  ].slice(-20);

  const patch: Partial<HostedOnboardingWorkspaceFields> = {
    hostedOnboardingVerificationEvents: nextEvents,
    hostedOnboardingWidgetVerifiedAt: now,
    hostedOnboardingUpdatedAt: now,
  };

  await ctx.db.patch(args.workspaceId, patch);

  return {
    accepted: true as const,
    verifiedAt: now,
  };
}

export async function completeHostedOnboardingWidgetStepMutationHandler(
  ctx: HostedOnboardingAuthMutationCtx,
  args: CompleteHostedOnboardingWidgetStepArgs
) {
  const workspace = await requireHostedOnboardingWorkspace(ctx, args.workspaceId);
  const onboarding = workspace as unknown as HostedOnboardingWorkspaceFields;
  if (
    args.token &&
    onboarding.hostedOnboardingVerificationToken &&
    args.token !== onboarding.hostedOnboardingVerificationToken
  ) {
    return { success: false as const, reason: "token_mismatch" as const };
  }

  const signals = await collectHostedOnboardingIntegrationSignals(
    ctx,
    args.workspaceId,
    onboarding.hostedOnboardingVerificationTokenIssuedAt ?? null
  );
  const view = getHostedOnboardingViewWithSignals(onboarding, signals.latestRecognizedDetectedAt);
  if (!view.isWidgetVerified) {
    return { success: false as const, reason: "not_verified" as const };
  }

  const completedSteps = Array.from(
    new Set([...view.completedSteps, HOSTED_ONBOARDING_WIDGET_STEP])
  );
  const now = Date.now();

  const patch: Partial<HostedOnboardingWorkspaceFields> = {
    hostedOnboardingStatus: "completed",
    hostedOnboardingCurrentStep: 1,
    hostedOnboardingCompletedSteps: completedSteps,
    hostedOnboardingUpdatedAt: now,
  };

  await ctx.db.patch(args.workspaceId, patch);

  return {
    success: true as const,
    status: "completed" as const,
    currentStep: 1,
    completedSteps,
    updatedAt: now,
  };
}
