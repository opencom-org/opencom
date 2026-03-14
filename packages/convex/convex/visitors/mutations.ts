import { makeFunctionReference, type FunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation } from "../_generated/server";
import { getAuthenticatedUserFromSession } from "../auth";
import { hasPermission } from "../permissions";
import { requireValidOrigin } from "../originValidation";
import { resolveVisitorFromSession } from "../widgetSessions";
import { logAudit } from "../auditLogs";
import { emitAutomationEvent } from "../automationEvents";
import {
  MERGE_REASON_EMAIL_MATCH,
  collectCustomAttributeChanges,
  collectStateChanges,
  customAttributesValidator,
  deviceValidator,
  findCanonicalVisitorByEmail,
  formatReadableVisitorId,
  locationValidator,
  reassignVisitorLinksBeforeDeletion,
  scheduleSeriesTriggerChanges,
} from "./helpers";

type InternalMutationRef<Args extends Record<string, unknown>, Return = unknown> =
  FunctionReference<"mutation", "internal", Args, Return>;

type VerifyIdentityArgs = {
  workspaceId: Id<"workspaces">;
  visitorId: Id<"visitors">;
  userId: string;
  userHash: string;
};

type VerifyIdentityResult = {
  verified: boolean;
  skipped?: boolean;
};

const VERIFY_IDENTITY_REF = makeFunctionReference<
  "mutation",
  VerifyIdentityArgs,
  VerifyIdentityResult
>("identityVerification:verifyIdentity") as unknown as InternalMutationRef<
  VerifyIdentityArgs,
  VerifyIdentityResult
>;

function getShallowRunMutation(ctx: { runMutation: unknown }) {
  return ctx.runMutation as unknown as <Args extends Record<string, unknown>, Return>(
    mutationRef: InternalMutationRef<Args, Return>,
    mutationArgs: Args
  ) => Promise<Return>;
}

