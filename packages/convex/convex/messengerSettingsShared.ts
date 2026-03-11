import { v } from "convex/values";
import {
  getDefaultHomeConfig,
  getDefaultPublicMessengerSettings,
  isVisibleToAudience,
  normalizeHomeConfig as normalizeSharedHomeConfig,
  normalizePublicMessengerSettings,
  resolveDefaultHomeSpace,
  type HomeConfig,
  type HomeTab,
  type PublicMessengerSettings,
} from "@opencom/types";
import { audienceRulesValidator, jsonObjectValidator } from "./validators";

export const DEFAULT_PUBLIC_SETTINGS = getDefaultPublicMessengerSettings();

// Default persisted settings for new workspaces.
export const DEFAULT_SETTINGS = {
  primaryColor: DEFAULT_PUBLIC_SETTINGS.primaryColor,
  backgroundColor: DEFAULT_PUBLIC_SETTINGS.backgroundColor,
  themeMode: DEFAULT_PUBLIC_SETTINGS.themeMode,
  launcherPosition: DEFAULT_PUBLIC_SETTINGS.launcherPosition,
  launcherSideSpacing: DEFAULT_PUBLIC_SETTINGS.launcherSideSpacing,
  launcherBottomSpacing: DEFAULT_PUBLIC_SETTINGS.launcherBottomSpacing,
  showLauncher: DEFAULT_PUBLIC_SETTINGS.showLauncher,
  welcomeMessage: DEFAULT_PUBLIC_SETTINGS.welcomeMessage,
  showTeammateAvatars: DEFAULT_PUBLIC_SETTINGS.showTeammateAvatars,
  supportedLanguages: DEFAULT_PUBLIC_SETTINGS.supportedLanguages,
  defaultLanguage: DEFAULT_PUBLIC_SETTINGS.defaultLanguage,
  mobileEnabled: DEFAULT_PUBLIC_SETTINGS.mobileEnabled,
};

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

export const messengerSettingsUpsertArgs = {
  workspaceId: v.id("workspaces"),
  primaryColor: v.optional(v.string()),
  backgroundColor: v.optional(v.string()),
  themeMode: v.optional(v.union(v.literal("light"), v.literal("dark"), v.literal("system"))),
  launcherPosition: v.optional(v.union(v.literal("right"), v.literal("left"))),
  launcherSideSpacing: v.optional(v.number()),
  launcherBottomSpacing: v.optional(v.number()),
  launcherIconUrl: v.optional(v.union(v.string(), v.null())),
  showLauncher: v.optional(v.boolean()),
  launcherAudienceRules: v.optional(audienceRulesValidator),
  welcomeMessage: v.optional(v.string()),
  teamIntroduction: v.optional(v.union(v.string(), v.null())),
  showTeammateAvatars: v.optional(v.boolean()),
  supportedLanguages: v.optional(v.array(v.string())),
  defaultLanguage: v.optional(v.string()),
  privacyPolicyUrl: v.optional(v.union(v.string(), v.null())),
  mobileEnabled: v.optional(v.boolean()),
};

export const homeCardValidator = v.object({
  id: v.string(),
  type: v.union(
    v.literal("welcome"),
    v.literal("search"),
    v.literal("conversations"),
    v.literal("startConversation"),
    v.literal("featuredArticles"),
    v.literal("announcements")
  ),
  config: v.optional(jsonObjectValidator),
  visibleTo: v.union(v.literal("all"), v.literal("visitors"), v.literal("users")),
});

const homeTabValidator = v.object({
  id: v.union(
    v.literal("home"),
    v.literal("messages"),
    v.literal("help"),
    v.literal("tours"),
    v.literal("tasks"),
    v.literal("tickets")
  ),
  enabled: v.boolean(),
  visibleTo: v.union(v.literal("all"), v.literal("visitors"), v.literal("users")),
});

