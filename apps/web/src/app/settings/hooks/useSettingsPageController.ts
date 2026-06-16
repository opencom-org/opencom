"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { normalizeUnknownError, type ErrorFeedbackMessage } from "@opencom/web-shared";
import { useAuth } from "@/contexts/AuthContext";
import { useBackend } from "@/contexts/BackendContext";
import { appConfirm } from "@/lib/appConfirm";
import { SETTINGS_SECTION_CONFIG, type SettingsSectionId } from "../settingsSections";
import { useTeamMembersSettings } from "../useTeamMembersSettings";
import { useSettingsPageConvex } from "./useSettingsPageConvex";

export function useSettingsPageController() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, activeWorkspace, logout } = useAuth();
  const { activeBackend, clearBackend } = useBackend();
  const [copied, setCopied] = useState(false);
  const [newOrigin, setNewOrigin] = useState("");
  const [signupMode, setSignupMode] = useState<"invite-only" | "domain-allowlist">("invite-only");
  const [allowedDomains, setAllowedDomains] = useState("");
  const [isSavingSignup, setIsSavingSignup] = useState(false);
  const [helpCenterAccessPolicy, setHelpCenterAccessPolicy] = useState<"public" | "restricted">(
    "public"
  );
  const [isSavingHelpCenterPolicy, setIsSavingHelpCenterPolicy] = useState(false);
  const [authMethodPassword, setAuthMethodPassword] = useState(true);
  const [authMethodOtp, setAuthMethodOtp] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailFromName, setEmailFromName] = useState("");
  const [emailFromEmail, setEmailFromEmail] = useState("");
  const [emailSignature, setEmailSignature] = useState("");
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [pageErrorFeedback, setPageErrorFeedback] = useState<ErrorFeedbackMessage | null>(null);

  const {
    aiSettings,
    automationSettings,
    emailConfig,
    members,
    mobileDeviceStats,
    pendingInvitations,
    securityAccess,
    updateAllowedOrigins,
    updateHelpCenterAccessPolicy,
    updateSignupSettings,
    upsertEmailConfig,
    workspace,
  } = useSettingsPageConvex(activeWorkspace?._id);

  const isOwner = activeWorkspace?.role === "owner";
  const isAdmin = activeWorkspace?.role === "admin" || isOwner;

  const setSettingsErrorFeedback = (
    error: unknown,
    fallbackMessage: string,
    nextAction: string
  ) => {
    setPageErrorFeedback(
      normalizeUnknownError(error, {
        fallbackMessage,
        nextAction,
      })
    );
  };

  const teamSettings = useTeamMembersSettings({
    workspaceId: activeWorkspace?._id,
    onError: setSettingsErrorFeedback,
  });

  useEffect(() => {
    if (!workspace) {
      return;
    }

    setSignupMode(workspace.signupMode ?? "invite-only");
    setAllowedDomains((workspace.allowedDomains ?? []).join(", "));
    setHelpCenterAccessPolicy(workspace.helpCenterAccessPolicy ?? "public");
    const methods = workspace.authMethods ?? ["password", "otp"];
    setAuthMethodPassword(methods.includes("password"));
    setAuthMethodOtp(methods.includes("otp"));
  }, [workspace]);

  useEffect(() => {
    if (!emailConfig) {
      return;
    }

    setEmailEnabled(emailConfig.enabled);
    setEmailFromName(emailConfig.fromName ?? "");
    setEmailFromEmail(emailConfig.fromEmail ?? "");
    setEmailSignature(emailConfig.signature ?? "");
  }, [emailConfig]);

  const handleSaveSignupSettings = async () => {
    if (!activeWorkspace?._id) {
      return;
    }
    setPageErrorFeedback(null);

    if (!authMethodPassword && !authMethodOtp) {
      setPageErrorFeedback({
        message: "At least one authentication method must be enabled.",
        nextAction: "Enable Password or OTP, then save again.",
      });
      return;
    }

    setIsSavingSignup(true);
    try {
      const domains = allowedDomains
        .split(",")
        .map((domain) => domain.trim().toLowerCase())
        .filter((domain) => domain.length > 0);

      const authMethods: ("password" | "otp")[] = [];
      if (authMethodPassword) authMethods.push("password");
      if (authMethodOtp) authMethods.push("otp");

      await updateSignupSettings({
        workspaceId: activeWorkspace._id,
        signupMode,
        allowedDomains: signupMode === "domain-allowlist" ? domains : [],
        authMethods,
      });
    } catch (error) {
      setSettingsErrorFeedback(
        error,
        "Failed to save signup settings",
        "Review signup settings and try again."
      );
    } finally {
      setIsSavingSignup(false);
    }
  };

  const handleSaveHelpCenterAccessPolicy = async () => {
    if (!activeWorkspace?._id) {
      return;
    }
    setPageErrorFeedback(null);

    setIsSavingHelpCenterPolicy(true);
    try {
      await updateHelpCenterAccessPolicy({
        workspaceId: activeWorkspace._id,
        policy: helpCenterAccessPolicy,
      });
    } catch (error) {
      setSettingsErrorFeedback(
        error,
        "Failed to save help center access policy",
        "Confirm access policy values and try again."
      );
    } finally {
      setIsSavingHelpCenterPolicy(false);
    }
  };

  const copyWorkspaceId = () => {
    if (!activeWorkspace?._id) {
      return;
    }

    navigator.clipboard.writeText(activeWorkspace._id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleAddOrigin = async () => {
    if (!newOrigin.trim() || !activeWorkspace?._id) {
      return;
    }

    const currentOrigins = workspace?.allowedOrigins || [];
    await updateAllowedOrigins({
      workspaceId: activeWorkspace._id,
      allowedOrigins: [...currentOrigins, newOrigin.trim()],
    });
    setNewOrigin("");
  };

  const handleRemoveOrigin = async (origin: string) => {
    if (!activeWorkspace?._id) {
      return;
    }

    const currentOrigins = workspace?.allowedOrigins || [];
    await updateAllowedOrigins({
      workspaceId: activeWorkspace._id,
      allowedOrigins: currentOrigins.filter((currentOrigin) => currentOrigin !== origin),
    });
  };

  const handleChangeBackend = async () => {
    if (
      !(await appConfirm(
        "This will log you out and return to the backend selection screen. Continue?"
      ))
    ) {
      return;
    }

    await logout();
    clearBackend();
    router.push("/login");
  };

  const handleSaveEmailSettings = async () => {
    if (!activeWorkspace?._id) {
      return;
    }
    setPageErrorFeedback(null);

    setIsSavingEmail(true);
    try {
      await upsertEmailConfig({
        workspaceId: activeWorkspace._id,
        fromName: emailFromName || undefined,
        fromEmail: emailFromEmail || undefined,
        signature: emailSignature || undefined,
        enabled: emailEnabled,
      });
    } catch (error) {
      setSettingsErrorFeedback(
        error,
        "Failed to save email settings",
        "Review email fields and try again."
      );
    } finally {
      setIsSavingEmail(false);
    }
  };

  const visibleSectionIds = useMemo(() => {
    const allSectionIds = SETTINGS_SECTION_CONFIG.map((section) => section.id);
    return allSectionIds.filter((sectionId) => {
      if (sectionId === "signup-auth" || sectionId === "help-center-access") {
        return isAdmin;
      }
      if (sectionId === "email-channel") {
        return isAdmin;
      }
      if (sectionId === "automation-api") {
        return isAdmin && workspace?.automationApiEnabled;
      }
      return true;
    });
  }, [isAdmin, workspace?.automationApiEnabled]);

  const visibleSections = useMemo(
    () => SETTINGS_SECTION_CONFIG.filter((section) => visibleSectionIds.includes(section.id)),
    [visibleSectionIds]
  );

  const defaultExpandedSectionId = useMemo(
    () =>
      visibleSections.find((section) => section.defaultExpanded)?.id ??
      visibleSections[0]?.id ??
      null,
    [visibleSections]
  );

  const [expandedSectionId, setExpandedSectionId] = useState<SettingsSectionId | null>(
    defaultExpandedSectionId
  );

  useEffect(() => {
    if (expandedSectionId && !visibleSectionIds.includes(expandedSectionId)) {
      setExpandedSectionId(defaultExpandedSectionId);
    }
  }, [defaultExpandedSectionId, expandedSectionId, visibleSectionIds]);

  useEffect(() => {
    const deepLinkedSection = searchParams.get("section");
    if (!deepLinkedSection) {
      return;
    }

    const sectionId = deepLinkedSection as SettingsSectionId;
    if (!visibleSectionIds.includes(sectionId)) {
      return;
    }

    setExpandedSectionId(sectionId);

    window.requestAnimationFrame(() => {
      const sectionElement = document.getElementById(sectionId);
      if (!sectionElement) {
        return;
      }

      sectionElement.scrollIntoView({ behavior: "auto", block: "start" });
      sectionElement.focus({ preventScroll: true });
    });
  }, [searchParams, visibleSectionIds]);

  const statusBySection = useMemo(() => {
    const originCount = workspace?.allowedOrigins?.length ?? 0;
    const automationEnabledCount = [
      automationSettings?.suggestArticlesEnabled,
      automationSettings?.showReplyTimeEnabled,
      automationSettings?.collectEmailEnabled,
      automationSettings?.askForRatingEnabled,
    ].filter(Boolean).length;
    const securityDenied =
      securityAccess?.status === "ok" ? !securityAccess.canManageSecurity : false;

    return {
      workspace: { label: "Active", tone: "success" as const },
      "team-members": {
        label: `${members?.length ?? 0} member${members?.length === 1 ? "" : "s"}`,
        tone: "neutral" as const,
      },
      "signup-auth": {
        label: signupMode === "invite-only" ? "Invite only" : "Domain allowlist",
        tone: "neutral" as const,
      },
      "allowed-origins":
        originCount > 0
          ? { label: `${originCount} configured`, tone: "success" as const }
          : { label: "Needs attention", tone: "warning" as const },
      "help-center-access": {
        label: helpCenterAccessPolicy === "public" ? "Public" : "Restricted",
        tone: "neutral" as const,
      },
      security:
        securityDenied || securityAccess?.status === "unauthenticated"
          ? { label: "Permission required", tone: "warning" as const }
          : { label: "Managed", tone: "success" as const },
      "messenger-customization": { label: "Managed", tone: "neutral" as const },
      "messenger-home": { label: "Managed", tone: "neutral" as const },
      automation:
        automationEnabledCount > 0
          ? { label: `${automationEnabledCount} enabled`, tone: "success" as const }
          : { label: "All disabled", tone: "warning" as const },
      "ai-agent":
        aiSettings?.enabled === true
          ? { label: "Enabled", tone: "success" as const }
          : { label: "Disabled", tone: "warning" as const },
      notifications: { label: "Managed", tone: "neutral" as const },
      "email-channel": emailEnabled
        ? { label: "Enabled", tone: "success" as const }
        : { label: "Disabled", tone: "warning" as const },
      "mobile-devices": {
        label: mobileDeviceStats ? `${mobileDeviceStats.total} devices` : "No devices",
        tone:
          mobileDeviceStats && mobileDeviceStats.total > 0
            ? ("success" as const)
            : ("neutral" as const),
      },
      "automation-api": { label: "Managed", tone: "neutral" as const },
      installations: { label: "In onboarding", tone: "neutral" as const },
      "backend-connection": {
        label: activeBackend?.name ? "Connected" : "Unknown",
        tone: activeBackend?.name ? ("success" as const) : ("warning" as const),
      },
    } satisfies Partial<
      Record<
        SettingsSectionId,
        { label: string; tone: "neutral" | "success" | "warning" | "danger" }
      >
    >;
  }, [
    activeBackend?.name,
    aiSettings?.enabled,
    automationSettings?.askForRatingEnabled,
    automationSettings?.collectEmailEnabled,
    automationSettings?.showReplyTimeEnabled,
    automationSettings?.suggestArticlesEnabled,
    emailEnabled,
    helpCenterAccessPolicy,
    members?.length,
    mobileDeviceStats,
    securityAccess?.canManageSecurity,
    securityAccess?.status,
    signupMode,
    workspace?.allowedOrigins?.length,
  ]);

  const isSectionExpanded = (sectionId: SettingsSectionId) => expandedSectionId === sectionId;

  const toggleSection = (sectionId: SettingsSectionId) => {
    setExpandedSectionId((currentSectionId) => (currentSectionId === sectionId ? null : sectionId));
  };

  return {
    activeBackend,
    activeWorkspace,
    aiSettings,
    allowedDomains,
    authMethodOtp,
    authMethodPassword,
    automationSettings,
    copied,
    copyWorkspaceId,
    emailConfig,
    emailEnabled,
    emailFromEmail,
    emailFromName,
    emailSignature,
    handleAddOrigin,
    handleChangeBackend,
    handleRemoveOrigin,
    handleSaveEmailSettings,
    handleSaveHelpCenterAccessPolicy,
    handleSaveSignupSettings,
    helpCenterAccessPolicy,
    isAdmin,
    isOwner,
    isSavingEmail,
    isSavingHelpCenterPolicy,
    isSavingSignup,
    isSectionExpanded,
    members,
    mobileDeviceStats,
    newOrigin,
    pageErrorFeedback,
    pendingInvitations,
    securityAccess,
    setAllowedDomains,
    setAuthMethodOtp,
    setAuthMethodPassword,
    setEmailEnabled,
    setEmailFromEmail,
    setEmailFromName,
    setEmailSignature,
    setHelpCenterAccessPolicy,
    setNewOrigin,
    setSignupMode,
    signupMode,
    statusBySection,
    teamSettings,
    toggleSection,
    user,
    workspace,
  };
}
