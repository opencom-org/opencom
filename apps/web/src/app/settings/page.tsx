"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { Button, Card, Input } from "@opencom/ui";
import {
  Copy,
  Check,
  Users,
  Globe,
  UserPlus,
  X,
  ChevronDown,
  Trash2,
  Mail,
  Clock,
  Server,
  Shield,
  Search,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBackend } from "@/contexts/BackendContext";
import { AppLayout } from "@/components/AppLayout";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import { MessengerSettingsSection } from "./MessengerSettingsSection";
import { HomeSettingsSection } from "./HomeSettingsSection";
import { AutomationSettingsSection } from "./AutomationSettingsSection";
import { AIAgentSection } from "./AIAgentSection";
import { SecuritySettingsSection } from "./SecuritySettingsSection";
import { MobileDevicesSection } from "./MobileDevicesSection";
import { NotificationSettingsSection } from "./NotificationSettingsSection";
import { SettingsSectionContainer } from "./SettingsSectionContainer";
import {
  SETTINGS_SECTION_CONFIG,
  type SettingsSectionId,
} from "./settingsSections";

function SettingsContent(): React.JSX.Element | null {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, activeWorkspace, logout } = useAuth();
  const { activeBackend, clearBackend } = useBackend();
  const [copied, setCopied] = useState(false);
  const [newOrigin, setNewOrigin] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "agent" | "viewer">("agent");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [roleDropdownOpen, setRoleDropdownOpen] = useState<string | null>(null);
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
  const inviteToWorkspace = useAction(api.workspaceMembers.inviteToWorkspace);
  const updateRole = useMutation(api.workspaceMembers.updateRole);
  const removeMember = useMutation(api.workspaceMembers.remove);
  const cancelInvitation = useMutation(api.workspaceMembers.cancelInvitation);
  const updateSignupSettings = useMutation(api.workspaces.updateSignupSettings);
  const updateHelpCenterAccessPolicy = useMutation(api.workspaces.updateHelpCenterAccessPolicy);
  const transferOwnership = useMutation(api.workspaceMembers.transferOwnership);

  const isOwner = activeWorkspace?.role === "owner";
  const isAdmin = activeWorkspace?.role === "admin" || isOwner;

  const [showTransferOwnership, setShowTransferOwnership] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<Id<"users"> | null>(null);
  const [showRoleConfirm, setShowRoleConfirm] = useState<{
    membershipId: Id<"workspaceMembers">;
    memberName: string;
    currentRole: string;
    newRole: string;
  } | null>(null);

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

    // Ensure at least one auth method is enabled
    if (!authMethodPassword && !authMethodOtp) {
      alert("At least one authentication method must be enabled.");
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
      alert(err instanceof Error ? err.message : "Failed to save signup settings");
    } finally {
      setIsSavingSignup(false);
    }
  };

  const handleSaveHelpCenterAccessPolicy = async () => {
    if (!activeWorkspace?._id) return;

    setIsSavingHelpCenterPolicy(true);
    try {
      await updateHelpCenterAccessPolicy({
        workspaceId: activeWorkspace._id,
        policy: helpCenterAccessPolicy,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save help center access policy");
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

  const handleInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeWorkspace?._id || !inviteEmail.trim()) return;

    setIsInviting(true);
    setInviteError("");
    setInviteSuccess("");

    try {
      const result = await inviteToWorkspace({
        workspaceId: activeWorkspace._id,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        baseUrl: window.location.origin,
      });

      if (result.status === "added") {
        setInviteSuccess("User added to workspace!");
      } else {
        setInviteSuccess("Invitation sent!");
      }
      setInviteEmail("");
      setInviteRole("agent");
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to invite user");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (
    membershipId: Id<"workspaceMembers">,
    newRole: "owner" | "admin" | "agent" | "viewer",
    memberName: string,
    currentRole: string
  ) => {
    setRoleDropdownOpen(null);

    // Show confirmation for privilege escalation (to admin/owner) or demotion (from admin/owner)
    const isPrivilegeChange =
      (newRole === "admin" && currentRole !== "owner") ||
      newRole === "owner" ||
      currentRole === "admin" ||
      currentRole === "owner";

    if (isPrivilegeChange) {
      setShowRoleConfirm({ membershipId, memberName, currentRole, newRole });
      return;
    }

    await executeRoleChange(membershipId, newRole);
  };

  const executeRoleChange = async (
    membershipId: Id<"workspaceMembers">,
    newRole: "admin" | "agent" | "viewer"
  ) => {
    try {
      await updateRole({ membershipId, role: newRole });
      setShowRoleConfirm(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const handleTransferOwnership = async () => {
    if (!activeWorkspace?._id || !transferTargetId) return;

    try {
      await transferOwnership({ workspaceId: activeWorkspace._id, newOwnerId: transferTargetId });
      setShowTransferOwnership(false);
      setTransferTargetId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to transfer ownership");
    }
  };

  const handleRemoveMember = async (membershipId: Id<"workspaceMembers">, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this workspace?`)) {
      return;
    }

    try {
      await removeMember({ membershipId });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  const handleCancelInvitation = async (invitationId: Id<"workspaceInvitations">) => {
    try {
      await cancelInvitation({ invitationId });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel invitation");
    }
  };

  const handleChangeBackend = async () => {
    if (confirm("This will log you out and return to the backend selection screen. Continue?")) {
      await logout();
      clearBackend();
      router.push("/login");
    }
  };

  const handleSaveEmailSettings = async () => {
    if (!activeWorkspace?._id) return;

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
      alert(err instanceof Error ? err.message : "Failed to save email settings");
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
    return visibleSections.find((section) => section.defaultExpanded)?.id ?? visibleSections[0]?.id ?? null;
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
      "email-channel":
        emailEnabled
          ? { label: "Enabled", tone: "success" as const }
          : { label: "Disabled", tone: "warning" as const },
      "mobile-devices": {
        label: mobileDeviceStats ? `${mobileDeviceStats.total} devices` : "No devices",
        tone: mobileDeviceStats && mobileDeviceStats.total > 0 ? ("success" as const) : ("neutral" as const),
      },
      installations: { label: "In onboarding", tone: "neutral" as const },
      "backend-connection": {
        label: activeBackend?.name ? "Connected" : "Unknown",
        tone: activeBackend?.name ? ("success" as const) : ("warning" as const),
      },
    } satisfies Partial<
      Record<SettingsSectionId, { label: string; tone: "neutral" | "success" | "warning" | "danger" }>
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
    setExpandedSectionId((currentSectionId) =>
      currentSectionId === sectionId ? null : sectionId
    );
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
              <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Team Members</h2>
        </div>

        {/* Invite Form - Admin Only */}
        {isAdmin && (
          <form onSubmit={handleInvite} className="mb-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="h-4 w-4" />
              <span className="font-medium text-sm">Invite Team Member</span>
            </div>

            {inviteError && (
              <div className="p-2 mb-3 text-sm text-red-600 bg-red-50 rounded">{inviteError}</div>
            )}

            {inviteSuccess && (
              <div className="p-2 mb-3 text-sm text-green-600 bg-green-50 rounded">
                {inviteSuccess}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="flex-1"
                required
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "admin" | "agent" | "viewer")}
                className="px-3 py-2 border rounded-md text-sm bg-background"
              >
                <option value="viewer">Viewer</option>
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
              <Button type="submit" disabled={isInviting || !inviteEmail.trim()}>
                {isInviting ? "Sending..." : "Invite"}
              </Button>
            </div>
          </form>
        )}

        {/* Pending Invitations */}
        {isAdmin && pendingInvitations && pendingInvitations.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Pending Invitations</span>
            </div>
            <div className="space-y-2">
              {pendingInvitations.map(
                (invitation: NonNullable<typeof pendingInvitations>[number]) => (
                  <div
                    key={invitation._id}
                    className="flex items-center justify-between py-2 px-3 bg-amber-50 border border-amber-200 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-amber-600" />
                      <span className="text-sm">{invitation.email}</span>
                      <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                        {invitation.role}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelInvitation(invitation._id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Members List */}
        <div className="space-y-2">
          {members?.map((member: NonNullable<typeof members>[number]) => (
            <div
              key={member._id}
              className="flex items-center justify-between py-2 border-b last:border-0"
            >
              <div>
                <p className="font-medium">{member.name || member.email}</p>
                <p className="text-sm text-muted-foreground">{member.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && member.role !== "owner" ? (
                  <div className="relative">
                    <button
                      onClick={() =>
                        setRoleDropdownOpen(roleDropdownOpen === member._id ? null : member._id)
                      }
                      className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                        member.role === "admin"
                          ? "bg-primary/10 text-primary"
                          : member.role === "viewer"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {member.role}
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    {roleDropdownOpen === member._id && (
                      <div className="absolute right-0 mt-1 w-32 bg-white border rounded-md shadow-lg z-10">
                        <button
                          onClick={() =>
                            handleRoleChange(
                              member._id,
                              "admin",
                              member.name || member.email!,
                              member.role
                            )
                          }
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${member.role === "admin" ? "font-medium" : ""}`}
                        >
                          Admin
                        </button>
                        <button
                          onClick={() =>
                            handleRoleChange(
                              member._id,
                              "agent",
                              member.name || member.email!,
                              member.role
                            )
                          }
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${member.role === "agent" ? "font-medium" : ""}`}
                        >
                          Agent
                        </button>
                        <button
                          onClick={() =>
                            handleRoleChange(
                              member._id,
                              "viewer",
                              member.name || member.email!,
                              member.role
                            )
                          }
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${member.role === "viewer" ? "font-medium" : ""}`}
                        >
                          Viewer
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      member.role === "owner"
                        ? "bg-amber-100 text-amber-700"
                        : member.role === "admin"
                          ? "bg-primary/10 text-primary"
                          : member.role === "viewer"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {member.role}
                  </span>
                )}
                {isAdmin && member.userId !== user?._id && member.role !== "owner" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveMember(member._id, member.name || member.email!)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Ownership Transfer - Owner Only */}
        {isOwner && (
          <div className="mt-4 p-4 border border-amber-200 bg-amber-50 rounded-lg">
            <h3 className="font-medium text-amber-800 mb-2">Transfer Ownership</h3>
            <p className="text-sm text-amber-700 mb-3">
              Transfer workspace ownership to another admin. This action cannot be undone.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTransferOwnership(true)}
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              Transfer Ownership
            </Button>
          </div>
        )}
              </Card>
            </SettingsSectionContainer>

      {/* Role Change Confirmation Modal */}
      {showRoleConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg max-w-md">
            <h3 className="font-semibold text-lg mb-2">Confirm Role Change</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Change <strong>{showRoleConfirm.memberName}</strong>&apos;s role from{" "}
              <strong>{showRoleConfirm.currentRole}</strong> to{" "}
              <strong>{showRoleConfirm.newRole}</strong>?
              {showRoleConfirm.newRole === "admin" && (
                <span className="block mt-2 text-amber-600">
                  Admins have full management access to this workspace.
                </span>
              )}
              {(showRoleConfirm.currentRole === "admin" ||
                showRoleConfirm.currentRole === "owner") &&
                showRoleConfirm.newRole !== "admin" &&
                showRoleConfirm.newRole !== "owner" && (
                  <span className="block mt-2 text-amber-600">
                    This will revoke their administrative privileges.
                  </span>
                )}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRoleConfirm(null)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  executeRoleChange(
                    showRoleConfirm.membershipId,
                    showRoleConfirm.newRole as "admin" | "agent" | "viewer"
                  )
                }
              >
                Confirm Change
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Ownership Transfer Modal */}
      {showTransferOwnership && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg max-w-md">
            <h3 className="font-semibold text-lg mb-2">Transfer Ownership</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Select an admin to transfer ownership to. You will become an admin after the transfer.
            </p>
            <select
              value={transferTargetId ?? ""}
              onChange={(e) => setTransferTargetId(e.target.value as Id<"users">)}
              className="w-full px-3 py-2 border rounded-md text-sm bg-background mb-4"
            >
              <option value="">Select a team member...</option>
              {members
                ?.filter(
                  (m: NonNullable<typeof members>[number]) =>
                    m.role === "admin" && m.userId !== user?._id
                )
                .map((member: NonNullable<typeof members>[number]) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name || member.email}
                  </option>
                ))}
            </select>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowTransferOwnership(false);
                  setTransferTargetId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleTransferOwnership}
                disabled={!transferTargetId}
              >
                Transfer Ownership
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Signup Settings - Admin Only */}
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
          <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Signup Settings</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Control how new users can join this workspace.
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Signup Mode</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSignupMode("invite-only")}
                  className={`flex-1 px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                    signupMode === "invite-only"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-input"
                  }`}
                >
                  Invite Only
                </button>
                <button
                  type="button"
                  onClick={() => setSignupMode("domain-allowlist")}
                  className={`flex-1 px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                    signupMode === "domain-allowlist"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-input"
                  }`}
                >
                  Domain Allowlist
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {signupMode === "invite-only"
                  ? "Only users you invite can join this workspace."
                  : "Users with emails from allowed domains can self-signup."}
              </p>
            </div>

            {signupMode === "domain-allowlist" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Allowed Domains</label>
                <Input
                  value={allowedDomains}
                  onChange={(e) => setAllowedDomains(e.target.value)}
                  placeholder="example.com, company.org"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of email domains (e.g., example.com, company.org)
                </p>
              </div>
            )}

            <div className="space-y-2 pt-4 border-t">
              <label className="text-sm font-medium">Authentication Methods</label>
              <p className="text-xs text-muted-foreground mb-2">
                Choose which login methods are available to users.
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={authMethodPassword}
                    onChange={(e) => setAuthMethodPassword(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Password login</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={authMethodOtp}
                    onChange={(e) => setAuthMethodOtp(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Email code (magic link)</span>
                </label>
              </div>
            </div>

            <Button onClick={handleSaveSignupSettings} disabled={isSavingSignup}>
              {isSavingSignup ? "Saving..." : "Save Settings"}
            </Button>
          </div>
          </Card>
        </SettingsSectionContainer>
      )}

      {/* Help Center Access Policy - Admin Only */}
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
          <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Help Center Access</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Control whether unauthenticated visitors can browse your public Help Center routes.
          </p>

          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setHelpCenterAccessPolicy("public")}
                className={`flex-1 px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                  helpCenterAccessPolicy === "public"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted border-input"
                }`}
              >
                Public
              </button>
              <button
                type="button"
                onClick={() => setHelpCenterAccessPolicy("restricted")}
                className={`flex-1 px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                  helpCenterAccessPolicy === "restricted"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted border-input"
                }`}
              >
                Restricted
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              {helpCenterAccessPolicy === "public"
                ? "Anyone with the link can browse published help collections and articles."
                : "Only authenticated workspace members can access help content routes."}
            </p>

            <Button onClick={handleSaveHelpCenterAccessPolicy} disabled={isSavingHelpCenterPolicy}>
              {isSavingHelpCenterPolicy ? "Saving..." : "Save Access Policy"}
            </Button>
          </div>
          </Card>
        </SettingsSectionContainer>
      )}

      {/* Email Channel Settings - Admin Only */}
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
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Email Channel</h2>
            </div>

            <div className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium">Enable Email Channel</span>
            </label>

            {emailConfig?.forwardingAddress && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <label className="text-sm font-medium">Forwarding Address</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-background px-3 py-2 rounded font-mono text-sm flex-1 border">
                    {emailConfig.forwardingAddress}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(emailConfig.forwardingAddress);
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Forward emails to this address to receive them in your inbox.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">From Name</label>
              <Input
                value={emailFromName}
                onChange={(e) => setEmailFromName(e.target.value)}
                placeholder="Support Team"
              />
              <p className="text-xs text-muted-foreground">
                The name that appears in outbound emails.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">From Email</label>
              <Input
                value={emailFromEmail}
                onChange={(e) => setEmailFromEmail(e.target.value)}
                placeholder="support@yourcompany.com"
              />
              <p className="text-xs text-muted-foreground">
                The email address used for outbound emails. Must be verified with your email
                provider.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email Signature</label>
              <textarea
                value={emailSignature}
                onChange={(e) => setEmailSignature(e.target.value)}
                placeholder="Best regards,&#10;The Support Team"
                className="w-full px-3 py-2 border rounded-md text-sm min-h-[80px] bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Automatically appended to all outbound emails.
              </p>
            </div>

            <Button onClick={handleSaveEmailSettings} disabled={isSavingEmail}>
              {isSavingEmail ? "Saving..." : "Save Email Settings"}
            </Button>
            </div>
          </Card>
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
            <Link href="/onboarding" className="inline-flex rounded-md border px-3 py-2 text-sm">
              Open Onboarding Setup
            </Link>
            <Link href="/widget-preview" className="inline-flex rounded-md border px-3 py-2 text-sm">
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
              <p className="text-xs text-muted-foreground font-mono mt-1">{activeBackend.url}</p>
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
