import { evaluateRouteMatch } from "@opencom/types";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  getTourInWorkspace,
  getVisitorTourProgress,
  loadProgressContext,
  resolveAuthorizedTourVisitor,
} from "./tourProgressAccess";
import {
  buildCheckpoint,
  clearCheckpoint,
  getOrderedTourSteps,
  recordDiagnostic,
  type AdvanceMode,
  type DiagnosticMode,
  type DiagnosticReason,
} from "./tourProgressShared";

type TourMutationArgs = {
  workspaceId: Id<"workspaces">;
  visitorId?: Id<"visitors">;
  sessionToken?: string;
  tourId: Id<"tours">;
};

export type StartTourProgressArgs = TourMutationArgs & {
  force?: boolean;
  currentUrl?: string;
};

export async function startTourProgress(ctx: MutationCtx, args: StartTourProgressArgs) {
  await getTourInWorkspace(ctx, {
    workspaceId: args.workspaceId,
    tourId: args.tourId,
  });

  const visitorId = await resolveAuthorizedTourVisitor(ctx, {
    workspaceId: args.workspaceId,
    sessionToken: args.sessionToken,
    visitorId: args.visitorId,
  });

  const steps = await getOrderedTourSteps(ctx, args.tourId);
  const existing = await getVisitorTourProgress(ctx, {
    visitorId,
    tourId: args.tourId,
  });

  const now = Date.now();
  const firstStep = steps[0];

  if (existing) {
    if (
      args.force ||
      (existing.status === "snoozed" &&
        existing.snoozedUntil !== undefined &&
        existing.snoozedUntil < now)
    ) {
      await ctx.db.patch(existing._id, {
        status: "in_progress",
        currentStep: 0,
        ...buildCheckpoint(0, firstStep),
        lastSeenUrl: args.currentUrl,
        snoozedUntil: undefined,
        completedAt: undefined,
        lastBlockedReason: undefined,
        lastBlockedMode: undefined,
        lastBlockedAt: undefined,
        updatedAt: now,
      });
      return existing._id;
    }

    if (existing.status === "in_progress") {
      const currentStepDoc = steps[existing.currentStep];
      await ctx.db.patch(existing._id, {
        ...buildCheckpoint(existing.currentStep, currentStepDoc),
        lastSeenUrl: args.currentUrl,
        updatedAt: now,
      });
    }

    return existing._id;
  }

  return await ctx.db.insert("tourProgress", {
    visitorId,
    tourId: args.tourId,
    currentStep: 0,
    ...buildCheckpoint(0, firstStep),
    lastSeenUrl: args.currentUrl,
    status: "in_progress",
    createdAt: now,
    updatedAt: now,
  });
}

export type AdvanceTourProgressArgs = TourMutationArgs & {
  mode?: AdvanceMode;
  targetMatched?: boolean;
  fieldValue?: string;
  selector?: string;
  currentUrl?: string;
};

