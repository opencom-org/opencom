import { internalMutation } from "../../_generated/server";
import { v } from "convex/values";
import { Id } from "../../_generated/dataModel";

const cleanupTestData = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const { workspaceId } = args;

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    for (const conversation of conversations) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
        .collect();
      for (const message of messages) {
        await ctx.db.delete(message._id);
      }
      await ctx.db.delete(conversation._id);
    }

    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    const visitorPushTokens = await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const token of visitorPushTokens) {
      await ctx.db.delete(token._id);
    }

    for (const visitor of visitors) {
      await ctx.db.delete(visitor._id);
    }

    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    const users = await ctx.db
      .query("users")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const user of users) {
      const pushTokens = await ctx.db
        .query("pushTokens")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const token of pushTokens) {
        await ctx.db.delete(token._id);
      }

      const notifPrefs = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const pref of notifPrefs) {
        await ctx.db.delete(pref._id);
      }

      await ctx.db.delete(user._id);
    }

    const invitations = await ctx.db
      .query("workspaceInvitations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const invitation of invitations) {
      await ctx.db.delete(invitation._id);
    }

    const workspaceNotificationDefaults = await ctx.db
      .query("workspaceNotificationDefaults")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const defaults of workspaceNotificationDefaults) {
      await ctx.db.delete(defaults._id);
    }

    // Clean up content folders
    const contentFolders = await ctx.db
      .query("contentFolders")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const folder of contentFolders) {
      await ctx.db.delete(folder._id);
    }

    // Clean up internal articles
    const internalArticles = await ctx.db
      .query("internalArticles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const article of internalArticles) {
      await ctx.db.delete(article._id);
    }

    // Clean up recent content access for users in this workspace
    for (const user of users) {
      const recentAccess = await ctx.db
        .query("recentContentAccess")
        .withIndex("by_user_workspace", (q) =>
          q.eq("userId", user._id).eq("workspaceId", workspaceId)
        )
        .collect();
      for (const access of recentAccess) {
        await ctx.db.delete(access._id);
      }
    }

    // Clean up articles
    const articles = await ctx.db
      .query("articles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const article of articles) {
      await ctx.db.delete(article._id);
    }

    // Clean up collections
    const collections = await ctx.db
      .query("collections")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const collection of collections) {
      await ctx.db.delete(collection._id);
    }

    // Clean up help center import archives
    const importArchives = await ctx.db
      .query("helpCenterImportArchives")
      .withIndex("by_workspace_deleted_at", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const archive of importArchives) {
      await ctx.db.delete(archive._id);
    }

    // Clean up help center import sources
    const importSources = await ctx.db
      .query("helpCenterImportSources")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const source of importSources) {
      await ctx.db.delete(source._id);
    }

    // Clean up snippets
    const snippets = await ctx.db
      .query("snippets")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const snippet of snippets) {
      await ctx.db.delete(snippet._id);
    }

    // Clean up content embeddings
    const contentEmbeddings = await ctx.db
      .query("contentEmbeddings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const embedding of contentEmbeddings) {
      await ctx.db.delete(embedding._id);
    }

    // Clean up suggestion feedback
    const suggestionFeedback = await ctx.db
      .query("suggestionFeedback")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const feedback of suggestionFeedback) {
      await ctx.db.delete(feedback._id);
    }

    // Clean up AI agent settings
    const aiSettings = await ctx.db
      .query("aiAgentSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const setting of aiSettings) {
      await ctx.db.delete(setting._id);
    }

    // Clean up automation settings
    const automationSettings = await ctx.db
      .query("automationSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const setting of automationSettings) {
      await ctx.db.delete(setting._id);
    }

    // Clean up CSAT responses
    const csatResponses = await ctx.db
      .query("csatResponses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const response of csatResponses) {
      await ctx.db.delete(response._id);
    }

    // Clean up report snapshots
    const reportSnapshots = await ctx.db
      .query("reportSnapshots")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const snapshot of reportSnapshots) {
      await ctx.db.delete(snapshot._id);
    }

    // Clean up email configs
    const emailConfigs = await ctx.db
      .query("emailConfigs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const config of emailConfigs) {
      await ctx.db.delete(config._id);
    }

    // Clean up email threads
    for (const conversation of conversations) {
      const threads = await ctx.db
        .query("emailThreads")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
        .collect();
      for (const thread of threads) {
        await ctx.db.delete(thread._id);
      }
    }

    // Clean up tickets and ticket comments
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const ticket of tickets) {
      const comments = await ctx.db
        .query("ticketComments")
        .withIndex("by_ticket", (q) => q.eq("ticketId", ticket._id))
        .collect();
      for (const comment of comments) {
        await ctx.db.delete(comment._id);
      }
      await ctx.db.delete(ticket._id);
    }

    // Clean up ticket forms
    const ticketForms = await ctx.db
      .query("ticketForms")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const form of ticketForms) {
      await ctx.db.delete(form._id);
    }

    await ctx.db.delete(workspaceId);

    return { success: true };
  },
});

