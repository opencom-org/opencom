import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@opencom/convex";
import { useAuth } from "../../src/contexts/AuthContext";
import { useBackend } from "../../src/contexts/BackendContext";

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

export default function OnboardingScreen() {
  const { activeWorkspaceId, user } = useAuth();
  const { activeBackend } = useBackend();
  const workspaceId = activeWorkspaceId ?? user?.workspaceId;

  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("idle");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [localVerificationToken, setLocalVerificationToken] = useState<string | null>(null);

  const startRequestedRef = useRef(false);
  const tokenRequestedRef = useRef(false);
  const verifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onboardingState = useQuery(
    api.workspaces.getHostedOnboardingState,
    workspaceId ? { workspaceId } : "skip"
  );
  const integrationSignals = useQuery(
    api.workspaces.getHostedOnboardingIntegrationSignals,
    workspaceId ? { workspaceId } : "skip"
  );

  const startHostedOnboarding = useMutation(api.workspaces.startHostedOnboarding);
  const issueVerificationToken = useMutation(api.workspaces.issueHostedOnboardingVerificationToken);
  const completeWidgetStep = useMutation(api.workspaces.completeHostedOnboardingWidgetStep);

  useEffect(() => {
    if (!onboardingState?.verificationToken) {
      return;
    }
    setLocalVerificationToken(onboardingState.verificationToken);
  }, [onboardingState?.verificationToken]);

  useEffect(() => {
    if (
      !workspaceId ||
      onboardingState === undefined ||
      onboardingState === null ||
      onboardingState.status !== "not_started" ||
      startRequestedRef.current
    ) {
      return;
    }

    startRequestedRef.current = true;
    void startHostedOnboarding({ workspaceId }).finally(() => {
      startRequestedRef.current = false;
    });
  }, [workspaceId, onboardingState, startHostedOnboarding]);

  useEffect(() => {
    if (
      !workspaceId ||
      onboardingState === undefined ||
      onboardingState === null ||
      onboardingState.verificationToken ||
      onboardingState.isWidgetVerified ||
      tokenRequestedRef.current
    ) {
      return;
    }

    tokenRequestedRef.current = true;
    void issueVerificationToken({ workspaceId })
      .then((result) => {
        setLocalVerificationToken(result.token);
      })
      .finally(() => {
        tokenRequestedRef.current = false;
      });
  }, [workspaceId, onboardingState, issueVerificationToken]);

  useEffect(() => {
    if (verificationStatus !== "checking" || !workspaceId || !onboardingState?.isWidgetVerified) {
      return;
    }

    let cancelled = false;
    void completeWidgetStep({
      workspaceId,
      token: onboardingState.verificationToken ?? undefined,
    }).then((result) => {
      if (cancelled) {
        return;
      }

      if (result.success) {
        setVerificationStatus("success");
        setVerificationMessage("Widget verified. You can now start in Inbox.");
      } else {
        setVerificationStatus("error");
        setVerificationMessage("Verification was detected but completion failed. Please retry.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    verificationStatus,
    onboardingState?.isWidgetVerified,
    onboardingState?.verificationToken,
    workspaceId,
    completeWidgetStep,
  ]);

  useEffect(() => {
    if (verificationStatus !== "checking") {
      return;
    }

    verifyTimeoutRef.current = setTimeout(() => {
      setVerificationStatus("error");
      setVerificationMessage(
        "No active widget/SDK installation detected yet. Confirm your setup is live, then retry."
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
    if (!workspaceId) {
      return;
    }

    if (!onboardingState?.verificationToken && !localVerificationToken) {
      const issued = await issueVerificationToken({ workspaceId });
      setLocalVerificationToken(issued.token);
      setVerificationStatus("idle");
      setVerificationMessage(
        "A verification token was generated. Add it to your snippet, refresh your site, then verify again."
      );
      return;
    }

    if (onboardingState?.isWidgetVerified) {
      const completion = await completeWidgetStep({
        workspaceId,
        token: onboardingState.verificationToken ?? localVerificationToken ?? undefined,
      });

      if (completion.success) {
        setVerificationStatus("success");
        setVerificationMessage("Widget already verified. You can continue to Inbox.");
      } else {
        setVerificationStatus("error");
        setVerificationMessage("Verification exists, but completion failed. Please retry.");
      }
      return;
    }

    setVerificationStatus("checking");
    setVerificationMessage("Checking for active web or mobile widget sessions...");
  };

  const handleRegenerateToken = async () => {
    if (!workspaceId) {
      return;
    }

    const issued = await issueVerificationToken({ workspaceId });
    setLocalVerificationToken(issued.token);
    setVerificationStatus("idle");
    setVerificationMessage("Generated a new token. Update your snippet and verify again.");
  };

  const handleCopy = async (value: string, label: string) => {
    await Clipboard.setStringAsync(value);
    Alert.alert("Copied", `${label} copied to clipboard.`);
  };

  const verificationToken = onboardingState?.verificationToken ?? localVerificationToken;
  const isVerified = onboardingState?.isWidgetVerified ?? false;
  const detectedIntegrations = integrationSignals?.integrations ?? [];
  const showInstallGuidance = !isVerified;
  const resolvedConvexUrl = activeBackend?.convexUrl ?? "YOUR_CONVEX_URL";
  const resolvedWorkspaceId = workspaceId ?? "YOUR_WORKSPACE_ID";
  const webSnippetLines = [
    "<script",
    '  src="https://cdn.opencom.dev/widget.js"',
    `  data-opencom-convex-url="${resolvedConvexUrl}"`,
    `  data-opencom-workspace-id="${resolvedWorkspaceId}"`,
    '  data-opencom-track-page-views="true"',
    verificationToken
      ? `  data-opencom-onboarding-verification-token="${verificationToken}"`
      : null,
    "></script>",
  ];
  const webSnippetWithToken = webSnippetLines.filter(Boolean).join("\n");

  const reactNativeSnippet = `import { OpencomSDK } from "@opencom/react-native-sdk";

await OpencomSDK.initialize({
  workspaceId: "${resolvedWorkspaceId}",
  convexUrl: "${resolvedConvexUrl}",
});`;

  if (onboardingState === undefined) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#792cd4" />
        <Text style={styles.loadingText}>Loading onboarding...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Widget onboarding</Text>
      <Text style={styles.subtitle}>
        Until your widget is verified, this page is your default start. You can still go to Inbox
        anytime.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Status</Text>
        <View style={[styles.badge, isVerified ? styles.badgeSuccess : styles.badgePending]}>
          <Text
            style={[
              styles.badgeText,
              isVerified ? styles.badgeTextSuccess : styles.badgeTextPending,
            ]}
          >
            {isVerified ? "Verified" : "Pending verification"}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.cardTitle}>Detected installations</Text>
          <View style={styles.signalCountBadge}>
            <Text style={styles.signalCountText}>{detectedIntegrations.length}</Text>
          </View>
        </View>
        <Text style={styles.cardDescription}>
          Signals are based on widget sessions from the last 30 days.
        </Text>

        {detectedIntegrations.length > 0 ? (
          <View style={styles.integrationList}>
            {detectedIntegrations.map((signal) => {
              const recognized = signal.isActiveNow && signal.matchesCurrentVerificationWindow;
              const statusLabel = recognized
                ? "Recognized"
                : signal.isActiveNow
                  ? "Active"
                  : "Inactive";

              return (
                <View key={signal.id} style={styles.integrationItem}>
                  <View style={styles.integrationHeader}>
                    <Text style={styles.integrationTitle}>
                      {formatClientType(signal.clientType)}
                      {signal.clientVersion ? ` v${signal.clientVersion}` : ""}
                    </Text>
                    <View
                      style={[
                        styles.integrationStatus,
                        recognized
                          ? styles.integrationStatusRecognized
                          : signal.isActiveNow
                            ? styles.integrationStatusActive
                            : styles.integrationStatusInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.integrationStatusText,
                          recognized
                            ? styles.integrationStatusTextRecognized
                            : signal.isActiveNow
                              ? styles.integrationStatusTextActive
                              : styles.integrationStatusTextInactive,
                        ]}
                      >
                        {statusLabel}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.integrationMeta} numberOfLines={2}>
                    {signal.origin ?? signal.currentUrl ?? signal.clientIdentifier ?? "Unknown source"}
                    {" · Last seen "}
                    {formatTimestamp(signal.lastSeenAt)}
                    {" · Active sessions "}
                    {signal.activeSessionCount}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.emptyStateText}>
            No active widget/SDK installations detected yet for this workspace.
          </Text>
        )}
      </View>

      {showInstallGuidance ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Install widget / SDK</Text>
          <Text style={styles.cardDescription}>
            Add one of these setups, then retry verification. This matches the hosted web onboarding
            guidance.
          </Text>

          <Text style={styles.label}>Web widget snippet</Text>
          <View style={styles.snippetBox}>
            <Text style={styles.snippetText}>{webSnippetWithToken}</Text>
          </View>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              void handleCopy(webSnippetWithToken, "Web widget snippet");
            }}
          >
            <Text style={styles.secondaryButtonText}>Copy web snippet</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.label}>React Native SDK init</Text>
          <View style={styles.snippetBox}>
            <Text style={styles.snippetText}>{reactNativeSnippet}</Text>
          </View>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              void handleCopy(reactNativeSnippet, "React Native SDK snippet");
            }}
          >
            <Text style={styles.secondaryButtonText}>Copy SDK snippet</Text>
          </TouchableOpacity>

          <Text style={styles.helperText}>
            If this workspace is not the one you installed on, switch workspace in Settings and
            retry.
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Setup values</Text>

        <View style={styles.row}>
          <View style={styles.rowTextWrap}>
            <Text style={styles.label}>Workspace ID</Text>
            <Text style={styles.value} numberOfLines={1}>
              {workspaceId ?? "Unavailable"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => workspaceId && handleCopy(workspaceId, "Workspace ID")}
            disabled={!workspaceId}
          >
            <Text style={styles.secondaryButtonText}>Copy</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowTextWrap}>
            <Text style={styles.label}>Verification token</Text>
            <Text style={styles.value} numberOfLines={1}>
              {verificationToken ?? "Generating..."}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => verificationToken && handleCopy(verificationToken, "Verification token")}
            disabled={!verificationToken}
          >
            <Text style={styles.secondaryButtonText}>Copy</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.rowTextWrap}>
          <Text style={styles.label}>Backend</Text>
          <Text style={styles.value} numberOfLines={1}>
            {activeBackend?.convexUrl ?? "Not connected"}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, verificationStatus === "checking" && styles.buttonDisabled]}
        onPress={() => void handleVerify()}
        disabled={verificationStatus === "checking"}
      >
        <Text style={styles.primaryButtonText}>
          {verificationStatus === "checking" ? "Verifying..." : "Verify installation"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.ghostButton} onPress={() => void handleRegenerateToken()}>
        <Text style={styles.ghostButtonText}>Generate new token</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.ghostButton}
        onPress={() => router.push("/(app)/inbox" as never)}
      >
        <Text style={styles.ghostButtonText}>Go to Inbox</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.ghostButton} onPress={() => router.push("/(app)/settings")}>
        <Text style={styles.ghostButtonText}>Open Settings</Text>
      </TouchableOpacity>

      {verificationMessage ? (
        <Text
          style={[
            styles.message,
            verificationStatus === "error"
              ? styles.messageError
              : verificationStatus === "success"
                ? styles.messageSuccess
                : styles.messageNeutral,
          ]}
        >
          {verificationMessage}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    padding: 16,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    color: "#666",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#666",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#222",
  },
  cardDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: "#666",
    marginTop: -4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  signalCountBadge: {
    minWidth: 24,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  signalCountText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  rowTextWrap: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  value: {
    fontSize: 13,
    color: "#222",
    fontFamily: "monospace",
  },
  integrationList: {
    gap: 8,
  },
  integrationItem: {
    borderWidth: 1,
    borderColor: "#ececec",
    borderRadius: 10,
    padding: 10,
    gap: 6,
    backgroundColor: "#fff",
  },
  integrationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  integrationTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  integrationStatus: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  integrationStatusRecognized: {
    backgroundColor: "#dcfce7",
  },
  integrationStatusActive: {
    backgroundColor: "#dbeafe",
  },
  integrationStatusInactive: {
    backgroundColor: "#f3f4f6",
  },
  integrationStatusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  integrationStatusTextRecognized: {
    color: "#15803d",
  },
  integrationStatusTextActive: {
    color: "#1d4ed8",
  },
  integrationStatusTextInactive: {
    color: "#6b7280",
  },
  integrationMeta: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 17,
  },
  emptyStateText: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
  },
  snippetBox: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    padding: 10,
  },
  snippetText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#1f2937",
    fontFamily: "monospace",
  },
  divider: {
    height: 1,
    backgroundColor: "#ececec",
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgePending: {
    backgroundColor: "#e9f2ff",
  },
  badgeSuccess: {
    backgroundColor: "#e8f8ee",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  badgeTextPending: {
    color: "#1d4ed8",
  },
  badgeTextSuccess: {
    color: "#15803d",
  },
  primaryButton: {
    backgroundColor: "#792cd4",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  ghostButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  ghostButtonText: {
    color: "#333",
    fontSize: 14,
    fontWeight: "500",
  },
  secondaryButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  secondaryButtonText: {
    color: "#333",
    fontSize: 13,
    fontWeight: "500",
  },
  helperText: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 18,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  messageNeutral: {
    color: "#555",
  },
  messageError: {
    color: "#b91c1c",
  },
  messageSuccess: {
    color: "#15803d",
  },
});
