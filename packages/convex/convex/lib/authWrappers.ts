import type { ObjectType, PropertyValidators } from "convex/values";
import { api, internal } from "../_generated/api";
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

export type AuthenticatedUser = NonNullable<
  Awaited<ReturnType<typeof getAuthenticatedUserFromSession>>
>;

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
  workspaceIdArg?: keyof ObjectType<ArgsValidator> & string;
  resolveWorkspaceId?: WorkspaceResolver<Ctx, ObjectType<ArgsValidator>>;
  handler: (
    ctx: Ctx & { user: AuthenticatedUser },
    args: ObjectType<ArgsValidator>
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
  const currentUser = await ctx.runQuery(api.auth.currentUser, {});
  if (!currentUser?.user) {
    throw new Error("Not authenticated");
  }
  return currentUser.user as AuthenticatedUser;
}

export function authMutation<ArgsValidator extends PropertyValidators, ReturnValue = unknown>(
  options: WrapperOptions<MutationCtx, ArgsValidator, ReturnValue>
) {
  const workspaceIdArg =
    options.workspaceIdArg ?? ("workspaceId" as keyof ObjectType<ArgsValidator> & string);

  return mutation({
    args: options.args,
    handler: async (ctx: MutationCtx, args: ObjectType<ArgsValidator>) => {
      const user = await getAuthenticatedUserFromSession(ctx);
      if (!user) {
        throw new Error("Not authenticated");
      }

      if (options.permission) {
        const workspaceId = await getWorkspaceIdForPermission(
          ctx,
          args as ObjectType<ArgsValidator> & Record<string, unknown>,
          user,
          {
            workspaceIdArg: workspaceIdArg as keyof (ObjectType<ArgsValidator> &
              Record<string, unknown>) &
              string,
            resolveWorkspaceId: options.resolveWorkspaceId as
              | WorkspaceResolver<MutationCtx, ObjectType<ArgsValidator> & Record<string, unknown>>
              | undefined,
          }
        );
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
  } as any);
}

export function authQuery<ArgsValidator extends PropertyValidators, ReturnValue = unknown>(
  options: WrapperOptions<QueryCtx, ArgsValidator, ReturnValue>
) {
  const workspaceIdArg =
    options.workspaceIdArg ?? ("workspaceId" as keyof ObjectType<ArgsValidator> & string);

  return query({
    args: options.args,
    handler: async (ctx: QueryCtx, args: ObjectType<ArgsValidator>) => {
      const user = await getAuthenticatedUserFromSession(ctx);
      if (!user) {
        throw new Error("Not authenticated");
      }

      if (options.permission) {
        const workspaceId = await getWorkspaceIdForPermission(
          ctx,
          args as ObjectType<ArgsValidator> & Record<string, unknown>,
          user,
          {
            workspaceIdArg: workspaceIdArg as keyof (ObjectType<ArgsValidator> &
              Record<string, unknown>) &
              string,
            resolveWorkspaceId: options.resolveWorkspaceId as
              | WorkspaceResolver<QueryCtx, ObjectType<ArgsValidator> & Record<string, unknown>>
              | undefined,
          }
        );
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
  } as any);
}

export function authAction<ArgsValidator extends PropertyValidators, ReturnValue = unknown>(
  options: WrapperOptions<ActionCtx, ArgsValidator, ReturnValue>
) {
  const workspaceIdArg =
    options.workspaceIdArg ?? ("workspaceId" as keyof ObjectType<ArgsValidator> & string);

  return action({
    args: options.args,
    handler: async (ctx: ActionCtx, args: ObjectType<ArgsValidator>) => {
      const user = await getActionUser(ctx);

      if (options.permission) {
        const workspaceId = await getWorkspaceIdForPermission(
          ctx,
          args as ObjectType<ArgsValidator> & Record<string, unknown>,
          user,
          {
            workspaceIdArg: workspaceIdArg as keyof (ObjectType<ArgsValidator> &
              Record<string, unknown>) &
              string,
            resolveWorkspaceId: options.resolveWorkspaceId as
              | WorkspaceResolver<ActionCtx, ObjectType<ArgsValidator> & Record<string, unknown>>
              | undefined,
          }
        );
        if (!workspaceId) {
          if (options.allowMissingWorkspace) {
            return options.handler(withUser(ctx, user), args);
          }
          throw new Error("Auth wrapper misconfigured: missing workspace resolver");
        }
        await ctx.runQuery(internal.permissions.requirePermissionForAction, {
          userId: user._id,
          workspaceId,
          permission: options.permission,
        });
      }

      return options.handler(withUser(ctx, user), args);
    },
  } as any);
}
