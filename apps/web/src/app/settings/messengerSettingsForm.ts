import type { Id } from "@opencom/convex/dataModel";
import {
  getDefaultPublicMessengerSettings,
  type PublicMessengerSettings,
} from "@opencom/types";

export const SUPPORTED_LANGUAGES = [
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
] as const;

export interface MessengerSettingsFormState {
  primaryColor: string;
  backgroundColor: string;
  logoPreview: string | null;
  themeMode: PublicMessengerSettings["themeMode"];
  launcherPosition: PublicMessengerSettings["launcherPosition"];
  launcherSideSpacing: number;
  launcherBottomSpacing: number;
  showLauncher: boolean;
  welcomeMessage: string;
  teamIntroduction: string;
  showTeammateAvatars: boolean;
  supportedLanguages: string[];
  defaultLanguage: string;
  privacyPolicyUrl: string;
  mobileEnabled: boolean;
}

export function createMessengerSettingsFormState(
  settings?: Partial<PublicMessengerSettings> & { logo?: string | null }
): MessengerSettingsFormState {
  const defaults = getDefaultPublicMessengerSettings();

  return {
    primaryColor: settings?.primaryColor ?? defaults.primaryColor,
    backgroundColor: settings?.backgroundColor ?? defaults.backgroundColor,
    logoPreview: settings?.logo ?? null,
    themeMode: settings?.themeMode ?? defaults.themeMode,
    launcherPosition: settings?.launcherPosition ?? defaults.launcherPosition,
    launcherSideSpacing: settings?.launcherSideSpacing ?? defaults.launcherSideSpacing,
    launcherBottomSpacing: settings?.launcherBottomSpacing ?? defaults.launcherBottomSpacing,
    showLauncher: settings?.showLauncher ?? defaults.showLauncher,
    welcomeMessage: settings?.welcomeMessage ?? defaults.welcomeMessage,
    teamIntroduction: settings?.teamIntroduction ?? "",
    showTeammateAvatars: settings?.showTeammateAvatars ?? defaults.showTeammateAvatars,
    supportedLanguages: settings?.supportedLanguages
      ? [...settings.supportedLanguages]
      : [...defaults.supportedLanguages],
    defaultLanguage: settings?.defaultLanguage ?? defaults.defaultLanguage,
    privacyPolicyUrl: settings?.privacyPolicyUrl ?? "",
    mobileEnabled: settings?.mobileEnabled ?? defaults.mobileEnabled,
  };
}

export function toggleMessengerLanguage(
  state: MessengerSettingsFormState,
  code: string
): MessengerSettingsFormState {
  if (state.supportedLanguages.includes(code)) {
    if (state.supportedLanguages.length === 1) {
      return state;
    }

    const supportedLanguages = state.supportedLanguages.filter((language) => language !== code);
    return {
      ...state,
      supportedLanguages,
      defaultLanguage:
        state.defaultLanguage === code ? supportedLanguages[0] : state.defaultLanguage,
    };
  }

  return {
    ...state,
    supportedLanguages: [...state.supportedLanguages, code],
  };
}

export function buildMessengerSettingsMutationInput(
  workspaceId: Id<"workspaces">,
  state: MessengerSettingsFormState
) {
  return {
    workspaceId,
    primaryColor: state.primaryColor,
    backgroundColor: state.backgroundColor,
    themeMode: state.themeMode,
    launcherPosition: state.launcherPosition,
    launcherSideSpacing: state.launcherSideSpacing,
    launcherBottomSpacing: state.launcherBottomSpacing,
    showLauncher: state.showLauncher,
    welcomeMessage: state.welcomeMessage,
    teamIntroduction: state.teamIntroduction || null,
    showTeammateAvatars: state.showTeammateAvatars,
    supportedLanguages: state.supportedLanguages,
    defaultLanguage: state.defaultLanguage,
    privacyPolicyUrl: state.privacyPolicyUrl || null,
    mobileEnabled: state.mobileEnabled,
  };
}
