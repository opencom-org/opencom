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
        "No verification event was received yet. Confirm the widget snippet is live, then retry."
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
    setVerificationMessage("Checking for a verification event from your installed widget...");
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

  if (onboardingState === undefined) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#792cd4" />
        <Text style={styles.loadingText}>Loading onboarding...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
