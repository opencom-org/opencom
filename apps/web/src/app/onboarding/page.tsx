"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@opencom/convex";
import { Button, Card } from "@opencom/ui";
import { AppLayout } from "@/components/AppLayout";
import { WidgetInstallGuide } from "@/components/WidgetInstallGuide";
import { useAuth } from "@/contexts/AuthContext";
import { useBackend } from "@/contexts/BackendContext";

type VerificationStatus = "idle" | "checking" | "success" | "error";

const VERIFY_TIMEOUT_MS = 15000;

function formatTimestamp(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "unknown";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatClientType(clientType: string): string {
  if (clientType === "web_widget") {
    return "Web widget";
  }
  if (clientType === "mobile_sdk") {
    return "Mobile SDK";
  }
  return clientType.replace(/_/g, " ");
}

function OnboardingContent(): React.JSX.Element {
  const { activeWorkspace } = useAuth();
  const { activeBackend } = useBackend();
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("idle");
  const [verificationMessage, setVerificationMessage] = useState<string>("");
  const [localOnboardingVerificationToken, setLocalOnboardingVerificationToken] = useState<
    string | null
  >(null);
  const [tokenModeEnabled, setTokenModeEnabled] = useState(false);
  const startRequestedRef = useRef(false);
  const verifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onboardingState = useQuery(
    api.workspaces.getHostedOnboardingState,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );
  const integrationSignals = useQuery(
    api.workspaces.getHostedOnboardingIntegrationSignals,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const startHostedOnboarding = useMutation(api.workspaces.startHostedOnboarding);
  const issueVerificationToken = useMutation(api.workspaces.issueHostedOnboardingVerificationToken);
  const completeWidgetStep = useMutation(api.workspaces.completeHostedOnboardingWidgetStep);

  useEffect(() => {
    if (!onboardingState?.verificationToken) {
      return;
    }

    setLocalOnboardingVerificationToken(onboardingState.verificationToken);
    setTokenModeEnabled(true);
  }, [onboardingState?.verificationToken]);

  useEffect(() => {
    if (
      !activeWorkspace?._id ||
      !onboardingState ||
      onboardingState.status !== "not_started" ||
      startRequestedRef.current
    ) {
      return;
    }

    startRequestedRef.current = true;
    void startHostedOnboarding({ workspaceId: activeWorkspace._id }).finally(() => {
      startRequestedRef.current = false;
    });
  }, [activeWorkspace?._id, onboardingState, startHostedOnboarding]);

  useEffect(() => {
    if (
      verificationStatus !== "checking" ||
      !activeWorkspace?._id ||
      !onboardingState?.isWidgetVerified
    ) {
      return;
    }

    let cancelled = false;
    void completeWidgetStep({
      workspaceId: activeWorkspace._id,
      token: onboardingState.verificationToken ?? undefined,
    }).then((result) => {
      if (cancelled) {
        return;
      }

      if (result.success) {
        setVerificationStatus("success");
        setVerificationMessage("Widget detected and onboarding step completed.");
      } else {
        setVerificationStatus("error");
        setVerificationMessage("Widget was detected, but completion failed. Please retry.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    verificationStatus,
    onboardingState?.isWidgetVerified,
    onboardingState?.verificationToken,
    activeWorkspace?._id,
    completeWidgetStep,
  ]);

  useEffect(() => {
    if (verificationStatus !== "checking") {
      return;
    }

    verifyTimeoutRef.current = setTimeout(() => {
      setVerificationStatus("error");
      setVerificationMessage(
        "No active widget/SDK installation detected yet. Confirm the snippet is live, then retry."
      );
    }, VERIFY_TIMEOUT_MS);

    return () => {
      if (verifyTimeoutRef.current) {
        clearTimeout(verifyTimeoutRef.current);
        verifyTimeoutRef.current = null;
      }
    };
  }, [verificationStatus]);

  const handleVerify = async () => {
    if (!activeWorkspace?._id) {
      return;
    }

    if (onboardingState?.isWidgetVerified) {
      const completion = await completeWidgetStep({
        workspaceId: activeWorkspace._id,
        token: onboardingState.verificationToken ?? localOnboardingVerificationToken ?? undefined,
      });

      if (completion.success) {
        setVerificationStatus("success");
        setVerificationMessage("Widget already detected and this step is complete.");
      } else {
        setVerificationStatus("error");
        setVerificationMessage("Widget is detected, but completion failed. Please retry.");
      }
      return;
    }

    setVerificationStatus("checking");
    setVerificationMessage("Checking for active web or mobile widget sessions...");
  };

  const handleEnableTokenMode = async () => {
    if (!activeWorkspace?._id) {
      return;
    }

    if (!onboardingState?.verificationToken && !localOnboardingVerificationToken) {
      const issued = await issueVerificationToken({ workspaceId: activeWorkspace._id });
      setLocalOnboardingVerificationToken(issued.token);
      setVerificationMessage(
        "Token verification enabled. Reinstall/update the snippet with the token and verify again."
      );
      setVerificationStatus("idle");
    }

    setTokenModeEnabled(true);
  };

  const handleRegenerateToken = async () => {
    if (!activeWorkspace?._id) {
      return;
    }

    const issued = await issueVerificationToken({ workspaceId: activeWorkspace._id });
    setLocalOnboardingVerificationToken(issued.token);
    setTokenModeEnabled(true);
    setVerificationStatus("idle");
    setVerificationMessage(
      "Generated a new onboarding verification token. Update the snippet and verify again."
    );
  };

  const widgetStepCompleted = onboardingState?.status === "completed";
  const onboardingVerificationToken =
    onboardingState?.verificationToken ?? localOnboardingVerificationToken;
  const detectedIntegrations = integrationSignals?.integrations ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Hosted onboarding</h1>
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              widgetStepCompleted ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
            }`}
          >
            {widgetStepCompleted ? "Setup complete" : "Setup in progress"}
          </span>
        </div>
        <p className="text-muted-foreground">
          Install once, then we auto-detect active web/mobile widget sessions to confirm setup.
        </p>
      </div>

      {activeBackend?.convexUrl && activeWorkspace?._id ? (
        <Card className="space-y-4 p-6">
          <WidgetInstallGuide
            convexUrl={activeBackend.convexUrl}
            workspaceId={activeWorkspace._id}
            onboardingVerificationToken={tokenModeEnabled ? onboardingVerificationToken : null}
            isOpenByDefault
            title="Install widget"
            description="Copy this snippet into your website. Token mode is optional and only needed for strict install gating."
          />

          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Install Mobile SDK</h3>
              <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
                React Native
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Use these values to initialize the React Native SDK and connect to this workspace.
            </p>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs text-muted-foreground">Workspace ID</p>
                <code className="mt-1 block break-all text-xs">{activeWorkspace._id}</code>
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs text-muted-foreground">Convex URL</p>
                <code className="mt-1 block break-all text-xs">{activeBackend.convexUrl}</code>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium">Install package</p>
              <pre className="overflow-x-auto rounded-md bg-zinc-950 p-3 text-xs text-zinc-100">{`pnpm add @opencom/react-native-sdk`}</pre>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium">Initialize on app startup</p>
              <pre className="overflow-x-auto rounded-md bg-zinc-950 p-3 text-xs text-zinc-100">{`await OpencomSDK.initialize({
  workspaceId: "${activeWorkspace._id}",
  convexUrl: "${activeBackend.convexUrl}",
});`}</pre>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Detected integrations</h3>
              <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
                {detectedIntegrations.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Signals are based on widget sessions from the last 30 days.
            </p>

            {detectedIntegrations.length > 0 ? (
              <div className="space-y-2">
                {detectedIntegrations.map((signal) => {
                  const recognized = signal.isActiveNow && signal.matchesCurrentVerificationWindow;
                  const statusLabel = recognized
                    ? "Recognized"
                    : signal.isActiveNow
                      ? "Active"
                      : "Inactive";

                  return (
                    <div key={signal.id} className="rounded-md border bg-background px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          {formatClientType(signal.clientType)}
                          {signal.clientVersion ? ` v${signal.clientVersion}` : ""}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            recognized
                              ? "bg-green-100 text-green-700"
                              : signal.isActiveNow
                                ? "bg-blue-100 text-blue-700"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {signal.origin ??
                          signal.currentUrl ??
                          signal.clientIdentifier ??
                          "Unknown source"}
                        {" · "}
                        Last seen {formatTimestamp(signal.lastSeenAt)}
                        {" · "}
                        Active sessions {signal.activeSessionCount}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No integrations detected yet. Once the widget boots on your site or app, it will
                appear here.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              onClick={() => void handleVerify()}
              disabled={verificationStatus === "checking"}
            >
              {verificationStatus === "checking" ? "Checking..." : "Check detection"}
            </Button>

            {!tokenModeEnabled ? (
              <Button variant="outline" onClick={() => void handleEnableTokenMode()}>
                Enable token verification (advanced)
              </Button>
            ) : (
              <Button variant="outline" onClick={() => void handleRegenerateToken()}>
                Regenerate token
              </Button>
            )}

            <Link href="/inbox" className="text-sm text-muted-foreground hover:text-foreground">
              I&apos;ll finish this later
            </Link>
          </div>

          {verificationMessage && (
            <p
              className={`text-sm ${
                verificationStatus === "error"
                  ? "text-red-600"
                  : verificationStatus === "success"
                    ? "text-green-600"
                    : "text-muted-foreground"
              }`}
            >
              {verificationMessage}
            </p>
          )}
        </Card>
      ) : (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            A backend and active workspace are required before onboarding can continue.
          </p>
        </Card>
      )}
    </div>
  );
}

export default function OnboardingPage(): React.JSX.Element {
  return (
    <AppLayout>
      <OnboardingContent />
    </AppLayout>
  );
}
