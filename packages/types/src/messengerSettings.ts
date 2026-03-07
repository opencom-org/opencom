export type MessengerThemeMode = "light" | "dark" | "system";
export type MessengerLauncherPosition = "left" | "right";

export interface PublicMessengerSettings {
  primaryColor: string;
  backgroundColor: string;
  themeMode: MessengerThemeMode;
  launcherPosition: MessengerLauncherPosition;
  launcherSideSpacing: number;
  launcherBottomSpacing: number;
  showLauncher: boolean;
  welcomeMessage: string;
  teamIntroduction: string | null;
  showTeammateAvatars: boolean;
  supportedLanguages: string[];
  defaultLanguage: string;
  mobileEnabled: boolean;
  logo: string | null;
  launcherIconUrl: string | null;
  privacyPolicyUrl: string | null;
  launcherAudienceRules: unknown | null;
}

const DEFAULT_PUBLIC_MESSENGER_SETTINGS: Readonly<PublicMessengerSettings> = {
  primaryColor: "#792cd4",
  backgroundColor: "#792cd4",
  themeMode: "system",
  launcherPosition: "right",
  launcherSideSpacing: 20,
  launcherBottomSpacing: 20,
  showLauncher: true,
  welcomeMessage: "Hi there! How can we help you today?",
  teamIntroduction: null,
  showTeammateAvatars: true,
  supportedLanguages: ["en"],
  defaultLanguage: "en",
  mobileEnabled: true,
  logo: null,
  launcherIconUrl: null,
  privacyPolicyUrl: null,
  launcherAudienceRules: null,
};

export function getDefaultPublicMessengerSettings(): PublicMessengerSettings {
  return {
    ...DEFAULT_PUBLIC_MESSENGER_SETTINGS,
    supportedLanguages: [...DEFAULT_PUBLIC_MESSENGER_SETTINGS.supportedLanguages],
  };
}

export function normalizePublicMessengerSettings(
  settings?: Partial<PublicMessengerSettings>
): PublicMessengerSettings {
  const defaults = getDefaultPublicMessengerSettings();
  if (!settings) {
    return defaults;
  }

  return {
    primaryColor: settings.primaryColor ?? defaults.primaryColor,
    backgroundColor: settings.backgroundColor ?? defaults.backgroundColor,
    themeMode: settings.themeMode ?? defaults.themeMode,
    launcherPosition: settings.launcherPosition ?? defaults.launcherPosition,
    launcherSideSpacing: settings.launcherSideSpacing ?? defaults.launcherSideSpacing,
    launcherBottomSpacing: settings.launcherBottomSpacing ?? defaults.launcherBottomSpacing,
    showLauncher: settings.showLauncher ?? defaults.showLauncher,
    welcomeMessage: settings.welcomeMessage ?? defaults.welcomeMessage,
    teamIntroduction: settings.teamIntroduction ?? defaults.teamIntroduction,
    showTeammateAvatars: settings.showTeammateAvatars ?? defaults.showTeammateAvatars,
    supportedLanguages: settings.supportedLanguages
      ? [...settings.supportedLanguages]
      : defaults.supportedLanguages,
    defaultLanguage: settings.defaultLanguage ?? defaults.defaultLanguage,
    mobileEnabled: settings.mobileEnabled ?? defaults.mobileEnabled,
    logo: settings.logo ?? defaults.logo,
    launcherIconUrl: settings.launcherIconUrl ?? defaults.launcherIconUrl,
    privacyPolicyUrl: settings.privacyPolicyUrl ?? defaults.privacyPolicyUrl,
    launcherAudienceRules: settings.launcherAudienceRules ?? defaults.launcherAudienceRules,
  };
}
