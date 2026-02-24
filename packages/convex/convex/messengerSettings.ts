import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthenticatedUserFromSession } from "./auth";
import { hasPermission, requirePermission } from "./permissions";
import { audienceRulesValidator, jsonObjectValidator } from "./validators";

// Default settings for new workspaces
const DEFAULT_SETTINGS = {
  primaryColor: "#792cd4",
  backgroundColor: "#792cd4",
  themeMode: "system" as const,
  launcherPosition: "right" as const,
  launcherSideSpacing: 20,
  launcherBottomSpacing: 20,
  showLauncher: true,
  welcomeMessage: "Hi there! How can we help you today?",
  showTeammateAvatars: true,
  supportedLanguages: ["en"],
  defaultLanguage: "en",
  mobileEnabled: true,
};

// Hex color validation regex
const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

function isValidHexColor(color: string): boolean {
  return HEX_COLOR_REGEX.test(color);
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

async function canReadWorkspaceSettings(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
): Promise<boolean> {
  const user = await getAuthenticatedUserFromSession(ctx);
  if (!user) {
    return false;
  }
  return await hasPermission(ctx, user._id, workspaceId, "settings.workspace");
}

async function requireWorkspaceSettingsPermission(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
): Promise<void> {
  const user = await getAuthenticatedUserFromSession(ctx);
  if (!user) {
    throw new Error("Not authenticated");
  }
  await requirePermission(ctx, user._id, workspaceId, "settings.workspace");
}

export const get = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const canRead = await canReadWorkspaceSettings(ctx, args.workspaceId);
    if (!canRead) {
      return null;
    }

    const result = await ctx.db
      .query("messengerSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    return result;
  },
});

export const getOrCreate = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const canRead = await canReadWorkspaceSettings(ctx, args.workspaceId);
    if (!canRead) {
      return null;
    }

    const existing = await ctx.db
      .query("messengerSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (existing) {
      // If logo has a storage ID, generate the URL
      if (existing.logoStorageId) {
        const logoUrl = await ctx.storage.getUrl(existing.logoStorageId);
        return { ...existing, logo: logoUrl };
      }
      return existing;
    }

    // Return default settings (not persisted until update)
    return {
      workspaceId: args.workspaceId,
      ...DEFAULT_SETTINGS,
      logo: null,
      logoStorageId: null,
      launcherIconUrl: null,
      teamIntroduction: null,
      privacyPolicyUrl: null,
      launcherAudienceRules: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  },
});

// Public query for widget/SDK consumption (no auth required)
export const getPublicSettings = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("messengerSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!settings) {
      // Return defaults for workspaces without custom settings
      return {
        primaryColor: DEFAULT_SETTINGS.primaryColor,
        backgroundColor: DEFAULT_SETTINGS.backgroundColor,
        themeMode: DEFAULT_SETTINGS.themeMode,
        launcherPosition: DEFAULT_SETTINGS.launcherPosition,
        launcherSideSpacing: DEFAULT_SETTINGS.launcherSideSpacing,
        launcherBottomSpacing: DEFAULT_SETTINGS.launcherBottomSpacing,
        showLauncher: DEFAULT_SETTINGS.showLauncher,
        welcomeMessage: DEFAULT_SETTINGS.welcomeMessage,
        showTeammateAvatars: DEFAULT_SETTINGS.showTeammateAvatars,
        supportedLanguages: DEFAULT_SETTINGS.supportedLanguages,
        defaultLanguage: DEFAULT_SETTINGS.defaultLanguage,
        mobileEnabled: DEFAULT_SETTINGS.mobileEnabled,
        logo: null,
        launcherIconUrl: null,
        teamIntroduction: null,
        privacyPolicyUrl: null,
        launcherAudienceRules: null,
      };
    }

    // Generate logo URL if storage ID exists
    let logoUrl: string | undefined = settings.logo ?? undefined;
    if (settings.logoStorageId) {
      logoUrl = (await ctx.storage.getUrl(settings.logoStorageId)) ?? undefined;
    }

    return {
      primaryColor: settings.primaryColor,
      backgroundColor: settings.backgroundColor,
      themeMode: settings.themeMode,
      launcherPosition: settings.launcherPosition,
      launcherSideSpacing: settings.launcherSideSpacing,
      launcherBottomSpacing: settings.launcherBottomSpacing,
      showLauncher: settings.showLauncher,
      welcomeMessage: settings.welcomeMessage,
      showTeammateAvatars: settings.showTeammateAvatars,
      supportedLanguages: settings.supportedLanguages,
      defaultLanguage: settings.defaultLanguage,
      mobileEnabled: settings.mobileEnabled,
      logo: logoUrl,
      launcherIconUrl: settings.launcherIconUrl,
      teamIntroduction: settings.teamIntroduction,
      privacyPolicyUrl: settings.privacyPolicyUrl,
      launcherAudienceRules: settings.launcherAudienceRules,
    };
  },
});

