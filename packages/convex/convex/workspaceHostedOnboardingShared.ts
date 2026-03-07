import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export const HOSTED_ONBOARDING_WIDGET_STEP = "widget_install";

const HOSTED_ONBOARDING_SIGNAL_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const HOSTED_ONBOARDING_SIGNAL_LIMIT = 200;

export type HostedOnboardingStatus = "not_started" | "in_progress" | "completed";

export type HostedOnboardingWorkspaceFields = {
  hostedOnboardingStatus?: HostedOnboardingStatus;
  hostedOnboardingCurrentStep?: number;
  hostedOnboardingCompletedSteps?: string[];
  hostedOnboardingVerificationToken?: string;
  hostedOnboardingVerificationTokenIssuedAt?: number;
  hostedOnboardingWidgetVerifiedAt?: number;
  hostedOnboardingVerificationEvents?: Array<{
    token: string;
    origin?: string;
    currentUrl?: string;
    createdAt: number;
  }>;
  hostedOnboardingUpdatedAt?: number;
};

export function getHostedOnboardingView(workspace: HostedOnboardingWorkspaceFields) {
  return getHostedOnboardingViewWithSignals(workspace, null);
}

export function getHostedOnboardingViewWithSignals(
  workspace: HostedOnboardingWorkspaceFields,
  latestDetectedAt: number | null
) {
  const completedSteps = workspace.hostedOnboardingCompletedSteps ?? [];
  const hasWidgetStepComplete = completedSteps.includes(HOSTED_ONBOARDING_WIDGET_STEP);
  const status: HostedOnboardingStatus =
    workspace.hostedOnboardingStatus ?? (hasWidgetStepComplete ? "completed" : "not_started");
  const currentStep = workspace.hostedOnboardingCurrentStep ?? (hasWidgetStepComplete ? 1 : 0);
  const storedWidgetVerifiedAt = workspace.hostedOnboardingWidgetVerifiedAt ?? null;
  const widgetVerifiedAt =
    storedWidgetVerifiedAt === null
      ? latestDetectedAt
      : latestDetectedAt === null
        ? storedWidgetVerifiedAt
        : Math.max(storedWidgetVerifiedAt, latestDetectedAt);
  const tokenIssuedAt = workspace.hostedOnboardingVerificationTokenIssuedAt ?? null;
  const isWidgetVerified =
    widgetVerifiedAt !== null && (tokenIssuedAt === null || widgetVerifiedAt >= tokenIssuedAt);

  return {
    status,
    currentStep,
    completedSteps,
    onboardingVerificationToken: workspace.hostedOnboardingVerificationToken ?? null,
    verificationToken: workspace.hostedOnboardingVerificationToken ?? null,
    verificationTokenIssuedAt: tokenIssuedAt,
    widgetVerifiedAt,
    isWidgetVerified,
    updatedAt: workspace.hostedOnboardingUpdatedAt ?? null,
  };
}

export type HostedOnboardingIntegrationSignal = {
  id: string;
  clientType: string;
  clientVersion: string | null;
  clientIdentifier: string | null;
  origin: string | null;
  currentUrl: string | null;
  devicePlatform: string | null;
  sessionCount: number;
  activeSessionCount: number;
  lastSeenAt: number;
  latestSessionExpiresAt: number;
  matchesCurrentVerificationWindow: boolean;
  isActiveNow: boolean;
};

export type HostedOnboardingSignalsResult = {
  latestDetectedAt: number | null;
  latestRecognizedDetectedAt: number | null;
  hasRecognizedInstall: boolean;
  signals: HostedOnboardingIntegrationSignal[];
};

function normalizeHostedOnboardingSignalValue(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export async function collectHostedOnboardingIntegrationSignals(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  tokenIssuedAt: number | null
): Promise<HostedOnboardingSignalsResult> {
  const now = Date.now();
  const cutoff = now - HOSTED_ONBOARDING_SIGNAL_LOOKBACK_MS;
  const sessions = await ctx.db
    .query("widgetSessions")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .order("desc")
    .take(HOSTED_ONBOARDING_SIGNAL_LIMIT);

  const signalsById = new Map<string, HostedOnboardingIntegrationSignal>();

  for (const session of sessions) {
    if (session.createdAt < cutoff) {
      continue;
    }

    const clientType =
      normalizeHostedOnboardingSignalValue(session.clientType) ??
      (session.devicePlatform === "ios" || session.devicePlatform === "android"
        ? "mobile_sdk"
        : "web_widget");
    const clientVersion = normalizeHostedOnboardingSignalValue(session.clientVersion);
    const clientIdentifier = normalizeHostedOnboardingSignalValue(session.clientIdentifier);
    const origin = normalizeHostedOnboardingSignalValue(session.origin);
    const currentUrl = normalizeHostedOnboardingSignalValue(session.currentUrl);
    const devicePlatform = normalizeHostedOnboardingSignalValue(session.devicePlatform);

    const signalId = [
      clientType,
      clientVersion ?? "unknown",
      clientIdentifier ?? "unknown",
      origin ?? "unknown",
      devicePlatform ?? "unknown",
    ].join("|");

    const existing = signalsById.get(signalId);
    const isActive = session.expiresAt > now;
    const matchesCurrentVerificationWindow =
      tokenIssuedAt === null || session.createdAt >= tokenIssuedAt;

    if (!existing) {
      signalsById.set(signalId, {
        id: signalId,
        clientType,
        clientVersion,
        clientIdentifier,
        origin,
        currentUrl,
        devicePlatform,
        sessionCount: 1,
        activeSessionCount: isActive ? 1 : 0,
        lastSeenAt: session.createdAt,
        latestSessionExpiresAt: session.expiresAt,
        matchesCurrentVerificationWindow,
        isActiveNow: isActive,
      });
      continue;
    }

    existing.sessionCount += 1;
    if (isActive) {
      existing.activeSessionCount += 1;
    }
    if (session.createdAt > existing.lastSeenAt) {
      existing.lastSeenAt = session.createdAt;
      existing.currentUrl = currentUrl;
    }
    if (session.expiresAt > existing.latestSessionExpiresAt) {
      existing.latestSessionExpiresAt = session.expiresAt;
    }
    existing.matchesCurrentVerificationWindow =
      existing.matchesCurrentVerificationWindow || matchesCurrentVerificationWindow;
    existing.isActiveNow = existing.latestSessionExpiresAt > now;
  }

  const signals = Array.from(signalsById.values()).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  const latestDetectedAt = signals.length > 0 ? signals[0].lastSeenAt : null;
  const recognizedSignals = signals.filter(
    (signal) => signal.isActiveNow && signal.matchesCurrentVerificationWindow
  );
  const latestRecognizedDetectedAt =
    recognizedSignals.length > 0 ? recognizedSignals[0].lastSeenAt : null;
  const hasRecognizedInstall = recognizedSignals.length > 0;

  return {
    latestDetectedAt,
    latestRecognizedDetectedAt,
    hasRecognizedInstall,
    signals,
  };
}

export function generateHostedOnboardingVerificationToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `onb_${hex}`;
}
