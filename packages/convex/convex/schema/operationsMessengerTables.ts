import { defineTable } from "convex/server";
import { v } from "convex/values";
import { audienceRulesOrSegmentValidator, jsonObjectValidator } from "../validators";

export const operationsMessengerTables = {
  messengerSettings: defineTable({
    workspaceId: v.id("workspaces"),
    logo: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    primaryColor: v.string(),
    backgroundColor: v.string(),
    themeMode: v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
    launcherPosition: v.union(v.literal("right"), v.literal("left")),
    launcherSideSpacing: v.number(),
    launcherBottomSpacing: v.number(),
    launcherIconUrl: v.optional(v.string()),
    showLauncher: v.boolean(),
    launcherAudienceRules: v.optional(audienceRulesOrSegmentValidator),
    welcomeMessage: v.string(),
    teamIntroduction: v.optional(v.string()),
    showTeammateAvatars: v.boolean(),
    supportedLanguages: v.array(v.string()),
    defaultLanguage: v.string(),
    privacyPolicyUrl: v.optional(v.string()),
    mobileEnabled: v.boolean(),
    homeConfig: v.optional(
      v.object({
        enabled: v.boolean(),
        cards: v.array(
          v.object({
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
          })
        ),
        defaultSpace: v.union(v.literal("home"), v.literal("messages"), v.literal("help")),
        launchDirectlyToConversation: v.optional(v.boolean()),
        tabs: v.optional(
          v.array(
            v.object({
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
            })
          )
        ),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),
};