export const homeConfigValidator = v.object({
  enabled: v.boolean(),
  cards: v.array(homeCardValidator),
  defaultSpace: v.union(v.literal("home"), v.literal("messages"), v.literal("help")),
  launchDirectlyToConversation: v.optional(v.boolean()),
  tabs: v.optional(v.array(homeTabValidator)),
});

export const homeCardUpdatesValidator = v.object({
  config: v.optional(jsonObjectValidator),
  visibleTo: v.optional(v.union(v.literal("all"), v.literal("visitors"), v.literal("users"))),
});

export const DEFAULT_HOME_CONFIG: HomeConfig = getDefaultHomeConfig();

export function isValidHexColor(color: string): boolean {
  return HEX_COLOR_REGEX.test(color);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function toPublicMessengerSettings(args?: {
  primaryColor?: string;
  backgroundColor?: string;
  themeMode?: PublicMessengerSettings["themeMode"];
  launcherPosition?: PublicMessengerSettings["launcherPosition"];
  launcherSideSpacing?: number;
  launcherBottomSpacing?: number;
  showLauncher?: boolean;
  welcomeMessage?: string;
  showTeammateAvatars?: boolean;
  supportedLanguages?: string[];
  defaultLanguage?: string;
  mobileEnabled?: boolean;
  logo?: string | null;
  launcherIconUrl?: string | null;
  teamIntroduction?: string | null;
  privacyPolicyUrl?: string | null;
  launcherAudienceRules?: unknown;
}): PublicMessengerSettings {
  return normalizePublicMessengerSettings(
    args
      ? {
          primaryColor: args.primaryColor,
          backgroundColor: args.backgroundColor,
          themeMode: args.themeMode,
          launcherPosition: args.launcherPosition,
          launcherSideSpacing: args.launcherSideSpacing,
          launcherBottomSpacing: args.launcherBottomSpacing,
          showLauncher: args.showLauncher,
          welcomeMessage: args.welcomeMessage,
          showTeammateAvatars: args.showTeammateAvatars,
          supportedLanguages: args.supportedLanguages,
          defaultLanguage: args.defaultLanguage,
          mobileEnabled: args.mobileEnabled,
          logo: args.logo ?? null,
          launcherIconUrl: args.launcherIconUrl ?? null,
          teamIntroduction: args.teamIntroduction ?? null,
          privacyPolicyUrl: args.privacyPolicyUrl ?? null,
          launcherAudienceRules: args.launcherAudienceRules ?? null,
        }
      : undefined
  );
}

export function normalizeMessengerHomeConfig(
  homeConfig: HomeConfig | undefined
): HomeConfig & { launchDirectlyToConversation: boolean; tabs: HomeTab[] } {
  return normalizeSharedHomeConfig(homeConfig, DEFAULT_HOME_CONFIG);
}

export function buildPublicHomeConfig(
  homeConfig: ReturnType<typeof normalizeMessengerHomeConfig>,
  isIdentified: boolean
) {
  const visibleTabs = homeConfig.tabs.filter(
    (tab) =>
      tab.enabled &&
      isVisibleToAudience(tab.visibleTo, isIdentified) &&
      (tab.id !== "home" || homeConfig.enabled)
  );
  const defaultSpace = resolveDefaultHomeSpace(
    homeConfig.defaultSpace,
    visibleTabs,
    homeConfig.enabled
  );

  if (!homeConfig.enabled) {
    return {
      enabled: false,
      defaultSpace,
      launchDirectlyToConversation: homeConfig.launchDirectlyToConversation,
      cards: [],
      tabs: visibleTabs,
    };
  }

  return {
    enabled: homeConfig.enabled,
    defaultSpace,
    launchDirectlyToConversation: homeConfig.launchDirectlyToConversation,
    cards: homeConfig.cards.filter((card) => isVisibleToAudience(card.visibleTo, isIdentified)),
    tabs: visibleTabs,
  };
}