export const identify = mutation({
  args: {
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    externalUserId: v.optional(v.string()),
    userHash: v.optional(v.string()), // HMAC-SHA256 hash for identity verification
    location: locationValidator,
    device: deviceValidator,
    referrer: v.optional(v.string()),
    currentUrl: v.optional(v.string()),
    customAttributes: v.optional(customAttributesValidator),
    origin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let resolvedVisitorId = args.visitorId;

    if (args.sessionToken && resolvedVisitorId) {
      const visitor = await ctx.db.get(resolvedVisitorId);
      if (visitor) {
        const resolved = await resolveVisitorFromSession(ctx, {
          sessionToken: args.sessionToken,
          workspaceId: visitor.workspaceId,
        });
        resolvedVisitorId = resolved.visitorId;
      }
    }

    if (!resolvedVisitorId) {
      throw new Error("Visitor ID required");
    }

    const visitor = await ctx.db.get(resolvedVisitorId);
    if (!visitor) {
      throw new Error("Visitor not found");
    }
    if (!visitor.readableId) {
      await ctx.db.patch(resolvedVisitorId, {
        readableId: formatReadableVisitorId(resolvedVisitorId),
      });
    }
    await requireValidOrigin(ctx, visitor.workspaceId, args.origin);

    const now = Date.now();

    // Verify identity if userHash is provided (task 5.5)
    if (args.externalUserId && args.userHash) {
      const runMutation = getShallowRunMutation(ctx);
      const result = await runMutation(VERIFY_IDENTITY_REF, {
        workspaceId: visitor.workspaceId,
        visitorId: resolvedVisitorId,
        userId: args.externalUserId,
        userHash: args.userHash,
      });

      // Check if verification is required and failed
      if (!result.verified && !result.skipped) {
        const workspace = await ctx.db.get(visitor.workspaceId);
        if (workspace?.identityVerificationMode === "required") {
          throw new Error("Identity verification failed");
        }
      }
    } else if (args.externalUserId && !args.userHash) {
      // userId provided without userHash — reject in required mode
      const workspace = await ctx.db.get(visitor.workspaceId);
      if (
        workspace?.identityVerificationEnabled &&
        workspace?.identityVerificationMode === "required"
      ) {
        throw new Error("Identity verification failed: userHash is required");
      }
    }

    if (args.email && args.email !== visitor.email) {
      const sourceVisitorId = resolvedVisitorId;
      const canonicalByEmail = await findCanonicalVisitorByEmail(ctx, {
        workspaceId: visitor.workspaceId,
        email: args.email,
        sourceVisitorId,
      });

      if (canonicalByEmail) {
        const sourceCustomAttributes = visitor.customAttributes as
          | Record<string, unknown>
          | undefined;
        const canonicalCustomAttributes = canonicalByEmail.customAttributes as
          | Record<string, unknown>
          | undefined;
        const patchCustomAttributes = args.customAttributes as Record<string, unknown> | undefined;
        const mergedCustomAttributes = {
          ...(sourceCustomAttributes ?? {}),
          ...(canonicalCustomAttributes ?? {}),
          ...(patchCustomAttributes ?? {}),
        };
        const hasMergedCustomAttributes = Object.keys(mergedCustomAttributes).length > 0;
        const canonicalReadableId =
          canonicalByEmail.readableId ?? formatReadableVisitorId(canonicalByEmail._id);

        const stateChanges = collectStateChanges(
          {
            email: canonicalByEmail.email,
            name: canonicalByEmail.name,
            externalUserId: canonicalByEmail.externalUserId,
          },
          {
            email: args.email,
            name: args.name ?? canonicalByEmail.name ?? visitor.name,
            externalUserId:
              args.externalUserId ?? canonicalByEmail.externalUserId ?? visitor.externalUserId,
          }
        );
        const attributeChanges = collectCustomAttributeChanges(
          canonicalCustomAttributes,
          hasMergedCustomAttributes ? mergedCustomAttributes : undefined
        );

        const transferSummary = await reassignVisitorLinksBeforeDeletion(ctx, {
          workspaceId: visitor.workspaceId,
          sourceVisitorId,
          targetVisitorId: canonicalByEmail._id,
          now,
        });

        await ctx.db.patch(canonicalByEmail._id, {
          ...(canonicalByEmail.readableId ? {} : { readableId: canonicalReadableId }),
          lastSeenAt: now,
          ...(args.name
            ? { name: args.name }
            : !canonicalByEmail.name && visitor.name
              ? { name: visitor.name }
              : {}),
          ...(args.externalUserId
            ? { externalUserId: args.externalUserId }
            : !canonicalByEmail.externalUserId && visitor.externalUserId
              ? { externalUserId: visitor.externalUserId }
              : {}),
          ...(args.location
            ? { location: args.location }
            : !canonicalByEmail.location && visitor.location
              ? { location: visitor.location }
              : {}),
          ...(args.device
            ? { device: args.device }
            : !canonicalByEmail.device && visitor.device
              ? { device: visitor.device }
              : {}),
          ...(args.referrer
            ? { referrer: args.referrer }
            : !canonicalByEmail.referrer && visitor.referrer
              ? { referrer: visitor.referrer }
              : {}),
          ...(args.currentUrl
            ? { currentUrl: args.currentUrl }
            : !canonicalByEmail.currentUrl && visitor.currentUrl
              ? { currentUrl: visitor.currentUrl }
              : {}),
          ...(hasMergedCustomAttributes ? { customAttributes: mergedCustomAttributes as any } : {}),
        });

        await ctx.db.delete(sourceVisitorId);

        await scheduleSeriesTriggerChanges(ctx, {
          workspaceId: visitor.workspaceId,
          visitorId: canonicalByEmail._id,
          source: "visitor_state_changed",
          changes: stateChanges,
        });
        await scheduleSeriesTriggerChanges(ctx, {
          workspaceId: visitor.workspaceId,
          visitorId: canonicalByEmail._id,
          source: "visitor_attribute_changed",
          changes: attributeChanges,
        });

        await logAudit(ctx, {
          workspaceId: visitor.workspaceId,
          actorType: "api",
          action: "visitor.merged",
          resourceType: "visitor",
          resourceId: canonicalByEmail._id,
          metadata: {
            sourceVisitorId,
            sourceVisitorReadableId: visitor.readableId ?? formatReadableVisitorId(sourceVisitorId),
            targetVisitorId: canonicalByEmail._id,
            targetVisitorReadableId: canonicalReadableId,
            workspaceId: visitor.workspaceId,
            reason: MERGE_REASON_EMAIL_MATCH,
            mergedAt: now,
            reassignedConversations: transferSummary.reassignedConversations,
            reassignedSessions: transferSummary.reassignedSessions,
            migratedPushTokens: transferSummary.migratedPushTokens,
            reassignedEvents: transferSummary.reassignedEvents,
          },
        });

        await emitAutomationEvent(ctx, {
          workspaceId: visitor.workspaceId,
          eventType: "visitor.updated",
          resourceType: "visitor",
          resourceId: canonicalByEmail._id,
          data: { visitorId: canonicalByEmail._id },
        });

        return await ctx.db.get(canonicalByEmail._id);
      }
    }

    const stateChanges = collectStateChanges(
      {
        email: visitor.email,
        name: visitor.name,
        externalUserId: visitor.externalUserId,
      },
      {
        email: args.email ?? visitor.email,
        name: args.name ?? visitor.name,
        externalUserId: args.externalUserId ?? visitor.externalUserId,
      }
    );
    const attributeChanges = collectCustomAttributeChanges(
      visitor.customAttributes as Record<string, unknown> | undefined,
      args.customAttributes as Record<string, unknown> | undefined
    );

    await ctx.db.patch(resolvedVisitorId, {
      lastSeenAt: now,
      ...(args.email && { email: args.email }),
      ...(args.name && { name: args.name }),
      ...(args.externalUserId && { externalUserId: args.externalUserId }),
      ...(args.location && { location: args.location }),
      ...(args.device && { device: args.device }),
      ...(args.referrer && { referrer: args.referrer }),
      ...(args.currentUrl && { currentUrl: args.currentUrl }),
      ...(args.customAttributes && {
        customAttributes: {
          ...visitor.customAttributes,
          ...args.customAttributes,
        },
      }),
    });

    await scheduleSeriesTriggerChanges(ctx, {
      workspaceId: visitor.workspaceId,
      visitorId: resolvedVisitorId,
      source: "visitor_state_changed",
      changes: stateChanges,
    });
    await scheduleSeriesTriggerChanges(ctx, {
      workspaceId: visitor.workspaceId,
      visitorId: resolvedVisitorId,
      source: "visitor_attribute_changed",
      changes: attributeChanges,
    });

    await emitAutomationEvent(ctx, {
      workspaceId: visitor.workspaceId,
      eventType: "visitor.updated",
      resourceType: "visitor",
      resourceId: resolvedVisitorId,
      data: { visitorId: resolvedVisitorId },
    });

    return await ctx.db.get(resolvedVisitorId);
  },
});

