import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  deleteMessengerLogoMutationHandler,
  generateLogoUploadUrlMutationHandler,
  getMessengerSettingsQueryHandler,
  getOrCreateMessengerSettingsQueryHandler,
  getPublicMessengerSettingsQueryHandler,
  saveMessengerLogoMutationHandler,
  upsertMessengerSettingsMutationHandler,
} from "./messengerSettingsCore";
import {
  addHomeCardMutationHandler,
  getHomeConfigQueryHandler,
  getPublicHomeConfigQueryHandler,
  homeCardUpdatesValidator,
  homeCardValidator,
  homeConfigValidator,
  removeHomeCardMutationHandler,
  reorderHomeCardsMutationHandler,
  toggleHomeEnabledMutationHandler,
  updateHomeCardMutationHandler,
  updateHomeConfigMutationHandler,
} from "./messengerHomeConfig";
import { messengerSettingsUpsertArgs } from "./messengerSettingsShared";

const workspaceArgs = {
  workspaceId: v.id("workspaces"),
};

export const get = query({
  args: workspaceArgs,
  handler: getMessengerSettingsQueryHandler,
});

export const getOrCreate = query({
  args: workspaceArgs,
  handler: getOrCreateMessengerSettingsQueryHandler,
});

export const getPublicSettings = query({
  args: workspaceArgs,
  handler: getPublicMessengerSettingsQueryHandler,
});

export const upsert = mutation({
  args: messengerSettingsUpsertArgs,
  handler: upsertMessengerSettingsMutationHandler,
});

export const generateLogoUploadUrl = mutation({
  args: workspaceArgs,
  handler: generateLogoUploadUrlMutationHandler,
});

export const saveLogo = mutation({
  args: {
    ...workspaceArgs,
    storageId: v.id("_storage"),
  },
  handler: saveMessengerLogoMutationHandler,
});

export const deleteLogo = mutation({
  args: workspaceArgs,
  handler: deleteMessengerLogoMutationHandler,
});
export const getHomeConfig = query({
  args: workspaceArgs,
  handler: getHomeConfigQueryHandler,
});

export const getPublicHomeConfig = query({
  args: {
    ...workspaceArgs,
    isIdentified: v.optional(v.boolean()),
  },
  handler: getPublicHomeConfigQueryHandler,
});

export const updateHomeConfig = mutation({
  args: {
    ...workspaceArgs,
    homeConfig: homeConfigValidator,
  },
  handler: updateHomeConfigMutationHandler,
});

export const toggleHomeEnabled = mutation({
  args: {
    ...workspaceArgs,
    enabled: v.boolean(),
  },
  handler: toggleHomeEnabledMutationHandler,
});

export const addHomeCard = mutation({
  args: {
    ...workspaceArgs,
    card: homeCardValidator,
    position: v.optional(v.number()),
  },
  handler: addHomeCardMutationHandler,
});

export const removeHomeCard = mutation({
  args: {
    ...workspaceArgs,
    cardId: v.string(),
  },
  handler: removeHomeCardMutationHandler,
});

export const reorderHomeCards = mutation({
  args: {
    ...workspaceArgs,
    cardIds: v.array(v.string()),
  },
  handler: reorderHomeCardsMutationHandler,
});

export const updateHomeCard = mutation({
  args: {
    ...workspaceArgs,
    cardId: v.string(),
    updates: homeCardUpdatesValidator,
  },
  handler: updateHomeCardMutationHandler,
});
