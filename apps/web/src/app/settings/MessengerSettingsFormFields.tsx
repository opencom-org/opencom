import type { Dispatch, SetStateAction } from "react";
import { Button, Input } from "@opencom/ui";
import type { MessengerSettingsFormState } from "./messengerSettingsForm";
import { SUPPORTED_LANGUAGES, toggleMessengerLanguage } from "./messengerSettingsForm";
import { SettingsToggleRow } from "./SettingsToggleRow";

interface MessengerSettingsFormFieldsProps {
  formState: MessengerSettingsFormState;
  setFormState: Dispatch<SetStateAction<MessengerSettingsFormState>>;
  isSaving: boolean;
  isUploadingLogo: boolean;
  onSave: () => void;
  onLogoUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteLogo: () => void;
}

export function MessengerSettingsFormFields({
  formState,
  setFormState,
  isSaving,
  isUploadingLogo,
  onSave,
  onLogoUpload,
  onDeleteLogo,
}: MessengerSettingsFormFieldsProps): React.JSX.Element {
  const updateField = <Key extends keyof MessengerSettingsFormState>(
    key: Key,
    value: MessengerSettingsFormState[Key]
  ) => {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleToggleLanguage = (code: string) => {
    setFormState((current) => toggleMessengerLanguage(current, code));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-medium border-b pb-2">Branding</h3>

        <div className="space-y-2">
          <label className="text-sm font-medium">Logo</label>
          <div className="flex items-center gap-4">
            {formState.logoPreview ? (
              <div className="relative">
                <img
                  src={formState.logoPreview}
                  alt="Logo preview"
                  className="w-16 h-16 object-contain rounded border"
                />
                <button
                  type="button"
                  onClick={onDeleteLogo}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <span className="sr-only">Delete logo</span>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="w-16 h-16 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M4 12l1.586-1.586a2 2 0 012.828 0L12 14l3.586-3.586a2 2 0 012.828 0L20 12M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
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
                  onChange={onLogoUpload}
                  className="hidden"
                  disabled={isUploadingLogo}
                />
              </label>
              <p className="text-xs text-muted-foreground">Max 100KB, PNG or JPG</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Primary Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formState.primaryColor}
                onChange={(event) => updateField("primaryColor", event.target.value)}
                className="w-10 h-10 rounded cursor-pointer border"
              />
              <Input
                value={formState.primaryColor}
                onChange={(event) => updateField("primaryColor", event.target.value)}
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
                value={formState.backgroundColor}
                onChange={(event) => updateField("backgroundColor", event.target.value)}
                className="w-10 h-10 rounded cursor-pointer border"
              />
              <Input
                value={formState.backgroundColor}
                onChange={(event) => updateField("backgroundColor", event.target.value)}
                placeholder="#792cd4"
                className="flex-1 font-mono text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium border-b pb-2">Theme</h3>
        <div className="space-y-2">
          <label className="text-sm font-medium">Theme Mode</label>
          <select
            value={formState.themeMode}
            onChange={(event) => updateField("themeMode", event.target.value as MessengerSettingsFormState["themeMode"])}
            className="w-full px-3 py-2 border rounded-md text-sm bg-background"
          >
            <option value="system">System (auto)</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium border-b pb-2">Launcher</h3>

        <SettingsToggleRow
          title="Show Launcher"
          description="Display the chat launcher button"
          enabled={formState.showLauncher}
          onToggle={() => updateField("showLauncher", !formState.showLauncher)}
        />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Position</label>
            <select
              value={formState.launcherPosition}
              onChange={(event) =>
                updateField(
                  "launcherPosition",
                  event.target.value as MessengerSettingsFormState["launcherPosition"]
                )
              }
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
              value={formState.launcherSideSpacing}
              onChange={(event) => updateField("launcherSideSpacing", Number(event.target.value))}
              min={0}
              max={100}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Bottom Spacing: {formState.launcherBottomSpacing}px
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={formState.launcherBottomSpacing}
            onChange={(event) => updateField("launcherBottomSpacing", Number(event.target.value))}
            className="w-full"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium border-b pb-2">Content</h3>

        <div className="space-y-2">
          <label className="text-sm font-medium">Welcome Message</label>
          <textarea
            value={formState.welcomeMessage}
            onChange={(event) => updateField("welcomeMessage", event.target.value)}
            placeholder="Hi there! How can we help you today?"
            maxLength={500}
            className="w-full px-3 py-2 border rounded-md text-sm min-h-[80px] bg-background"
          />
          <p className="text-xs text-muted-foreground text-right">
            {formState.welcomeMessage.length}/500
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Team Introduction (optional)</label>
          <Input
            value={formState.teamIntroduction}
            onChange={(event) => updateField("teamIntroduction", event.target.value)}
            placeholder="We typically reply within a few minutes"
          />
        </div>

        <SettingsToggleRow
          title="Show Teammate Avatars"
          description="Display team member photos in chat"
          enabled={formState.showTeammateAvatars}
          onToggle={() =>
            updateField("showTeammateAvatars", !formState.showTeammateAvatars)
          }
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium border-b pb-2">Languages</h3>
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_LANGUAGES.map((language) => (
            <button
              key={language.code}
              type="button"
              onClick={() => handleToggleLanguage(language.code)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                formState.supportedLanguages.includes(language.code)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-gray-300 hover:border-gray-400"
              }`}
            >
              {language.name}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Default Language</label>
          <select
            value={formState.defaultLanguage}
            onChange={(event) => updateField("defaultLanguage", event.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm bg-background"
          >
            {formState.supportedLanguages.map((code) => (
              <option key={code} value={code}>
                {SUPPORTED_LANGUAGES.find((language) => language.code === code)?.name ?? code}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium border-b pb-2">General</h3>

        <div className="space-y-2">
          <label className="text-sm font-medium">Privacy Policy URL</label>
          <Input
            value={formState.privacyPolicyUrl}
            onChange={(event) => updateField("privacyPolicyUrl", event.target.value)}
            placeholder="https://example.com/privacy"
          />
        </div>

        <SettingsToggleRow
          title="Mobile SDK Enabled"
          description="Allow messenger on mobile apps"
          enabled={formState.mobileEnabled}
          onToggle={() => updateField("mobileEnabled", !formState.mobileEnabled)}
        />
      </div>

      <Button onClick={onSave} disabled={isSaving} className="w-full">
        {isSaving ? "Saving..." : "Save Messenger Settings"}
      </Button>
    </div>
  );
}
