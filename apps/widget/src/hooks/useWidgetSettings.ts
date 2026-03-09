import { useState, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import type { Id } from "@opencom/convex/dataModel";
import {
  getDefaultPublicMessengerSettings,
  normalizePublicMessengerSettings,
  type PublicMessengerSettings,
} from "@opencom/types";
import { getThemeRoot } from "../portal";

export type MessengerSettings = PublicMessengerSettings;

const DEFAULT_SETTINGS: MessengerSettings = getDefaultPublicMessengerSettings();

const publicMessengerSettingsQueryRef = makeFunctionReference<
  "query",
  { workspaceId: Id<"workspaces"> },
  Partial<PublicMessengerSettings> | null
>("messengerSettings:getPublicSettings");

function getEffectiveTheme(themeMode: "light" | "dark" | "system"): "light" | "dark" {
  if (themeMode === "system") {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return themeMode;
}

/** Build a workspace-scoped cache key so different workspaces never collide. */
function settingsCacheKey(workspaceId: string): string {
  return `opencom_settings_cache_${workspaceId}`;
}

export function useWidgetSettings(activeWorkspaceId: string | undefined, isValidIdFormat: boolean) {
  // Messenger customization settings
  const messengerSettingsData = useQuery(
    publicMessengerSettingsQueryRef,
    isValidIdFormat ? { workspaceId: activeWorkspaceId as Id<"workspaces"> } : "skip"
  ) as Partial<PublicMessengerSettings> | null | undefined;

  // Merge fetched settings with defaults, cache in localStorage scoped by workspace
  const messengerSettings = useMemo<MessengerSettings>(() => {
    if (messengerSettingsData) {
      const normalizedSettings = normalizePublicMessengerSettings(
        messengerSettingsData as Partial<PublicMessengerSettings>
      );

      // Cache settings for faster initial render next time (scoped per workspace)
      try {
        if (activeWorkspaceId) {
          localStorage.setItem(
            settingsCacheKey(activeWorkspaceId),
            JSON.stringify(normalizedSettings)
          );
        }
      } catch {
        // Ignore localStorage errors
      }
      return normalizedSettings;
    }
    // Try to load cached settings scoped to this workspace
    try {
      if (activeWorkspaceId) {
        const cached = localStorage.getItem(settingsCacheKey(activeWorkspaceId));
        if (cached) {
          return normalizePublicMessengerSettings(
            JSON.parse(cached) as Partial<PublicMessengerSettings>
          );
        }
      }
    } catch {
      // Ignore parse errors
    }
    return DEFAULT_SETTINGS;
  }, [messengerSettingsData, activeWorkspaceId]);

  // Determine effective theme (light/dark) based on settings
  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">(() =>
    getEffectiveTheme(messengerSettings.themeMode)
  );

  // Listen for system theme changes when in system mode
  useEffect(() => {
    setEffectiveTheme(getEffectiveTheme(messengerSettings.themeMode));

    if (messengerSettings.themeMode === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        setEffectiveTheme(e.matches ? "dark" : "light");
      };
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [messengerSettings.themeMode]);

  // Apply CSS custom properties for theming.
  // With Shadow DOM the properties go on the shadow host (:host) so they
  // inherit into the shadow tree. Falls back to document.documentElement
  // when Shadow DOM is not in use.
  useEffect(() => {
    const root = getThemeRoot();
    root.style.setProperty("--opencom-primary-color", messengerSettings.primaryColor);
    root.style.setProperty("--opencom-background-color", messengerSettings.backgroundColor);
    root.style.setProperty(
      "--opencom-launcher-bottom",
      `${messengerSettings.launcherBottomSpacing}px`
    );

    if (messengerSettings.launcherPosition === "left") {
      root.style.setProperty(
        "--opencom-launcher-position-left",
        `${messengerSettings.launcherSideSpacing}px`
      );
      root.style.setProperty("--opencom-launcher-position-right", "auto");
    } else {
      root.style.setProperty(
        "--opencom-launcher-position-right",
        `${messengerSettings.launcherSideSpacing}px`
      );
      root.style.setProperty("--opencom-launcher-position-left", "auto");
    }
  }, [messengerSettings]);

  return { messengerSettings, effectiveTheme };
}

export { DEFAULT_SETTINGS, getEffectiveTheme };
