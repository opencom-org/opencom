import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

// Backfill migration that ensures all workspace documents have
// helpCenterAccessPolicy set to "public" when missing.
// Run with: npx convex run migrations/backfillHelpCenterAccessPolicy:migrate

export const migrate = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;

    const workspaces = await ctx.db.query("workspaces").collect();
    const missingPolicy = workspaces.filter((workspace) => !workspace.helpCenterAccessPolicy);

    if (missingPolicy.length === 0) {
      return {
        status: "complete",
        message: "All workspaces already have helpCenterAccessPolicy set",
        processed: 0,
      };
    }

    const batch = missingPolicy.slice(0, batchSize);
    for (const workspace of batch) {
      await ctx.db.patch(workspace._id, { helpCenterAccessPolicy: "public" });
    }

    const processed = batch.length;
    const remaining = missingPolicy.length - processed;

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
    const missingPolicy = workspaces.filter((workspace) => !workspace.helpCenterAccessPolicy);

    return {
      totalWorkspaces: workspaces.length,
      missingPolicyCount: missingPolicy.length,
      migrationComplete: missingPolicy.length === 0,
      sampleIds: missingPolicy.slice(0, 10).map((workspace) => workspace._id),
    };
  },
});
