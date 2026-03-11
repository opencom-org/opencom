import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { AudienceRuleWithSegment } from "@opencom/types";
import {
  canReadWorkspaceSettings,
  ensureWorkspaceExists,
  getMessengerSettingsRecord,
  requireWorkspaceSettingsPermission,
  resolveMessengerLogoUrl,
} from "./messengerSettingsAccess";
import {
  DEFAULT_PUBLIC_SETTINGS,
  DEFAULT_SETTINGS,
  isValidHexColor,
  isValidUrl,
  toPublicMessengerSettings,
} from "./messengerSettingsShared";

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

export async function getMessengerSettingsQueryHandler(ctx: QueryCtx, args: WorkspaceArgs) {
  const canRead = await canReadWorkspaceSettings(ctx, args.workspaceId);
  if (!canRead) {
    return null;
  }

  return await getMessengerSettingsRecord(ctx, args.workspaceId);
}

export async function getOrCreateMessengerSettingsQueryHandler(
  ctx: QueryCtx,
  args: WorkspaceArgs
) {
  const canRead = await canReadWorkspaceSettings(ctx, args.workspaceId);
  if (!canRead) {
    return null;
  }

  const existing = await getMessengerSettingsRecord(ctx, args.workspaceId);
  if (existing) {
    if (existing.logoStorageId) {
      const logoUrl = await resolveMessengerLogoUrl(ctx, existing);
      return { ...existing, logo: logoUrl };
    }
    return existing;
  }

  return {
    workspaceId: args.workspaceId,
    ...DEFAULT_PUBLIC_SETTINGS,
    logoStorageId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export async function getPublicMessengerSettingsQueryHandler(ctx: QueryCtx, args: WorkspaceArgs) {
  const settings = await getMessengerSettingsRecord(ctx, args.workspaceId);
  if (!settings) {
    return toPublicMessengerSettings();
  }

  return toPublicMessengerSettings({
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
    logo: await resolveMessengerLogoUrl(ctx, settings),
    launcherIconUrl: settings.launcherIconUrl,
    teamIntroduction: settings.teamIntroduction,
    privacyPolicyUrl: settings.privacyPolicyUrl,
    launcherAudienceRules: settings.launcherAudienceRules,
  });
}

type UpsertArgs = WorkspaceArgs & {
  primaryColor?: string;
  backgroundColor?: string;
  themeMode?: "light" | "dark" | "system";
  launcherPosition?: "right" | "left";
  launcherSideSpacing?: number;
  launcherBottomSpacing?: number;
  launcherIconUrl?: string | null;
  showLauncher?: boolean;
  launcherAudienceRules?: AudienceRuleWithSegment<Id<"segments">>;
  welcomeMessage?: string;
  teamIntroduction?: string | null;
  showTeammateAvatars?: boolean;
  supportedLanguages?: string[];
  defaultLanguage?: string;
  privacyPolicyUrl?: string | null;
  mobileEnabled?: boolean;
};

function validateMessengerSettingsUpsert(args: UpsertArgs) {
  if (args.primaryColor && !isValidHexColor(args.primaryColor)) {
    throw new Error("Invalid primary color format. Must be a valid hex color (e.g., #792cd4)");
  }
  if (args.backgroundColor && !isValidHexColor(args.backgroundColor)) {
    throw new Error("Invalid background color format. Must be a valid hex color (e.g., #792cd4)");
  }
  if (args.privacyPolicyUrl && args.privacyPolicyUrl !== null && !isValidUrl(args.privacyPolicyUrl)) {
    throw new Error("Invalid privacy policy URL format");
  }
  if (args.launcherIconUrl && args.launcherIconUrl !== null && !isValidUrl(args.launcherIconUrl)) {
    throw new Error("Invalid launcher icon URL format");
  }
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
  if (args.welcomeMessage && args.welcomeMessage.length > 500) {
    throw new Error("Welcome message must be 500 characters or less");
  }
}

export async function upsertMessengerSettingsMutationHandler(
  ctx: MutationCtx,
  args: UpsertArgs
) {
  await requireWorkspaceSettingsPermission(ctx, args.workspaceId);
  validateMessengerSettingsUpsert(args);

  const existing = await getMessengerSettingsRecord(ctx, args.workspaceId);
  const now = Date.now();

  if (existing) {
    const updates: Record<string, unknown> = { updatedAt: now };

    if (args.primaryColor !== undefined) updates.primaryColor = args.primaryColor;
    if (args.backgroundColor !== undefined) updates.backgroundColor = args.backgroundColor;
    if (args.themeMode !== undefined) updates.themeMode = args.themeMode;
    if (args.launcherPosition !== undefined) updates.launcherPosition = args.launcherPosition;
    if (args.launcherSideSpacing !== undefined) updates.launcherSideSpacing = args.launcherSideSpacing;
    if (args.launcherBottomSpacing !== undefined) updates.launcherBottomSpacing = args.launcherBottomSpacing;
    if (args.launcherIconUrl !== undefined) {
      updates.launcherIconUrl = args.launcherIconUrl === null ? undefined : args.launcherIconUrl;
    }
    if (args.showLauncher !== undefined) updates.showLauncher = args.showLauncher;
    if (args.launcherAudienceRules !== undefined) {
      updates.launcherAudienceRules = args.launcherAudienceRules;
    }
    if (args.welcomeMessage !== undefined) updates.welcomeMessage = args.welcomeMessage;
    if (args.teamIntroduction !== undefined) {
      updates.teamIntroduction = args.teamIntroduction === null ? undefined : args.teamIntroduction;
    }
    if (args.showTeammateAvatars !== undefined) {
      updates.showTeammateAvatars = args.showTeammateAvatars;
    }
    if (args.supportedLanguages !== undefined) updates.supportedLanguages = args.supportedLanguages;
    if (args.defaultLanguage !== undefined) updates.defaultLanguage = args.defaultLanguage;
    if (args.privacyPolicyUrl !== undefined) {
      updates.privacyPolicyUrl = args.privacyPolicyUrl === null ? undefined : args.privacyPolicyUrl;
    }
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
}

export async function generateLogoUploadUrlMutationHandler(
  ctx: MutationCtx,
  args: WorkspaceArgs
) {
  await requireWorkspaceSettingsPermission(ctx, args.workspaceId);
  await ensureWorkspaceExists(ctx, args.workspaceId);
  return await ctx.storage.generateUploadUrl();
}

type SaveLogoArgs = WorkspaceArgs & {
  storageId: Id<"_storage">;
};

export async function saveMessengerLogoMutationHandler(ctx: MutationCtx, args: SaveLogoArgs) {
  await requireWorkspaceSettingsPermission(ctx, args.workspaceId);

  const existing = await getMessengerSettingsRecord(ctx, args.workspaceId);
  const now = Date.now();

  if (existing?.logoStorageId) {
    await ctx.storage.delete(existing.logoStorageId);
  }

  const logoUrl = (await ctx.storage.getUrl(args.storageId)) ?? undefined;

  if (existing) {
    await ctx.db.patch(existing._id, {
      logoStorageId: args.storageId,
      logo: logoUrl,
      updatedAt: now,
    });
    return existing._id;
  }

  return await ctx.db.insert("messengerSettings", {
    workspaceId: args.workspaceId,
    logoStorageId: args.storageId,
    logo: logoUrl ?? undefined,
    ...DEFAULT_SETTINGS,
    createdAt: now,
    updatedAt: now,
  });
}

export async function deleteMessengerLogoMutationHandler(ctx: MutationCtx, args: WorkspaceArgs) {
  await requireWorkspaceSettingsPermission(ctx, args.workspaceId);

  const existing = await getMessengerSettingsRecord(ctx, args.workspaceId);
  if (!existing) {
    throw new Error("Messenger settings not found");
  }

  if (existing.logoStorageId) {
    await ctx.storage.delete(existing.logoStorageId);
  }

  await ctx.db.patch(existing._id, {
    logoStorageId: undefined,
    logo: undefined,
    updatedAt: Date.now(),
  });

  return existing._id;
}