/**
 * Cleans up all E2E test data from the database.
 * This removes all users with emails matching *@test.opencom.dev pattern
 * and their associated workspaces, conversations, etc.
 *
 * Can be run manually or at the start/end of E2E test runs.
 */
const cleanupE2ETestData = internalMutation({
  args: {},
  handler: async (ctx) => {
    let deletedUsers = 0;
    let deletedWorkspaces = 0;
    let deletedConversations = 0;
    let deletedMessages = 0;
    let deletedVisitors = 0;
    let deletedMembers = 0;
    let deletedInvitations = 0;

    // Find all test users (emails ending with @test.opencom.dev)
    const allUsers = await ctx.db.query("users").collect();
    const testUsers = allUsers.filter(
      (user) => user.email && user.email.endsWith("@test.opencom.dev")
    );

    // Collect unique workspace IDs from test users
    const testWorkspaceIds = new Set<Id<"workspaces">>();
    for (const user of testUsers) {
      if (user.workspaceId) {
        testWorkspaceIds.add(user.workspaceId);
      }
    }

    // Clean up each test workspace
    for (const workspaceId of testWorkspaceIds) {
      // Delete conversations and messages
      const conversations = await ctx.db
        .query("conversations")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .collect();

      for (const conversation of conversations) {
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
          .collect();
        for (const message of messages) {
          await ctx.db.delete(message._id);
          deletedMessages++;
        }
        await ctx.db.delete(conversation._id);
        deletedConversations++;
      }

      // Delete visitors
      const visitors = await ctx.db
        .query("visitors")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .collect();

      const visitorPushTokens = await ctx.db
        .query("visitorPushTokens")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .collect();
      for (const token of visitorPushTokens) {
        await ctx.db.delete(token._id);
      }

      for (const visitor of visitors) {
        await ctx.db.delete(visitor._id);
        deletedVisitors++;
      }

      // Delete workspace members
      const members = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .collect();
      for (const member of members) {
        await ctx.db.delete(member._id);
        deletedMembers++;
      }

      // Delete invitations
      const invitations = await ctx.db
        .query("workspaceInvitations")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .collect();
      for (const invitation of invitations) {
        await ctx.db.delete(invitation._id);
        deletedInvitations++;
      }

      const workspaceNotificationDefaults = await ctx.db
        .query("workspaceNotificationDefaults")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .collect();
      for (const defaults of workspaceNotificationDefaults) {
        await ctx.db.delete(defaults._id);
      }

      // Delete the workspace
      try {
        await ctx.db.delete(workspaceId);
        deletedWorkspaces++;
      } catch (e) {
        // Workspace might already be deleted
      }
    }

    // Delete test users and their data
    for (const user of testUsers) {
      // Delete push tokens
      const pushTokens = await ctx.db
        .query("pushTokens")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const token of pushTokens) {
        await ctx.db.delete(token._id);
      }

      // Delete notification preferences
      const notifPrefs = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const pref of notifPrefs) {
        await ctx.db.delete(pref._id);
      }

      await ctx.db.delete(user._id);
      deletedUsers++;
    }

    return {
      success: true,
      deleted: {
        users: deletedUsers,
        workspaces: deletedWorkspaces,
        conversations: deletedConversations,
        messages: deletedMessages,
        visitors: deletedVisitors,
        members: deletedMembers,
        invitations: deletedInvitations,
      },
    };
  },
});

/**
 * Creates a test email config for a workspace.
 */

export const cleanupTestHelpers: Record<string, ReturnType<typeof internalMutation>> = {
  cleanupTestData,
  cleanupE2ETestData,
} as const;
