import { useColorScheme } from "react-native";
import {
  normalizePublicMessengerSettings,
  type PublicMessengerSettings,
} from "@opencom/types";
import { sdkQueryRef, useSdkQuery } from "../internal/convex";
import { useSdkResolvedWorkspaceId } from "../internal/opencomContext";

export interface OpencomTheme {
  primaryColor: string;
  backgroundColor: string;
  textOnPrimary: string;
  textColor: string;
  textMuted: string;
  surfaceColor: string;
  cardColor: string;
  mutedColor: string;
  borderColor: string;
  isDark: boolean;
}

export type MessengerSettings = PublicMessengerSettings;

const LIGHT_THEME_COLORS = {
  textOnPrimary: "#FFFFFF",
  textColor: "#1F2937",
  textMuted: "#6B7280",
  surfaceColor: "#FFFFFF",
  cardColor: "#FFFFFF",
  mutedColor: "#F3F4F6",
  borderColor: "#E5E7EB",
};

const DARK_THEME_COLORS = {
  textOnPrimary: "#FFFFFF",
  textColor: "#F3F4F6",
  textMuted: "#9CA3AF",
  surfaceColor: "#1F2937",
  cardColor: "#374151",
  mutedColor: "#374151",
  borderColor: "#4B5563",
};

const PUBLIC_SETTINGS_REF = sdkQueryRef("messengerSettings:getPublicSettings");

export function useMessengerSettings(): {
  settings: MessengerSettings;
  theme: OpencomTheme;
  isLoading: boolean;
} {
  const workspaceId = useSdkResolvedWorkspaceId();
  const systemColorScheme = useColorScheme();

  const settingsData = useSdkQuery<Partial<PublicMessengerSettings>>(
    PUBLIC_SETTINGS_REF,
    workspaceId ? { workspaceId } : "skip"
  );

  const settings: MessengerSettings = normalizePublicMessengerSettings(
    settingsData as Partial<PublicMessengerSettings> | undefined
  );

  // Determine effective theme mode
  const effectiveThemeMode =
    settings.themeMode === "system" ? (systemColorScheme ?? "light") : settings.themeMode;

  const isDark = effectiveThemeMode === "dark";
  const themeColors = isDark ? DARK_THEME_COLORS : LIGHT_THEME_COLORS;

  const theme: OpencomTheme = {
    primaryColor: settings.primaryColor,
    backgroundColor: settings.backgroundColor,
    isDark,
    ...themeColors,
  };

  return {
    settings,
    theme,
    isLoading: settingsData === undefined,
  };
}

export function useOpencomTheme(): OpencomTheme {
  const { theme } = useMessengerSettings();
  return theme;
}
