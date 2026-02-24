import { internalMutation } from "../_generated/server";

// Migration marker for the Convex Auth session cutover.
// Running this mutation records operator acknowledgement that existing sessions are invalidated.
export const migrateSessionsToLegacy = internalMutation({
  args: {},
  handler: async (_ctx) => {
    // Run before deploying the Convex Auth schema so session invalidation is explicit.

    // Existing sessions are intentionally invalidated during the auth cutover.
    // This mutation provides explicit operator-facing confirmation.
    console.log("Migration: Clearing old auth sessions for Convex Auth migration");
    console.log("Users will need to log in again after this migration");

    return { success: true, message: "Sessions will be invalidated on schema update" };
  },
});