export async function advanceTourProgress(ctx: MutationCtx, args: AdvanceTourProgressArgs) {
  const { progress, steps } = await loadProgressContext(ctx, args);

  if (progress.status !== "in_progress") {
    throw new Error("Tour is not in progress");
  }

  const now = Date.now();
  const currentStep = steps[progress.currentStep];
  const mode = args.mode ?? "click";

  if (!currentStep) {
    await ctx.db.patch(progress._id, {
      status: "completed",
      completedAt: now,
      updatedAt: now,
      ...clearCheckpoint(),
    });
    return {
      progressId: progress._id,
      advanced: true,
      status: "completed",
      nextStep: progress.currentStep,
    };
  }

  const routeMatch = evaluateRouteMatch(currentStep.routePath, args.currentUrl, {
    matchWhenCurrentUrlMissing: true,
  });
  const expectedMode = (currentStep.advanceOn ?? "click") as AdvanceMode;

  let blockedReason: DiagnosticReason | null = null;
  if (routeMatch.invalidRoute) {
    blockedReason = "checkpoint_invalid_route";
  } else if (!routeMatch.matches) {
    blockedReason = "route_mismatch";
  } else if (mode !== expectedMode) {
    blockedReason = "mode_mismatch";
  } else if (expectedMode === "elementClick" && !args.targetMatched) {
    blockedReason = "element_click_required";
  } else if (expectedMode === "fieldFill") {
    const normalizedValue = args.fieldValue?.trim() ?? "";
    if (!normalizedValue) {
      blockedReason = "field_fill_required";
    }
  }

  if (blockedReason) {
    await recordDiagnostic(ctx, {
      progress,
      step: currentStep,
      reason: blockedReason,
      mode,
      currentUrl: args.currentUrl,
      selector: args.selector,
      metadata: {
        expectedMode,
        providedMode: mode,
        targetMatched: args.targetMatched ?? null,
      },
    });

    await ctx.db.patch(progress._id, {
      ...buildCheckpoint(progress.currentStep, currentStep),
      lastSeenUrl: args.currentUrl,
      lastBlockedReason: blockedReason,
      lastBlockedMode: mode,
      lastBlockedAt: now,
      updatedAt: now,
    });

    return {
      progressId: progress._id,
      advanced: false,
      blockedReason,
      status: progress.status,
      nextStep: progress.currentStep,
    };
  }

  const nextStepIndex = progress.currentStep + 1;
  const nextStep = steps[nextStepIndex];

  if (!nextStep) {
    await ctx.db.patch(progress._id, {
      currentStep: nextStepIndex,
      status: "completed",
      completedAt: now,
      lastSeenUrl: args.currentUrl,
      ...clearCheckpoint(),
      lastBlockedReason: undefined,
      lastBlockedMode: undefined,
      lastBlockedAt: undefined,
      updatedAt: now,
    });
    return {
      progressId: progress._id,
      advanced: true,
      blockedReason: null,
      status: "completed",
      nextStep: nextStepIndex,
    };
  }

  await ctx.db.patch(progress._id, {
    currentStep: nextStepIndex,
    ...buildCheckpoint(nextStepIndex, nextStep),
    lastSeenUrl: args.currentUrl,
    lastBlockedReason: undefined,
    lastBlockedMode: undefined,
    lastBlockedAt: undefined,
    updatedAt: now,
  });

  return {
    progressId: progress._id,
    advanced: true,
    blockedReason: null,
    status: "in_progress",
    nextStep: nextStepIndex,
  };
}

export type SkipTourStepArgs = TourMutationArgs & {
  reason: DiagnosticReason;
  selector?: string;
  currentUrl?: string;
};

export async function skipTourStep(ctx: MutationCtx, args: SkipTourStepArgs) {
  const { progress, steps } = await loadProgressContext(ctx, args);

  if (progress.status !== "in_progress") {
    throw new Error("Tour is not in progress");
  }

  const now = Date.now();
  const currentStep = steps[progress.currentStep];
  if (!currentStep) {
    throw new Error("Current step not found");
  }

  await recordDiagnostic(ctx, {
    progress,
    step: currentStep,
    reason: args.reason,
    mode: "system",
    currentUrl: args.currentUrl,
    selector: args.selector,
  });

  const nextStepIndex = progress.currentStep + 1;
  const nextStep = steps[nextStepIndex];

  if (!nextStep) {
    await ctx.db.patch(progress._id, {
      currentStep: nextStepIndex,
      status: "completed",
      completedAt: now,
      lastSeenUrl: args.currentUrl,
      ...clearCheckpoint(),
      lastBlockedReason: args.reason,
      lastBlockedMode: "system",
      lastBlockedAt: now,
      updatedAt: now,
    });
    return {
      progressId: progress._id,
      skipped: true,
      reason: args.reason,
      status: "completed",
      nextStep: nextStepIndex,
    };
  }

  await ctx.db.patch(progress._id, {
    currentStep: nextStepIndex,
    ...buildCheckpoint(nextStepIndex, nextStep),
    lastSeenUrl: args.currentUrl,
    lastBlockedReason: args.reason,
    lastBlockedMode: "system",
    lastBlockedAt: now,
    updatedAt: now,
  });

  return {
    progressId: progress._id,
    skipped: true,
    reason: args.reason,
    status: "in_progress",
    nextStep: nextStepIndex,
  };
}

