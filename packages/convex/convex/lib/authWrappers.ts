import { anyApi } from "convex/server";
import type { ObjectType, PropertyValidators } from "convex/values";
import type { Id } from "../_generated/dataModel";
import {
  action,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { getAuthenticatedUserFromSession } from "../auth";
import { type Permission, requirePermission } from "../permissions";

type WorkspaceId = Id<"workspaces">;
type ActionRunQuery = (queryRef: unknown, args: Record<string, unknown>) => Promise<unknown>;
type ActionCtxWithRunQuery = ActionCtx & {
  runQuery: ActionRunQuery;
};

export type AuthenticatedUser = NonNullable<
  Awaited<ReturnType<typeof getAuthenticatedUserFromSession>>
>;

type WrappedArgs<ArgsValidator extends PropertyValidators> = ObjectType<ArgsValidator> &
  Record<string, unknown>;

type WorkspaceResolver<Ctx, Args> = (
  ctx: Ctx,
  args: Args,
  user: AuthenticatedUser
) => Promise<WorkspaceId | null | undefined> | WorkspaceId | null | undefined;

type WrapperOptions<
  Ctx extends QueryCtx | MutationCtx | ActionCtx,
  ArgsValidator extends PropertyValidators,
  ReturnValue,
> = {
  args: ArgsValidator;
  permission?: Permission;
  // Allow handlers (typically "get by id" queries) to return null when an entity no longer exists.
  allowMissingWorkspace?: boolean;
  workspaceIdArg?: keyof WrappedArgs<ArgsValidator> & string;
  resolveWorkspaceId?: WorkspaceResolver<Ctx, WrappedArgs<ArgsValidator>>;
  handler: (
    ctx: Ctx & { user: AuthenticatedUser },
    args: WrappedArgs<ArgsValidator>
  ) => Promise<ReturnValue> | ReturnValue;
};

function withUser<Ctx extends QueryCtx | MutationCtx | ActionCtx>(
  ctx: Ctx,
  user: AuthenticatedUser
): Ctx & { user: AuthenticatedUser } {
  return { ...ctx, user };
}

async function getWorkspaceIdForPermission<
  Ctx extends QueryCtx | MutationCtx | ActionCtx,
  Args extends Record<string, unknown>,
>(
  ctx: Ctx,
  args: Args,
  user: AuthenticatedUser,
  options: {
    workspaceIdArg: keyof Args & string;
    resolveWorkspaceId?: WorkspaceResolver<Ctx, Args>;
  }
): Promise<WorkspaceId | null> {
  const direct = args[options.workspaceIdArg] as WorkspaceId | undefined;
  if (direct) {
    return direct;
  }
  if (!options.resolveWorkspaceId) {
    return null;
  }
  return (await options.resolveWorkspaceId(ctx, args, user)) ?? null;
}

async function getActionUser(ctx: ActionCtx): Promise<AuthenticatedUser> {
  const runQuery = (ctx as ActionCtxWithRunQuery).runQuery;
  const currentUserRef = (anyApi as unknown as { auth: { currentUser: unknown } }).auth.currentUser;
  const currentUser = (await runQuery(currentUserRef, {})) as
    | { user?: AuthenticatedUser }
    | null;
  if (!currentUser?.user) {
    throw new Error("Not authenticated");
  }
  return currentUser.user as AuthenticatedUser;
}

export function authMutation<ArgsValidator extends PropertyValidators, ReturnValue = unknown>(
  options: WrapperOptions<MutationCtx, ArgsValidator, ReturnValue>
) {
  type Args = WrappedArgs<ArgsValidator>;
  const workspaceIdArg = options.workspaceIdArg ?? ("workspaceId" as keyof Args & string);

  return mutation({
    args: options.args,
    handler: async (ctx: MutationCtx, args: Args) => {
      const user = await getAuthenticatedUserFromSession(ctx);
      if (!user) {
        throw new Error("Not authenticated");
      }

      if (options.permission) {
        const workspaceId = await getWorkspaceIdForPermission(ctx, args, user, {
          workspaceIdArg,
          resolveWorkspaceId: options.resolveWorkspaceId,
        });
        if (!workspaceId) {
          if (options.allowMissingWorkspace) {
            return options.handler(withUser(ctx, user), args);
          }
          throw new Error("Auth wrapper misconfigured: missing workspace resolver");
        }
        await requirePermission(ctx, user._id, workspaceId, options.permission);
      }

      return options.handler(withUser(ctx, user), args);
    },
  });
}

export function authQuery<ArgsValidator extends PropertyValidators, ReturnValue = unknown>(
  options: WrapperOptions<QueryCtx, ArgsValidator, ReturnValue>
) {
  type Args = WrappedArgs<ArgsValidator>;
  const workspaceIdArg = options.workspaceIdArg ?? ("workspaceId" as keyof Args & string);

  return query({
    args: options.args,
    handler: async (ctx: QueryCtx, args: Args) => {
      const user = await getAuthenticatedUserFromSession(ctx);
      if (!user) {
        throw new Error("Not authenticated");
      }

      if (options.permission) {
        const workspaceId = await getWorkspaceIdForPermission(ctx, args, user, {
          workspaceIdArg,
          resolveWorkspaceId: options.resolveWorkspaceId,
        });
        if (!workspaceId) {
          if (options.allowMissingWorkspace) {
            return options.handler(withUser(ctx, user), args);
          }
          throw new Error("Auth wrapper misconfigured: missing workspace resolver");
        }
        await requirePermission(ctx, user._id, workspaceId, options.permission);
      }

      return options.handler(withUser(ctx, user), args);
    },
  });
}

export function authAction<ArgsValidator extends PropertyValidators, ReturnValue = unknown>(
  options: WrapperOptions<ActionCtx, ArgsValidator, ReturnValue>
) {
  type Args = WrappedArgs<ArgsValidator>;
  const workspaceIdArg = options.workspaceIdArg ?? ("workspaceId" as keyof Args & string);

  return action({
    args: options.args,
    handler: async (ctx: ActionCtx, args: Args) => {
      const user = await getActionUser(ctx);

      if (options.permission) {
        const workspaceId = await getWorkspaceIdForPermission(ctx, args, user, {
          workspaceIdArg,
          resolveWorkspaceId: options.resolveWorkspaceId,
        });
        if (!workspaceId) {
          if (options.allowMissingWorkspace) {
            return options.handler(withUser(ctx, user), args);
          }
          throw new Error("Auth wrapper misconfigured: missing workspace resolver");
        }
        const runQuery = (ctx as ActionCtxWithRunQuery).runQuery;
        const permissionRef = (anyApi as unknown as {
          permissions: { requirePermissionForAction: unknown };
        }).permissions.requirePermissionForAction;
        await runQuery(permissionRef, {
          userId: user._id,
          workspaceId,
          permission: options.permission,
        });
      }

      return options.handler(withUser(ctx, user), args);
    },
  });
}
