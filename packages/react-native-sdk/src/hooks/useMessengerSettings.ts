import { useQuery } from "convex/react";
import { api } from "@opencom/convex";
import { useOpencomContext } from "../components/OpencomProvider";
import { useColorScheme } from "react-native";
import type { Id } from "@opencom/convex/dataModel";
import {
  normalizePublicMessengerSettings,
  type PublicMessengerSettings,
} from "@opencom/types";

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

export function useMessengerSettings(): {
  settings: MessengerSettings;
  theme: OpencomTheme;
  isLoading: boolean;
} {
  const { workspaceId } = useOpencomContext();
  const systemColorScheme = useColorScheme();

  const settingsData = useQuery(
    api.messengerSettings.getPublicSettings,
    workspaceId ? { workspaceId: workspaceId as Id<"workspaces"> } : "skip"
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