export type CheckpointTourProgressArgs = TourMutationArgs & {
  currentUrl?: string;
  selector?: string;
  blockedReason?: DiagnosticReason;
  mode?: AdvanceMode;
};

export async function checkpointTourProgress(
  ctx: MutationCtx,
  args: CheckpointTourProgressArgs
) {
  const { progress, steps } = await loadProgressContext(ctx, args);

  if (progress.status !== "in_progress") {
    throw new Error("Tour is not in progress");
  }

  const currentStep = steps[progress.currentStep];
  if (!currentStep) {
    throw new Error("Current step not found");
  }

  const now = Date.now();
  const diagnosticMode: DiagnosticMode = args.mode ?? "system";

  if (args.blockedReason) {
    await recordDiagnostic(ctx, {
      progress,
      step: currentStep,
      reason: args.blockedReason,
      mode: diagnosticMode,
      currentUrl: args.currentUrl,
      selector: args.selector,
    });
  }

  await ctx.db.patch(progress._id, {
    ...buildCheckpoint(progress.currentStep, currentStep),
    lastSeenUrl: args.currentUrl,
    lastBlockedReason: args.blockedReason,
    lastBlockedMode: args.blockedReason ? diagnosticMode : undefined,
    lastBlockedAt: args.blockedReason ? now : undefined,
    updatedAt: now,
  });

  return { progressId: progress._id };
}

export async function completeTourProgress(ctx: MutationCtx, args: TourMutationArgs) {
  const { progress } = await loadProgressContext(ctx, args);

  const now = Date.now();
  await ctx.db.patch(progress._id, {
    status: "completed",
    completedAt: now,
    ...clearCheckpoint(),
    updatedAt: now,
  });

  return progress._id;
}

export async function dismissTourProgress(ctx: MutationCtx, args: TourMutationArgs) {
  const { progress } = await loadProgressContext(ctx, args);

  await ctx.db.patch(progress._id, {
    status: "dismissed",
    ...clearCheckpoint(),
    updatedAt: Date.now(),
  });

  return progress._id;
}

export async function snoozeTourProgress(ctx: MutationCtx, args: TourMutationArgs) {
  const { progress } = await loadProgressContext(ctx, args);

  const now = Date.now();
  const snoozedUntil = now + 24 * 60 * 60 * 1000;

  await ctx.db.patch(progress._id, {
    status: "snoozed",
    snoozedUntil,
    updatedAt: now,
  });

  return progress._id;
}

export async function restartTourProgress(ctx: MutationCtx, args: TourMutationArgs) {
  const { progress, steps } = await loadProgressContext(ctx, args);

  await ctx.db.patch(progress._id, {
    currentStep: 0,
    status: "in_progress",
    ...buildCheckpoint(0, steps[0]),
    completedAt: undefined,
    snoozedUntil: undefined,
    lastBlockedReason: undefined,
    lastBlockedMode: undefined,
    lastBlockedAt: undefined,
    updatedAt: Date.now(),
  });

  return progress._id;
}

export async function dismissTourPermanently(ctx: MutationCtx, args: TourMutationArgs) {
  await getTourInWorkspace(ctx, {
    workspaceId: args.workspaceId,
    tourId: args.tourId,
  });

  const visitorId = await resolveAuthorizedTourVisitor(ctx, {
    workspaceId: args.workspaceId,
    sessionToken: args.sessionToken,
    visitorId: args.visitorId,
  });

  const progress = await getVisitorTourProgress(ctx, {
    visitorId,
    tourId: args.tourId,
  });

  const now = Date.now();

  if (progress) {
    await ctx.db.patch(progress._id, {
      status: "dismissed",
      ...clearCheckpoint(),
      updatedAt: now,
    });
    return progress._id;
  }

  return await ctx.db.insert("tourProgress", {
    visitorId,
    tourId: args.tourId,
    currentStep: 0,
    status: "dismissed",
    createdAt: now,
    updatedAt: now,
  });
}
