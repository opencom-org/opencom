import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

// Migration that removes passwordHash fields from user documents.
// Run with: npx convex run migrations/removePasswordHash:migrate

export const migrate = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;

    // Find users with passwordHash field
    const users = await ctx.db.query("users").collect();

    const usersWithPasswordHash = users.filter(
      (user) => "passwordHash" in user && (user as any).passwordHash !== undefined
    );

    if (usersWithPasswordHash.length === 0) {
      return {
        status: "complete",
        message: "No users with passwordHash field found",
        processed: 0,
      };
    }

    let processed = 0;
    const batch = usersWithPasswordHash.slice(0, batchSize);

    for (const user of batch) {
      // Remove passwordHash by patching with undefined
      // Note: In Convex, setting a field to undefined removes it
      await ctx.db.patch(user._id, { passwordHash: undefined } as any);
      processed++;
    }

    const remaining = usersWithPasswordHash.length - processed;

    return {
      status: remaining > 0 ? "in_progress" : "complete",
      message: `Processed ${processed} users, ${remaining} remaining`,
      processed,
      remaining,
    };
  },
});

// Verification query to check migration status
export const verifyMigration = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();

    const usersWithPasswordHash = users.filter(
      (user) => "passwordHash" in user && (user as any).passwordHash !== undefined
    );

    return {
      totalUsers: users.length,
      usersWithPasswordHash: usersWithPasswordHash.length,
      migrationComplete: usersWithPasswordHash.length === 0,
      sampleIds: usersWithPasswordHash.slice(0, 5).map((u) => u._id),
    };
  },
});
