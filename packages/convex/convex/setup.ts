import { query } from "./_generated/server";
import { getAuthenticatedUserFromSession } from "./auth";

export const checkExistingSetup = query({
  args: {},
  handler: async (ctx) => {
    const workspaces = await ctx.db.query("workspaces").collect();
    const users = await ctx.db.query("users").collect();
    const isAuthenticated = !!(await getAuthenticatedUserFromSession(ctx));

    const base = {
      hasWorkspaces: workspaces.length > 0,
      hasUsers: users.length > 0,
    };

    if (!isAuthenticated) {
      return base;
    }

    return {
      ...base,
      workspaceCount: workspaces.length,
      userCount: users.length,
    };
  },
});
