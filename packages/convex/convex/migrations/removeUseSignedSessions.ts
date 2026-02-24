import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

// Migration that removes useSignedSessions from workspace documents.
// Signed sessions are now always on — the feature flag is removed.
// Run with: npx convex run migrations/removeUseSignedSessions:migrate

export const migrate = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;

    const workspaces = await ctx.db.query("workspaces").collect();

    const workspacesWithFlag = workspaces.filter(
      (ws) => "useSignedSessions" in ws && (ws as any).useSignedSessions !== undefined
    );

    if (workspacesWithFlag.length === 0) {
      return {
        status: "complete",
        message: "No workspaces with useSignedSessions field found",
        processed: 0,
      };
    }

    let processed = 0;
    const batch = workspacesWithFlag.slice(0, batchSize);

    for (const ws of batch) {
      await ctx.db.patch(ws._id, { useSignedSessions: undefined } as any);
      processed++;
    }

    const remaining = workspacesWithFlag.length - processed;

    return {
      status: remaining > 0 ? "in_progress" : "complete",
      message: `Processed ${processed} workspaces, ${remaining} remaining`,
      processed,
      remaining,
    };
  },
});

export const verifyMigration = internalMutation({
  args: {},
  handler: async (ctx) => {
    const workspaces = await ctx.db.query("workspaces").collect();

    const workspacesWithFlag = workspaces.filter(
      (ws) => "useSignedSessions" in ws && (ws as any).useSignedSessions !== undefined
    );

    return {
      totalWorkspaces: workspaces.length,
      workspacesWithFlag: workspacesWithFlag.length,
      migrationComplete: workspacesWithFlag.length === 0,
      sampleIds: workspacesWithFlag.slice(0, 5).map((ws) => ws._id),
    };
  },
});
