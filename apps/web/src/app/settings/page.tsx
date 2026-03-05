"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { Button, Card, Input } from "@opencom/ui";
import { normalizeUnknownError, type ErrorFeedbackMessage } from "@opencom/web-shared";
import { Copy, Check, Globe, Server, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBackend } from "@/contexts/BackendContext";
import { AppLayout } from "@/components/AppLayout";
import { ErrorFeedbackBanner } from "@/components/ErrorFeedbackBanner";
import { api } from "@opencom/convex";
import { appConfirm } from "@/lib/appConfirm";
import { MessengerSettingsSection } from "./MessengerSettingsSection";
import { HomeSettingsSection } from "./HomeSettingsSection";
import { AutomationSettingsSection } from "./AutomationSettingsSection";
import { AIAgentSection } from "./AIAgentSection";
import { SecuritySettingsSection } from "./SecuritySettingsSection";
import { MobileDevicesSection } from "./MobileDevicesSection";
import { NotificationSettingsSection } from "./NotificationSettingsSection";
import { SettingsSectionContainer } from "./SettingsSectionContainer";
import { SETTINGS_SECTION_CONFIG, type SettingsSectionId } from "./settingsSections";
import { TeamMembersSection } from "./TeamMembersSection";
import { useTeamMembersSettings } from "./useTeamMembersSettings";
import { SignupAuthSection } from "./SignupAuthSection";
import { HelpCenterAccessSection } from "./HelpCenterAccessSection";
import { EmailChannelSection } from "./EmailChannelSection";

