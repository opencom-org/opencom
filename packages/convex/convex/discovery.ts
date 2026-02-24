import { query } from "./_generated/server";
import { getAuthenticatedUserFromSession } from "./auth";

export const getMetadata = query({
  args: {},
  handler: async (ctx) => {
    // Use the earliest workspace as metadata source via index-backed, bounded lookup.
    const workspaceRows = await ctx.db
      .query("workspaces")
      .withIndex("by_created_at")
      .order("asc")
      .take(1);
    const workspace = workspaceRows[0] ?? null;

    // Get workspace signup settings if available (defaults to invite-only with both auth methods)
    const signupMode = workspace?.signupMode ?? "invite-only";
    const authMethods = workspace?.authMethods ?? ["password", "otp"];
    const isAuthenticated = !!(await getAuthenticatedUserFromSession(ctx));

    const base = {
      version: "1.0",
      name: workspace?.name ?? "Opencom",
      features: ["chat", "knowledge-base"],
    };

    if (!isAuthenticated) {
      return base;
    }

    return {
      ...base,
      signupMode,
      authMethods,
    };
  },
});
