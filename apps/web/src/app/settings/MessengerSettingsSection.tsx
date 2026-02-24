"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { Button, Card, Input } from "@opencom/ui";
import { Palette, Upload, Eye, X } from "lucide-react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ja", name: "Japanese" },
  { code: "zh", name: "Chinese" },
  { code: "ko", name: "Korean" },
  { code: "ar", name: "Arabic" },
  { code: "ru", name: "Russian" },
  { code: "nl", name: "Dutch" },
];

export function MessengerSettingsSection({
  workspaceId,
}: {
  workspaceId?: Id<"workspaces">;
}): React.JSX.Element | null {
  const messengerSettings = useQuery(
    api.messengerSettings.getOrCreate,
    workspaceId ? { workspaceId } : "skip"
  );

  const upsertSettings = useMutation(api.messengerSettings.upsert);
  const generateUploadUrl = useMutation(api.messengerSettings.generateLogoUploadUrl);
  const saveLogo = useMutation(api.messengerSettings.saveLogo);
  const deleteLogo = useMutation(api.messengerSettings.deleteLogo);

  // Branding
  const [primaryColor, setPrimaryColor] = useState("#792cd4");
  const [backgroundColor, setBackgroundColor] = useState("#792cd4");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Theme
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("system");

  // Launcher
  const [launcherPosition, setLauncherPosition] = useState<"left" | "right">("right");
  const [launcherSideSpacing, setLauncherSideSpacing] = useState(20);
  const [launcherBottomSpacing, setLauncherBottomSpacing] = useState(20);
  const [showLauncher, setShowLauncher] = useState(true);

  // Content
  const [welcomeMessage, setWelcomeMessage] = useState("Hi there! How can we help you today?");
  const [teamIntroduction, setTeamIntroduction] = useState("");
  const [showTeammateAvatars, setShowTeammateAvatars] = useState(true);

  // Languages
  const [supportedLanguages, setSupportedLanguages] = useState<string[]>(["en"]);
  const [defaultLanguage, setDefaultLanguage] = useState("en");

  // General
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState("");
  const [mobileEnabled, setMobileEnabled] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (messengerSettings) {
      setPrimaryColor(messengerSettings.primaryColor);
      setBackgroundColor(messengerSettings.backgroundColor);
      setThemeMode(messengerSettings.themeMode);
      setLauncherPosition(messengerSettings.launcherPosition);
      setLauncherSideSpacing(messengerSettings.launcherSideSpacing);
      setLauncherBottomSpacing(messengerSettings.launcherBottomSpacing);
      setShowLauncher(messengerSettings.showLauncher);
      setWelcomeMessage(messengerSettings.welcomeMessage);
      setTeamIntroduction(messengerSettings.teamIntroduction ?? "");
      setShowTeammateAvatars(messengerSettings.showTeammateAvatars);
      setSupportedLanguages(messengerSettings.supportedLanguages);
      setDefaultLanguage(messengerSettings.defaultLanguage);
      setPrivacyPolicyUrl(messengerSettings.privacyPolicyUrl ?? "");
      setMobileEnabled(messengerSettings.mobileEnabled);
      setLogoPreview(messengerSettings.logo ?? null);
    }
  }, [messengerSettings]);

  const handleSave = async () => {
    if (!workspaceId) return;
    setIsSaving(true);
    try {
      await upsertSettings({
        workspaceId,
        primaryColor,
        backgroundColor,
        themeMode,
        launcherPosition,
        launcherSideSpacing,
        launcherBottomSpacing,
        showLauncher,
        welcomeMessage,
        teamIntroduction: teamIntroduction || null,
        showTeammateAvatars,
        supportedLanguages,
        defaultLanguage,
        privacyPolicyUrl: privacyPolicyUrl || null,
        mobileEnabled,
      });
    } catch (error) {
      console.error("Failed to save messenger settings:", error);
      alert(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspaceId) return;

    // Validate file size (max 100KB)
    if (file.size > 100 * 1024) {
      alert("Logo must be under 100KB");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }

    setIsUploadingLogo(true);
    try {
      const uploadUrl = await generateUploadUrl({ workspaceId });
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await response.json();
      await saveLogo({ workspaceId, storageId });

      // Show preview
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Failed to upload logo:", error);
      alert("Failed to upload logo");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!workspaceId) return;
    try {
      await deleteLogo({ workspaceId });
      setLogoPreview(null);
    } catch (error) {
      console.error("Failed to delete logo:", error);
    }
  };

  const toggleLanguage = (code: string) => {
    if (supportedLanguages.includes(code)) {
      if (supportedLanguages.length === 1) return; // Keep at least one
      const newLangs = supportedLanguages.filter((l) => l !== code);
      setSupportedLanguages(newLangs);
      if (defaultLanguage === code) setDefaultLanguage(newLangs[0]);
    } else {
      setSupportedLanguages([...supportedLanguages, code]);
    }
  };

  if (!workspaceId) return null;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Messenger Customization</h2>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
          <Eye className="h-4 w-4 mr-2" />
          {showPreview ? "Hide Preview" : "Preview"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Customize the appearance of your messenger widget and mobile SDK to match your brand.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Column */}
        <div className="space-y-6">
          {/* Branding Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium border-b pb-2">Branding</h3>

            {/* Logo */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Logo</label>
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <div className="relative">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="w-16 h-16 object-contain rounded border"
                    />
                    <button
                      onClick={handleDeleteLogo}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground">
                    <Upload className="h-6 w-6" />
                  </div>
                )}
                <div>
                  <label className="cursor-pointer">
                    <span className="text-sm text-primary hover:underline">
                      {isUploadingLogo ? "Uploading..." : "Upload logo"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      disabled={isUploadingLogo}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">Max 100KB, PNG or JPG</p>
                </div>
              </div>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#792cd4"
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Header Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border"
                  />
                  <Input
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    placeholder="#792cd4"
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Theme Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium border-b pb-2">Theme</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">Theme Mode</label>
              <select
                value={themeMode}
                onChange={(e) => setThemeMode(e.target.value as typeof themeMode)}
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              >
                <option value="system">System (auto)</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>

          {/* Launcher Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium border-b pb-2">Launcher</h3>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium text-sm">Show Launcher</p>
                <p className="text-xs text-muted-foreground">Display the chat launcher button</p>
              </div>
              <button
                onClick={() => setShowLauncher(!showLauncher)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showLauncher ? "bg-primary" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showLauncher ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Position</label>
                <select
                  value={launcherPosition}
                  onChange={(e) => setLauncherPosition(e.target.value as typeof launcherPosition)}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                >
                  <option value="right">Right</option>
                  <option value="left">Left</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Side Spacing</label>
                <Input
                  type="number"
                  value={launcherSideSpacing}
                  onChange={(e) => setLauncherSideSpacing(Number(e.target.value))}
                  min={0}
                  max={100}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Bottom Spacing: {launcherBottomSpacing}px
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={launcherBottomSpacing}
                onChange={(e) => setLauncherBottomSpacing(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          {/* Content Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium border-b pb-2">Content</h3>

            <div className="space-y-2">
              <label className="text-sm font-medium">Welcome Message</label>
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Hi there! How can we help you today?"
                maxLength={500}
                className="w-full px-3 py-2 border rounded-md text-sm min-h-[80px] bg-background"
              />
              <p className="text-xs text-muted-foreground text-right">
                {welcomeMessage.length}/500
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Team Introduction (optional)</label>
              <Input
                value={teamIntroduction}
                onChange={(e) => setTeamIntroduction(e.target.value)}
                placeholder="We typically reply within a few minutes"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium text-sm">Show Teammate Avatars</p>
                <p className="text-xs text-muted-foreground">Display team member photos in chat</p>
              </div>
              <button
                onClick={() => setShowTeammateAvatars(!showTeammateAvatars)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showTeammateAvatars ? "bg-primary" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showTeammateAvatars ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Languages Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium border-b pb-2">Languages</h3>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => toggleLanguage(lang.code)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    supportedLanguages.includes(lang.code)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-gray-300 hover:border-gray-400"
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Default Language</label>
              <select
                value={defaultLanguage}
                onChange={(e) => setDefaultLanguage(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              >
                {supportedLanguages.map((code) => (
                  <option key={code} value={code}>
                    {SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name ?? code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* General Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium border-b pb-2">General</h3>

            <div className="space-y-2">
              <label className="text-sm font-medium">Privacy Policy URL</label>
              <Input
                value={privacyPolicyUrl}
                onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
                placeholder="https://example.com/privacy"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium text-sm">Mobile SDK Enabled</p>
                <p className="text-xs text-muted-foreground">Allow messenger on mobile apps</p>
              </div>
              <button
                onClick={() => setMobileEnabled(!mobileEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  mobileEnabled ? "bg-primary" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    mobileEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? "Saving..." : "Save Messenger Settings"}
          </Button>
        </div>

        {/* Preview Column */}
        {showPreview && (
          <div className="lg:sticky lg:top-6">
            <div className="border rounded-lg p-4 bg-gray-50">
              <p className="text-xs text-muted-foreground mb-3 text-center">Live Preview</p>
              <div
                className="relative bg-white rounded-lg shadow-lg overflow-hidden"
                style={{ height: "400px" }}
              >
                {/* Preview Header */}
                <div className="p-4 text-white" style={{ backgroundColor }}>
                  <div className="flex items-center gap-3">
                    {logoPreview && (
                      <img
                        src={logoPreview}
                        alt="Logo"
                        className="w-8 h-8 rounded object-contain bg-white/20"
                      />
                    )}
                    <span className="font-semibold">Messages</span>
                  </div>
                </div>

                {/* Preview Content */}
                <div className="p-4">
                  <div
                    className="p-3 rounded-lg text-sm"
                    style={{ backgroundColor: `${primaryColor}15` }}
                  >
                    {welcomeMessage}
                  </div>
                  {teamIntroduction && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      {teamIntroduction}
                    </p>
                  )}
                </div>

                {/* Preview Launcher */}
                <div
                  className="absolute w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg"
                  style={{
                    backgroundColor: primaryColor,
                    bottom: `${launcherBottomSpacing}px`,
                    [launcherPosition]: `${launcherSideSpacing}px`,
                  }}
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