function SettingsContent(): React.JSX.Element | null {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, activeWorkspace, logout } = useAuth();
  const { activeBackend, clearBackend } = useBackend();
  const [copied, setCopied] = useState(false);
  const [newOrigin, setNewOrigin] = useState("");
  const [signupMode, setSignupMode] = useState<"invite-only" | "domain-allowlist">("invite-only");
  const [allowedDomains, setAllowedDomains] = useState<string>("");
  const [isSavingSignup, setIsSavingSignup] = useState(false);
  const [helpCenterAccessPolicy, setHelpCenterAccessPolicy] = useState<"public" | "restricted">(
    "public"
  );
  const [isSavingHelpCenterPolicy, setIsSavingHelpCenterPolicy] = useState(false);
  const [authMethodPassword, setAuthMethodPassword] = useState(true);
  const [authMethodOtp, setAuthMethodOtp] = useState(true);

  // Email channel settings
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailFromName, setEmailFromName] = useState("");
  const [emailFromEmail, setEmailFromEmail] = useState("");
  const [emailSignature, setEmailSignature] = useState("");
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  const workspace = useQuery(
    api.workspaces.get,
    activeWorkspace?._id ? { id: activeWorkspace._id } : "skip"
  );

  const members = useQuery(
    api.workspaceMembers.listByWorkspace,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const pendingInvitations = useQuery(
    api.workspaceMembers.getWorkspacePendingInvitations,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const emailConfig = useQuery(
    api.emailChannel.getEmailConfig,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );
  const aiSettings = useQuery(
    api.aiAgent.getSettings,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );
  const automationSettings = useQuery(
    api.automationSettings.get,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );
  const securityAccess = useQuery(
    api.auditLogs.getAccess,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );
  const mobileDeviceStats = useQuery(
    api.visitorPushTokens.getStats,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const updateAllowedOrigins = useMutation(api.workspaces.updateAllowedOrigins);
  const upsertEmailConfig = useMutation(api.emailChannel.upsertEmailConfig);
  const updateSignupSettings = useMutation(api.workspaces.updateSignupSettings);
  const updateHelpCenterAccessPolicy = useMutation(api.workspaces.updateHelpCenterAccessPolicy);

  const isOwner = activeWorkspace?.role === "owner";
  const isAdmin = activeWorkspace?.role === "admin" || isOwner;

  const [pageErrorFeedback, setPageErrorFeedback] = useState<ErrorFeedbackMessage | null>(null);

  const setSettingsErrorFeedback = (
    error: unknown,
    fallbackMessage: string,
    nextAction: string
  ): void => {
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
    if (workspace) {
      setSignupMode(workspace.signupMode ?? "invite-only");
      setAllowedDomains((workspace.allowedDomains ?? []).join(", "));
      setHelpCenterAccessPolicy(workspace.helpCenterAccessPolicy ?? "public");
      const methods = workspace.authMethods ?? ["password", "otp"];
      setAuthMethodPassword(methods.includes("password"));
      setAuthMethodOtp(methods.includes("otp"));
    }
  }, [workspace]);

  useEffect(() => {
    if (emailConfig) {
      setEmailEnabled(emailConfig.enabled);
      setEmailFromName(emailConfig.fromName ?? "");
      setEmailFromEmail(emailConfig.fromEmail ?? "");
      setEmailSignature(emailConfig.signature ?? "");
    }
  }, [emailConfig]);

  const handleSaveSignupSettings = async () => {
    if (!activeWorkspace?._id) return;
    setPageErrorFeedback(null);

    // Ensure at least one auth method is enabled
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
        .map((d) => d.trim().toLowerCase())
        .filter((d) => d.length > 0);

      const authMethods: ("password" | "otp")[] = [];
      if (authMethodPassword) authMethods.push("password");
      if (authMethodOtp) authMethods.push("otp");

      await updateSignupSettings({
        workspaceId: activeWorkspace._id,
        signupMode,
        allowedDomains: signupMode === "domain-allowlist" ? domains : [],
        authMethods,
      });
    } catch (err) {
      setSettingsErrorFeedback(
        err,
        "Failed to save signup settings",
        "Review signup settings and try again."
      );
    } finally {
      setIsSavingSignup(false);
    }
  };

  const handleSaveHelpCenterAccessPolicy = async () => {
    if (!activeWorkspace?._id) return;
    setPageErrorFeedback(null);

    setIsSavingHelpCenterPolicy(true);
    try {
      await updateHelpCenterAccessPolicy({
        workspaceId: activeWorkspace._id,
        policy: helpCenterAccessPolicy,
      });
    } catch (err) {
      setSettingsErrorFeedback(
        err,
        "Failed to save help center access policy",
        "Confirm access policy values and try again."
      );
    } finally {
      setIsSavingHelpCenterPolicy(false);
    }
  };

  const copyWorkspaceId = () => {
    if (activeWorkspace?._id) {
      navigator.clipboard.writeText(activeWorkspace._id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddOrigin = async () => {
    if (!newOrigin.trim() || !activeWorkspace?._id) return;

    const currentOrigins = workspace?.allowedOrigins || [];
    await updateAllowedOrigins({
      workspaceId: activeWorkspace._id,
      allowedOrigins: [...currentOrigins, newOrigin.trim()],
    });
    setNewOrigin("");
  };

  const handleRemoveOrigin = async (origin: string) => {
    if (!activeWorkspace?._id) return;

    const currentOrigins = workspace?.allowedOrigins || [];
    await updateAllowedOrigins({
      workspaceId: activeWorkspace._id,
      allowedOrigins: currentOrigins.filter((o: string) => o !== origin),
    });
  };

  const handleChangeBackend = async () => {
    if (
      await appConfirm(
        "This will log you out and return to the backend selection screen. Continue?"
      )
    ) {
      await logout();
      clearBackend();
      router.push("/login");
    }
  };

  const handleSaveEmailSettings = async () => {
    if (!activeWorkspace?._id) return;
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
    } catch (err) {
      setSettingsErrorFeedback(err, "Failed to save email settings", "Review email fields and try again.");
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
      return true;
    });
  }, [isAdmin]);

  const visibleSections = useMemo(() => {
    return SETTINGS_SECTION_CONFIG.filter((section) => visibleSectionIds.includes(section.id));
  }, [visibleSectionIds]);

  const defaultExpandedSectionId = useMemo(() => {
    return (
      visibleSections.find((section) => section.defaultExpanded)?.id ??
      visibleSections[0]?.id ??
      null
    );
  }, [visibleSections]);

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

  if (!user || !activeWorkspace) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-[1520px] px-4 py-4 sm:px-6 sm:py-6">
      <div className="min-w-0 space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage workspace configuration, security, and channels.
          </p>
        </header>
        {pageErrorFeedback && <ErrorFeedbackBanner feedback={pageErrorFeedback} />}

        <div className="space-y-8">
          <SettingsSectionContainer
            id="workspace"
            title="Workspace"
            description="Name, ID, and workspace identity details."
            statusLabel={statusBySection.workspace?.label}
            statusTone={statusBySection.workspace?.tone}
            isExpanded={isSectionExpanded("workspace")}
            onToggle={() => toggleSection("workspace")}
          >
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Workspace</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">Name</label>
                  <p className="font-medium">{activeWorkspace.name}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Workspace ID</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="bg-muted px-3 py-2 rounded font-mono text-sm flex-1">
                      {activeWorkspace._id}
                    </code>
                    <Button variant="outline" size="sm" onClick={copyWorkspaceId}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use this ID to configure your widget: VITE_WORKSPACE_ID={activeWorkspace._id}
                  </p>
                </div>
              </div>
            </Card>
          </SettingsSectionContainer>

          <SettingsSectionContainer
            id="allowed-origins"
            title="Allowed Origins"
            description="Restrict which domains can embed your widget."
            statusLabel={statusBySection["allowed-origins"]?.label}
            statusTone={statusBySection["allowed-origins"]?.tone}
            isExpanded={isSectionExpanded("allowed-origins")}
            onToggle={() => toggleSection("allowed-origins")}
          >
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Allowed Origins</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Domains where your widget can be embedded. Leave empty to allow all origins (not
                recommended for production).
              </p>

              <div className="space-y-2 mb-4">
                {workspace?.allowedOrigins?.map((origin: string) => (
                  <div
                    key={origin}
                    className="flex items-center justify-between bg-muted px-3 py-2 rounded"
                  >
                    <code className="text-sm">{origin}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveOrigin(origin)}
                      className="text-destructive hover:text-destructive"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                {(!workspace?.allowedOrigins || workspace.allowedOrigins.length === 0) && (
                  <p className="text-sm text-muted-foreground italic">
                    No origins configured (all origins allowed)
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  value={newOrigin}
                  onChange={(e) => setNewOrigin(e.target.value)}
                  placeholder="https://example.com"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddOrigin();
                  }}
                />
                <Button onClick={handleAddOrigin} disabled={!newOrigin.trim()}>
                  Add Origin
                </Button>
              </div>
            </Card>
          </SettingsSectionContainer>

          <SettingsSectionContainer
            id="team-members"
            title="Team Members"
            description="Invite teammates, manage roles, and transfer ownership."
            statusLabel={statusBySection["team-members"]?.label}
            statusTone={statusBySection["team-members"]?.tone}
            isExpanded={isSectionExpanded("team-members")}
            onToggle={() => toggleSection("team-members")}
          >
            <TeamMembersSection
              isAdmin={isAdmin}
              isOwner={isOwner}
              currentUserId={user?._id}
              members={members}
              pendingInvitations={pendingInvitations}
              controller={teamSettings}
            />
          </SettingsSectionContainer>

          {isAdmin && (
            <SettingsSectionContainer
              id="signup-auth"
              title="Signup & Authentication"
              description="Control signup mode and authentication methods."
              statusLabel={statusBySection["signup-auth"]?.label}
              statusTone={statusBySection["signup-auth"]?.tone}
              isExpanded={isSectionExpanded("signup-auth")}
              onToggle={() => toggleSection("signup-auth")}
            >
              <SignupAuthSection
                signupMode={signupMode}
                setSignupMode={setSignupMode}
                allowedDomains={allowedDomains}
                setAllowedDomains={setAllowedDomains}
                authMethodPassword={authMethodPassword}
                setAuthMethodPassword={setAuthMethodPassword}
                authMethodOtp={authMethodOtp}
                setAuthMethodOtp={setAuthMethodOtp}
                isSavingSignup={isSavingSignup}
                onSave={handleSaveSignupSettings}
              />
            </SettingsSectionContainer>
          )}

          {/* TODO(help-center): Replace this workspace-wide toggle with per-article visibility controls. */}
          {isAdmin && (
            <SettingsSectionContainer
              id="help-center-access"
              title="Help Center Access"
              description="Control whether public help routes are open or restricted."
              statusLabel={statusBySection["help-center-access"]?.label}
              statusTone={statusBySection["help-center-access"]?.tone}
              isExpanded={isSectionExpanded("help-center-access")}
              onToggle={() => toggleSection("help-center-access")}
            >
              <HelpCenterAccessSection
                policy={helpCenterAccessPolicy}
                setPolicy={setHelpCenterAccessPolicy}
                isSaving={isSavingHelpCenterPolicy}
                onSave={handleSaveHelpCenterAccessPolicy}
              />
            </SettingsSectionContainer>
          )}

          {isAdmin && (
            <SettingsSectionContainer
              id="email-channel"
              title="Email Channel"
              description="Receive and send emails directly from your inbox."
              statusLabel={statusBySection["email-channel"]?.label}
              statusTone={statusBySection["email-channel"]?.tone}
              isExpanded={isSectionExpanded("email-channel")}
              onToggle={() => toggleSection("email-channel")}
            >
              <EmailChannelSection
                emailEnabled={emailEnabled}
                setEmailEnabled={setEmailEnabled}
                forwardingAddress={emailConfig?.forwardingAddress}
                emailFromName={emailFromName}
                setEmailFromName={setEmailFromName}
                emailFromEmail={emailFromEmail}
                setEmailFromEmail={setEmailFromEmail}
                emailSignature={emailSignature}
                setEmailSignature={setEmailSignature}
                isSavingEmail={isSavingEmail}
                onSave={handleSaveEmailSettings}
              />
            </SettingsSectionContainer>
          )}

          <SettingsSectionContainer
            id="installations"
            title="Installations"
            description="Widget and Mobile SDK setup guides are now in onboarding."
            statusLabel={statusBySection.installations?.label}
            statusTone={statusBySection.installations?.tone}
            isExpanded={isSectionExpanded("installations")}
            onToggle={() => toggleSection("installations")}
          >
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Search className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Setup & Install Guides</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Widget and Mobile SDK installation steps now live in Hosted Onboarding for a single
                setup flow.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/onboarding"
                  className="inline-flex rounded-md border px-3 py-2 text-sm"
                >
                  Open Onboarding Setup
                </Link>
                <Link
                  href="/widget-preview"
                  className="inline-flex rounded-md border px-3 py-2 text-sm"
                >
                  Open Widget Preview
                </Link>
              </div>
            </Card>
          </SettingsSectionContainer>

          {/* Messenger Customization */}
          <SettingsSectionContainer
            id="messenger-customization"
            title="Messenger Customization"
            description="Branding, theme, launcher, and language preferences."
            statusLabel={statusBySection["messenger-customization"]?.label}
            statusTone={statusBySection["messenger-customization"]?.tone}
            isExpanded={isSectionExpanded("messenger-customization")}
            onToggle={() => toggleSection("messenger-customization")}
          >
            <MessengerSettingsSection workspaceId={activeWorkspace?._id} />
          </SettingsSectionContainer>

          {/* Messenger Home */}
          <SettingsSectionContainer
            id="messenger-home"
            title="Messenger Home"
            description="Configure home cards and default visitor entry space."
            statusLabel={statusBySection["messenger-home"]?.label}
            statusTone={statusBySection["messenger-home"]?.tone}
            isExpanded={isSectionExpanded("messenger-home")}
            onToggle={() => toggleSection("messenger-home")}
          >
            <HomeSettingsSection workspaceId={activeWorkspace?._id} />
          </SettingsSectionContainer>

          {/* Automation & Self-Serve Settings */}
          <SettingsSectionContainer
            id="automation"
            title="Automation"
            description="Tune self-serve and workflow automation toggles."
            statusLabel={statusBySection.automation?.label}
            statusTone={statusBySection.automation?.tone}
            isExpanded={isSectionExpanded("automation")}
            onToggle={() => toggleSection("automation")}
          >
            <AutomationSettingsSection workspaceId={activeWorkspace?._id} />
          </SettingsSectionContainer>

          {/* Notification Settings */}
          <SettingsSectionContainer
            id="notifications"
            title="Notifications"
            description="Manage personal and workspace notification defaults."
            statusLabel={statusBySection.notifications?.label}
            statusTone={statusBySection.notifications?.tone}
            isExpanded={isSectionExpanded("notifications")}
            onToggle={() => toggleSection("notifications")}
          >
            <NotificationSettingsSection workspaceId={activeWorkspace?._id} isAdmin={isAdmin} />
          </SettingsSectionContainer>

          {/* AI Agent Settings */}
          <SettingsSectionContainer
            id="ai-agent"
            title="AI Agent"
            description="Configure models, confidence, and handoff behavior."
            statusLabel={statusBySection["ai-agent"]?.label}
            statusTone={statusBySection["ai-agent"]?.tone}
            isExpanded={isSectionExpanded("ai-agent")}
            onToggle={() => toggleSection("ai-agent")}
          >
            <AIAgentSection workspaceId={activeWorkspace?._id} />
          </SettingsSectionContainer>

          {/* Security Settings */}
          <SettingsSectionContainer
            id="security"
            title="Security"
            description="Identity verification, sessions, and audit policies."
            statusLabel={statusBySection.security?.label}
            statusTone={statusBySection.security?.tone}
            isExpanded={isSectionExpanded("security")}
            onToggle={() => toggleSection("security")}
          >
            <SecuritySettingsSection workspaceId={activeWorkspace?._id} />
          </SettingsSectionContainer>

          {/* Connected Mobile Devices */}
          <SettingsSectionContainer
            id="mobile-devices"
            title="Connected Mobile Devices"
            description="Review SDK-connected devices and push registration activity."
            statusLabel={statusBySection["mobile-devices"]?.label}
            statusTone={statusBySection["mobile-devices"]?.tone}
            isExpanded={isSectionExpanded("mobile-devices")}
            onToggle={() => toggleSection("mobile-devices")}
          >
            <MobileDevicesSection workspaceId={activeWorkspace?._id} />
          </SettingsSectionContainer>

          {/* Backend Connection */}
          <SettingsSectionContainer
            id="backend-connection"
            title="Backend Connection"
            description="Current backend details and environment switching."
            statusLabel={statusBySection["backend-connection"]?.label}
            statusTone={statusBySection["backend-connection"]?.tone}
            isExpanded={isSectionExpanded("backend-connection")}
            onToggle={() => toggleSection("backend-connection")}
          >
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Server className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Backend Connection</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">Connected to</label>
                  <p className="font-medium">{activeBackend?.name ?? "Unknown"}</p>
                  {activeBackend?.url && (
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      {activeBackend.url}
                    </p>
                  )}
                </div>
                <Button variant="outline" onClick={handleChangeBackend}>
                  Change Backend
                </Button>
              </div>
            </Card>
          </SettingsSectionContainer>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage(): React.JSX.Element {
  return (
    <AppLayout>
      <SettingsContent />
    </AppLayout>
  );
}