export const updateLocation = mutation({
  args: {
    visitorId: v.id("visitors"),
    sessionToken: v.optional(v.string()),
    location: v.object({
      city: v.optional(v.string()),
      region: v.optional(v.string()),
      country: v.optional(v.string()),
      countryCode: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) {
      throw new Error("Visitor not found");
    }

    const authUser = await getAuthenticatedUserFromSession(ctx);
    if (authUser) {
      const canRead = await hasPermission(ctx, authUser._id, visitor.workspaceId, "users.read");
      if (!canRead) {
        throw new Error("Permission denied");
      }
    } else {
      const resolved = await resolveVisitorFromSession(ctx, {
        sessionToken: args.sessionToken,
        workspaceId: visitor.workspaceId,
      });
      if (resolved.visitorId !== args.visitorId) {
        throw new Error("Not authorized to update location for this visitor");
      }
    }

    await ctx.db.patch(args.visitorId, {
      location: args.location,
      lastSeenAt: Date.now(),
    });
  },
});

export const heartbeat = mutation({
  args: {
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    origin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let resolvedVisitorId = args.visitorId;

    if (args.sessionToken && resolvedVisitorId) {
      const visitor = await ctx.db.get(resolvedVisitorId);
      if (visitor) {
        try {
          const resolved = await resolveVisitorFromSession(ctx, {
            sessionToken: args.sessionToken,
            workspaceId: visitor.workspaceId,
          });
          resolvedVisitorId = resolved.visitorId;
        } catch {
          return; // Silently fail for heartbeat
        }
      }
    }

    if (!resolvedVisitorId) {
      return;
    }

    const visitor = await ctx.db.get(resolvedVisitorId);
    if (!visitor) {
      return;
    }
    await requireValidOrigin(ctx, visitor.workspaceId, args.origin);
    await ctx.db.patch(resolvedVisitorId, {
      lastSeenAt: Date.now(),
    });
  },
});
