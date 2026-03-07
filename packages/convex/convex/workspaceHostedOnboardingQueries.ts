import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { getHostedOnboardingWorkspaceForMember } from "./workspaceHostedOnboardingAccess";
import {
  collectHostedOnboardingIntegrationSignals,
  getHostedOnboardingViewWithSignals,
  type HostedOnboardingWorkspaceFields,
} from "./workspaceHostedOnboardingShared";

type HostedOnboardingWorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

export async function getHostedOnboardingStateQueryHandler(
  ctx: QueryCtx,
  args: HostedOnboardingWorkspaceArgs
) {
  const workspace = await getHostedOnboardingWorkspaceForMember(ctx, args.workspaceId);
  if (!workspace) {
    return null;
  }

  const tokenIssuedAt = workspace.hostedOnboardingVerificationTokenIssuedAt ?? null;
  const signals = await collectHostedOnboardingIntegrationSignals(
    ctx,
    args.workspaceId,
    tokenIssuedAt
  );

  return {
    ...getHostedOnboardingViewWithSignals(
      workspace as unknown as HostedOnboardingWorkspaceFields,
      signals.latestRecognizedDetectedAt
    ),
    hasRecognizedInstall: signals.hasRecognizedInstall,
    latestDetectedAt: signals.latestDetectedAt,
    latestRecognizedDetectedAt: signals.latestRecognizedDetectedAt,
    detectedIntegrationCount: signals.signals.length,
  };
}

export async function getHostedOnboardingIntegrationSignalsQueryHandler(
  ctx: QueryCtx,
  args: HostedOnboardingWorkspaceArgs
) {
  const workspace = await getHostedOnboardingWorkspaceForMember(ctx, args.workspaceId);
  if (!workspace) {
    return null;
  }

  const tokenIssuedAt = workspace.hostedOnboardingVerificationTokenIssuedAt ?? null;
  const signals = await collectHostedOnboardingIntegrationSignals(
    ctx,
    args.workspaceId,
    tokenIssuedAt
  );

  return {
    tokenIssuedAt,
    hasRecognizedInstall: signals.hasRecognizedInstall,
    latestDetectedAt: signals.latestDetectedAt,
    latestRecognizedDetectedAt: signals.latestRecognizedDetectedAt,
    integrations: signals.signals,
  };
}
