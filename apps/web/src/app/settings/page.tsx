"use client";

import Link from "next/link";
import { Button, Card, Input } from "@opencom/ui";
import { Copy, Check, Globe, Server, Search } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ErrorFeedbackBanner } from "@/components/ErrorFeedbackBanner";
import { MessengerSettingsSection } from "./MessengerSettingsSection";
import { HomeSettingsSection } from "./HomeSettingsSection";
import { AutomationSettingsSection } from "./AutomationSettingsSection";
import { AIAgentSection } from "./AIAgentSection";
import { SecuritySettingsSection } from "./SecuritySettingsSection";
import { MobileDevicesSection } from "./MobileDevicesSection";
import { NotificationSettingsSection } from "./NotificationSettingsSection";
import { SettingsSectionContainer } from "./SettingsSectionContainer";
import { TeamMembersSection } from "./TeamMembersSection";
import { SignupAuthSection } from "./SignupAuthSection";
import { HelpCenterAccessSection } from "./HelpCenterAccessSection";
import { EmailChannelSection } from "./EmailChannelSection";
import { useSettingsPageController } from "./hooks/useSettingsPageController";
import { BillingSettings } from "@/components/billing/BillingSettings";
import { useBillingStatus } from "@/components/billing/useBillingStatus";
import type { Id } from "@opencom/convex/dataModel";
import type { SettingsSectionId } from "./settingsSections";

// ============================================================
// Billing settings section — conditionally rendered for owner + admin
// ============================================================

interface BillingSettingsSectionProps {
  workspaceId: Id<"workspaces"> | undefined;
  isSectionExpanded: (id: SettingsSectionId) => boolean;
  toggleSection: (id: SettingsSectionId) => void;
  statusBySection: Record<string, { label?: string; tone?: string } | undefined>;
}

function BillingSettingsSection({
  workspaceId,
  isSectionExpanded,
  toggleSection,
  statusBySection,
}: BillingSettingsSectionProps) {
  const billingStatus = useBillingStatus(workspaceId);

  // Only render the section if billing is enabled for this deployment
  if (!billingStatus?.billingEnabled) {
    return null;
  }

  return (
    <SettingsSectionContainer
      id="billing"
      title="Billing"
      description="Subscription plan, usage meters, and payment management."
      statusLabel={statusBySection["billing"]?.label}
      statusTone={
        statusBySection["billing"]?.tone as "neutral" | "success" | "warning" | "danger" | undefined
      }
      isExpanded={isSectionExpanded("billing")}
      onToggle={() => toggleSection("billing")}
    >
      <BillingSettings workspaceId={workspaceId} />
    </SettingsSectionContainer>
  );
}

function SettingsContent(): React.JSX.Element | null {
  const {
    activeBackend,
    activeWorkspace,
    allowedDomains,
    authMethodOtp,
    authMethodPassword,
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
    newOrigin,
    pageErrorFeedback,
    pendingInvitations,
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
  } = useSettingsPageController();

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
              workspaceId={activeWorkspace?._id}
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
          {/* Billing section — shown only when billing is enabled (hosted) and user has settings.billing permission (owner + admin) */}
          {isAdmin && (
            <BillingSettingsSection
              workspaceId={activeWorkspace?._id}
              isSectionExpanded={isSectionExpanded}
              toggleSection={toggleSection}
              statusBySection={statusBySection}
            />
          )}

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