export const upsert = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    await requireWorkspaceSettingsPermission(ctx, args.workspaceId);

    // Validate colors
    if (args.primaryColor && !isValidHexColor(args.primaryColor)) {
      throw new Error("Invalid primary color format. Must be a valid hex color (e.g., #792cd4)");
    }
    if (args.backgroundColor && !isValidHexColor(args.backgroundColor)) {
      throw new Error("Invalid background color format. Must be a valid hex color (e.g., #792cd4)");
    }

    // Validate URLs
    if (
      args.privacyPolicyUrl &&
      args.privacyPolicyUrl !== null &&
      !isValidUrl(args.privacyPolicyUrl)
    ) {
      throw new Error("Invalid privacy policy URL format");
    }
    if (
      args.launcherIconUrl &&
      args.launcherIconUrl !== null &&
      !isValidUrl(args.launcherIconUrl)
    ) {
      throw new Error("Invalid launcher icon URL format");
    }

    // Validate spacing values
    if (
      args.launcherSideSpacing !== undefined &&
      (args.launcherSideSpacing < 0 || args.launcherSideSpacing > 100)
    ) {
      throw new Error("Launcher side spacing must be between 0 and 100 pixels");
    }
    if (
      args.launcherBottomSpacing !== undefined &&
      (args.launcherBottomSpacing < 0 || args.launcherBottomSpacing > 100)
    ) {
      throw new Error("Launcher bottom spacing must be between 0 and 100 pixels");
    }

    // Validate welcome message length
    if (args.welcomeMessage && args.welcomeMessage.length > 500) {
      throw new Error("Welcome message must be 500 characters or less");
    }

    const existing = await ctx.db
      .query("messengerSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const now = Date.now();

    if (existing) {
      const updates: Record<string, unknown> = { updatedAt: now };

      if (args.primaryColor !== undefined) updates.primaryColor = args.primaryColor;
      if (args.backgroundColor !== undefined) updates.backgroundColor = args.backgroundColor;
      if (args.themeMode !== undefined) updates.themeMode = args.themeMode;
      if (args.launcherPosition !== undefined) updates.launcherPosition = args.launcherPosition;
      if (args.launcherSideSpacing !== undefined)
        updates.launcherSideSpacing = args.launcherSideSpacing;
      if (args.launcherBottomSpacing !== undefined)
        updates.launcherBottomSpacing = args.launcherBottomSpacing;
      if (args.launcherIconUrl !== undefined)
        updates.launcherIconUrl = args.launcherIconUrl === null ? undefined : args.launcherIconUrl;
      if (args.showLauncher !== undefined) updates.showLauncher = args.showLauncher;
      if (args.launcherAudienceRules !== undefined)
        updates.launcherAudienceRules = args.launcherAudienceRules;
      if (args.welcomeMessage !== undefined) updates.welcomeMessage = args.welcomeMessage;
      if (args.teamIntroduction !== undefined)
        updates.teamIntroduction =
          args.teamIntroduction === null ? undefined : args.teamIntroduction;
      if (args.showTeammateAvatars !== undefined)
        updates.showTeammateAvatars = args.showTeammateAvatars;
      if (args.supportedLanguages !== undefined)
        updates.supportedLanguages = args.supportedLanguages;
      if (args.defaultLanguage !== undefined) updates.defaultLanguage = args.defaultLanguage;
      if (args.privacyPolicyUrl !== undefined)
        updates.privacyPolicyUrl =
          args.privacyPolicyUrl === null ? undefined : args.privacyPolicyUrl;
      if (args.mobileEnabled !== undefined) updates.mobileEnabled = args.mobileEnabled;

      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    return await ctx.db.insert("messengerSettings", {
      workspaceId: args.workspaceId,
      primaryColor: args.primaryColor ?? DEFAULT_SETTINGS.primaryColor,
      backgroundColor: args.backgroundColor ?? DEFAULT_SETTINGS.backgroundColor,
      themeMode: args.themeMode ?? DEFAULT_SETTINGS.themeMode,
      launcherPosition: args.launcherPosition ?? DEFAULT_SETTINGS.launcherPosition,
      launcherSideSpacing: args.launcherSideSpacing ?? DEFAULT_SETTINGS.launcherSideSpacing,
      launcherBottomSpacing: args.launcherBottomSpacing ?? DEFAULT_SETTINGS.launcherBottomSpacing,
      launcherIconUrl: args.launcherIconUrl ?? undefined,
      showLauncher: args.showLauncher ?? DEFAULT_SETTINGS.showLauncher,
      launcherAudienceRules: args.launcherAudienceRules ?? undefined,
      welcomeMessage: args.welcomeMessage ?? DEFAULT_SETTINGS.welcomeMessage,
      teamIntroduction: args.teamIntroduction ?? undefined,
      showTeammateAvatars: args.showTeammateAvatars ?? DEFAULT_SETTINGS.showTeammateAvatars,
      supportedLanguages: args.supportedLanguages ?? DEFAULT_SETTINGS.supportedLanguages,
      defaultLanguage: args.defaultLanguage ?? DEFAULT_SETTINGS.defaultLanguage,
      privacyPolicyUrl: args.privacyPolicyUrl ?? undefined,
      mobileEnabled: args.mobileEnabled ?? DEFAULT_SETTINGS.mobileEnabled,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Generate upload URL for logo
export const generateLogoUploadUrl = mutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceSettingsPermission(ctx, args.workspaceId);

    // Verify workspace exists
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    return await ctx.storage.generateUploadUrl();
  },
});

// Save uploaded logo
export const saveLogo = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceSettingsPermission(ctx, args.workspaceId);

    const existing = await ctx.db
      .query("messengerSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const now = Date.now();

    // Delete old logo if exists
    if (existing?.logoStorageId) {
      await ctx.storage.delete(existing.logoStorageId);
    }

    // Get the URL for the new logo
    const logoUrl = (await ctx.storage.getUrl(args.storageId)) ?? undefined;

    if (existing) {
      await ctx.db.patch(existing._id, {
        logoStorageId: args.storageId,
        logo: logoUrl,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create settings with the logo
    return await ctx.db.insert("messengerSettings", {
      workspaceId: args.workspaceId,
      logoStorageId: args.storageId,
      logo: logoUrl ?? undefined,
      ...DEFAULT_SETTINGS,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Delete logo
export const deleteLogo = mutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceSettingsPermission(ctx, args.workspaceId);

    const existing = await ctx.db
      .query("messengerSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!existing) {
      throw new Error("Messenger settings not found");
    }

    // Delete from storage if exists
    if (existing.logoStorageId) {
      await ctx.storage.delete(existing.logoStorageId);
    }

    await ctx.db.patch(existing._id, {
      logoStorageId: undefined,
      logo: undefined,
      updatedAt: Date.now(),
    });

    return existing._id;
  },
});

// Home Configuration Types
const homeCardValidator = v.object({
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

const homeConfigValidator = v.object({
  enabled: v.boolean(),
  cards: v.array(homeCardValidator),
  defaultSpace: v.union(v.literal("home"), v.literal("messages"), v.literal("help")),
  launchDirectlyToConversation: v.optional(v.boolean()),
});

// Default home configuration for new workspaces
const DEFAULT_HOME_CONFIG = {
  enabled: true,
  cards: [
    { id: "welcome-1", type: "welcome" as const, visibleTo: "all" as const },
    { id: "search-1", type: "search" as const, visibleTo: "all" as const },
    { id: "conversations-1", type: "conversations" as const, visibleTo: "all" as const },
    { id: "startConversation-1", type: "startConversation" as const, visibleTo: "all" as const },
  ],
  defaultSpace: "home" as const,
  launchDirectlyToConversation: false,
};

// Get home configuration for a workspace
export const getHomeConfig = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const canRead = await canReadWorkspaceSettings(ctx, args.workspaceId);
    if (!canRead) {
      return DEFAULT_HOME_CONFIG;
    }

    const settings = await ctx.db
      .query("messengerSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!settings || !settings.homeConfig) {
      return DEFAULT_HOME_CONFIG;
    }

    return settings.homeConfig;
  },
});

// Public query for widget/SDK - returns home config with visitor/user filtering
export const getPublicHomeConfig = query({
  args: {
    workspaceId: v.id("workspaces"),
    isIdentified: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("messengerSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const homeConfig = settings?.homeConfig ?? DEFAULT_HOME_CONFIG;

    if (!homeConfig.enabled) {
      return {
        enabled: false,
        defaultSpace: homeConfig.defaultSpace,
        launchDirectlyToConversation: homeConfig.launchDirectlyToConversation ?? false,
        cards: [],
      };
    }

    // Filter cards based on visitor/user status
    const isUser = args.isIdentified ?? false;
    const cards = homeConfig.cards as Array<{
      id: string;
      type: string;
      config?: unknown;
      visibleTo: "all" | "visitors" | "users";
    }>;
    const filteredCards = cards.filter((card) => {
      if (card.visibleTo === "all") return true;
      if (card.visibleTo === "users" && isUser) return true;
      if (card.visibleTo === "visitors" && !isUser) return true;
      return false;
    });

    return {
      enabled: homeConfig.enabled,
      defaultSpace: homeConfig.defaultSpace,
      launchDirectlyToConversation: homeConfig.launchDirectlyToConversation ?? false,
      cards: filteredCards,
    };
  },
});

// Update home configuration
export const updateHomeConfig = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    homeConfig: homeConfigValidator,
  },
  handler: async (ctx, args) => {
    await requireWorkspaceSettingsPermission(ctx, args.workspaceId);

    // Validate card IDs are unique
    const cardIds = args.homeConfig.cards.map((c) => c.id);
    if (new Set(cardIds).size !== cardIds.length) {
      throw new Error("Card IDs must be unique");
    }

    const existing = await ctx.db
      .query("messengerSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        homeConfig: args.homeConfig,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new settings with home config
    return await ctx.db.insert("messengerSettings", {
      workspaceId: args.workspaceId,
      homeConfig: args.homeConfig,
      ...DEFAULT_SETTINGS,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Toggle home enabled/disabled
export const toggleHomeEnabled = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceSettingsPermission(ctx, args.workspaceId);

    const existing = await ctx.db
      .query("messengerSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const now = Date.now();

    if (existing) {
      const currentConfig = existing.homeConfig ?? DEFAULT_HOME_CONFIG;
      await ctx.db.patch(existing._id, {
        homeConfig: { ...currentConfig, enabled: args.enabled },
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new settings
    return await ctx.db.insert("messengerSettings", {
      workspaceId: args.workspaceId,
      homeConfig: { ...DEFAULT_HOME_CONFIG, enabled: args.enabled },
      ...DEFAULT_SETTINGS,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Add a card to home configuration
export const addHomeCard = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    card: homeCardValidator,
    position: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceSettingsPermission(ctx, args.workspaceId);

    const existing = await ctx.db
      .query("messengerSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const currentConfig = existing?.homeConfig ?? DEFAULT_HOME_CONFIG;

    // Check for duplicate ID
    if (currentConfig.cards.some((c) => c.id === args.card.id)) {
      throw new Error("A card with this ID already exists");
    }

    const newCards = [...currentConfig.cards];
    const position = args.position ?? newCards.length;
    newCards.splice(position, 0, args.card);

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        homeConfig: { ...currentConfig, cards: newCards },
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("messengerSettings", {
      workspaceId: args.workspaceId,
      homeConfig: { ...currentConfig, cards: newCards },
      ...DEFAULT_SETTINGS,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Remove a card from home configuration
export const removeHomeCard = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    cardId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceSettingsPermission(ctx, args.workspaceId);

    const existing = await ctx.db
      .query("messengerSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!existing || !existing.homeConfig) {
      throw new Error("Home configuration not found");
    }

    const newCards = existing.homeConfig.cards.filter((c) => c.id !== args.cardId);

    await ctx.db.patch(existing._id, {
      homeConfig: { ...existing.homeConfig, cards: newCards },
      updatedAt: Date.now(),
    });

    return existing._id;
  },
});

// Reorder cards in home configuration
export const reorderHomeCards = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    cardIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceSettingsPermission(ctx, args.workspaceId);

    const existing = await ctx.db
      .query("messengerSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!existing || !existing.homeConfig) {
      throw new Error("Home configuration not found");
    }

    // Validate all card IDs exist
    const existingIds = new Set(existing.homeConfig.cards.map((c) => c.id));
    for (const id of args.cardIds) {
      if (!existingIds.has(id)) {
        throw new Error(`Card with ID "${id}" not found`);
      }
    }

    // Reorder cards based on the provided order
    const cardMap = new Map(existing.homeConfig.cards.map((c) => [c.id, c]));
    const reorderedCards = args.cardIds.map((id) => cardMap.get(id)!);

    await ctx.db.patch(existing._id, {
      homeConfig: { ...existing.homeConfig, cards: reorderedCards },
      updatedAt: Date.now(),
    });

    return existing._id;
  },
});

// Update a specific card's configuration
export const updateHomeCard = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    cardId: v.string(),
    updates: v.object({
      config: v.optional(jsonObjectValidator),
      visibleTo: v.optional(v.union(v.literal("all"), v.literal("visitors"), v.literal("users"))),
    }),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceSettingsPermission(ctx, args.workspaceId);

    const existing = await ctx.db
      .query("messengerSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!existing || !existing.homeConfig) {
      throw new Error("Home configuration not found");
    }

    const cardIndex = existing.homeConfig.cards.findIndex((c) => c.id === args.cardId);
    if (cardIndex === -1) {
      throw new Error("Card not found");
    }

    const updatedCards = [...existing.homeConfig.cards];
    updatedCards[cardIndex] = {
      ...updatedCards[cardIndex],
      ...(args.updates.config !== undefined && { config: args.updates.config }),
      ...(args.updates.visibleTo !== undefined && { visibleTo: args.updates.visibleTo }),
    };

    await ctx.db.patch(existing._id, {
      homeConfig: { ...existing.homeConfig, cards: updatedCards },
      updatedAt: Date.now(),
    });

    return existing._id;
  },
});
