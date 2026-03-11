import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { canReadWorkspaceSettings, getMessengerSettingsRecord, requireWorkspaceSettingsPermission } from "./messengerSettingsAccess";
import {
  DEFAULT_HOME_CONFIG,
  DEFAULT_SETTINGS,
  buildPublicHomeConfig,
  homeCardUpdatesValidator,
  homeCardValidator,
  homeConfigValidator,
  normalizeMessengerHomeConfig,
} from "./messengerSettingsShared";
import type { HomeConfig } from "@opencom/types";

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

export { homeCardUpdatesValidator, homeCardValidator, homeConfigValidator };

export async function getHomeConfigQueryHandler(ctx: QueryCtx, args: WorkspaceArgs) {
  const canRead = await canReadWorkspaceSettings(ctx, args.workspaceId);
  if (!canRead) {
    return normalizeMessengerHomeConfig(DEFAULT_HOME_CONFIG);
  }

  const settings = await getMessengerSettingsRecord(ctx, args.workspaceId);
  return normalizeMessengerHomeConfig(settings?.homeConfig as HomeConfig | undefined);
}

type PublicHomeArgs = WorkspaceArgs & {
  isIdentified?: boolean;
};

export async function getPublicHomeConfigQueryHandler(ctx: QueryCtx, args: PublicHomeArgs) {
  const settings = await getMessengerSettingsRecord(ctx, args.workspaceId);
  const homeConfig = normalizeMessengerHomeConfig(settings?.homeConfig as HomeConfig | undefined);
  return buildPublicHomeConfig(homeConfig, args.isIdentified ?? false);
}

type UpdateHomeConfigArgs = WorkspaceArgs & {
  homeConfig: HomeConfig;
};

export async function updateHomeConfigMutationHandler(
  ctx: MutationCtx,
  args: UpdateHomeConfigArgs
) {
  await requireWorkspaceSettingsPermission(ctx, args.workspaceId);

  const cardIds = args.homeConfig.cards.map((card) => card.id);
  if (new Set(cardIds).size !== cardIds.length) {
    throw new Error("Card IDs must be unique");
  }

  const normalizedHomeConfig = normalizeMessengerHomeConfig(args.homeConfig);
  const existing = await getMessengerSettingsRecord(ctx, args.workspaceId);
  const now = Date.now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      homeConfig: normalizedHomeConfig,
      updatedAt: now,
    });
    return existing._id;
  }

  return await ctx.db.insert("messengerSettings", {
    workspaceId: args.workspaceId,
    homeConfig: normalizedHomeConfig,
    ...DEFAULT_SETTINGS,
    createdAt: now,
    updatedAt: now,
  });
}

type ToggleHomeArgs = WorkspaceArgs & {
  enabled: boolean;
};

export async function toggleHomeEnabledMutationHandler(ctx: MutationCtx, args: ToggleHomeArgs) {
  await requireWorkspaceSettingsPermission(ctx, args.workspaceId);

  const existing = await getMessengerSettingsRecord(ctx, args.workspaceId);
  const now = Date.now();

  if (existing) {
    const currentConfig = normalizeMessengerHomeConfig(existing.homeConfig as HomeConfig | undefined);
    await ctx.db.patch(existing._id, {
      homeConfig: { ...currentConfig, enabled: args.enabled },
      updatedAt: now,
    });
    return existing._id;
  }

  return await ctx.db.insert("messengerSettings", {
    workspaceId: args.workspaceId,
    homeConfig: { ...DEFAULT_HOME_CONFIG, enabled: args.enabled },
    ...DEFAULT_SETTINGS,
    createdAt: now,
    updatedAt: now,
  });
}

type AddHomeCardArgs = WorkspaceArgs & {
  card: HomeConfig["cards"][number];
  position?: number;
};

export async function addHomeCardMutationHandler(ctx: MutationCtx, args: AddHomeCardArgs) {
  await requireWorkspaceSettingsPermission(ctx, args.workspaceId);

  const existing = await getMessengerSettingsRecord(ctx, args.workspaceId);
  const currentConfig = normalizeMessengerHomeConfig(existing?.homeConfig as HomeConfig | undefined);

  if (currentConfig.cards.some((card) => card.id === args.card.id)) {
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
}

type RemoveHomeCardArgs = WorkspaceArgs & {
  cardId: string;
};

export async function removeHomeCardMutationHandler(ctx: MutationCtx, args: RemoveHomeCardArgs) {
  await requireWorkspaceSettingsPermission(ctx, args.workspaceId);

  const existing = await getMessengerSettingsRecord(ctx, args.workspaceId);
  if (!existing || !existing.homeConfig) {
    throw new Error("Home configuration not found");
  }

  const currentConfig = normalizeMessengerHomeConfig(existing.homeConfig as HomeConfig);
  const newCards = currentConfig.cards.filter((card) => card.id !== args.cardId);

  await ctx.db.patch(existing._id, {
    homeConfig: { ...currentConfig, cards: newCards },
    updatedAt: Date.now(),
  });

  return existing._id;
}

type ReorderHomeCardsArgs = WorkspaceArgs & {
  cardIds: string[];
};

export async function reorderHomeCardsMutationHandler(
  ctx: MutationCtx,
  args: ReorderHomeCardsArgs
) {
  await requireWorkspaceSettingsPermission(ctx, args.workspaceId);

  const existing = await getMessengerSettingsRecord(ctx, args.workspaceId);
  if (!existing || !existing.homeConfig) {
    throw new Error("Home configuration not found");
  }

  const currentConfig = normalizeMessengerHomeConfig(existing.homeConfig as HomeConfig);
  const existingIds = new Set(currentConfig.cards.map((card) => card.id));
  for (const id of args.cardIds) {
    if (!existingIds.has(id)) {
      throw new Error(`Card with ID "${id}" not found`);
    }
  }

  const cardMap = new Map(currentConfig.cards.map((card) => [card.id, card]));
  const reorderedCards = args.cardIds.map((id) => cardMap.get(id)!);

  await ctx.db.patch(existing._id, {
    homeConfig: { ...currentConfig, cards: reorderedCards },
    updatedAt: Date.now(),
  });

  return existing._id;
}

type UpdateHomeCardArgs = WorkspaceArgs & {
  cardId: string;
  updates: {
    config?: HomeConfig["cards"][number]["config"];
    visibleTo?: "all" | "visitors" | "users";
  };
};

export async function updateHomeCardMutationHandler(ctx: MutationCtx, args: UpdateHomeCardArgs) {
  await requireWorkspaceSettingsPermission(ctx, args.workspaceId);

  const existing = await getMessengerSettingsRecord(ctx, args.workspaceId);
  if (!existing || !existing.homeConfig) {
    throw new Error("Home configuration not found");
  }

  const currentConfig = normalizeMessengerHomeConfig(existing.homeConfig as HomeConfig);
  const cardIndex = currentConfig.cards.findIndex((card) => card.id === args.cardId);
  if (cardIndex === -1) {
    throw new Error("Card not found");
  }

  const updatedCards = [...currentConfig.cards];
  updatedCards[cardIndex] = {
    ...updatedCards[cardIndex],
    ...(args.updates.config !== undefined && { config: args.updates.config }),
    ...(args.updates.visibleTo !== undefined && { visibleTo: args.updates.visibleTo }),
  };

  await ctx.db.patch(existing._id, {
    homeConfig: { ...currentConfig, cards: updatedCards },
    updatedAt: Date.now(),
  });

  return existing._id;
}
