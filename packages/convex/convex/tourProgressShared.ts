import { normalizeRoutePath } from "@opencom/types";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export type VisitorAuthArgs = {
  workspaceId: Id<"workspaces">;
  sessionToken?: string;
  visitorId?: Id<"visitors">;
};

export type AdvanceMode = "click" | "elementClick" | "fieldFill";
export type DiagnosticMode = AdvanceMode | "system";
export type DiagnosticReason =
  | "mode_mismatch"
  | "element_click_required"
  | "field_fill_required"
  | "field_fill_invalid"
  | "route_mismatch"
  | "checkpoint_invalid_route"
  | "selector_missing";

export type ProgressContext = {
  tour: Doc<"tours">;
  visitorId: Id<"visitors">;
  progress: Doc<"tourProgress">;
  steps: Doc<"tourSteps">[];
};

export function clearCheckpoint() {
  return {
    checkpointStep: undefined,
    checkpointRoute: undefined,
    checkpointSelector: undefined,
  };
}

export function buildCheckpoint(currentStep: number, step?: Doc<"tourSteps">) {
  if (!step) {
    return clearCheckpoint();
  }

  return {
    checkpointStep: currentStep,
    checkpointRoute: normalizeRoutePath(step.routePath),
    checkpointSelector: step.elementSelector,
  };
}

export async function getOrderedTourSteps(
  ctx: QueryCtx | MutationCtx,
  tourId: Id<"tours">
): Promise<Doc<"tourSteps">[]> {
  const steps = await ctx.db
    .query("tourSteps")
    .withIndex("by_tour", (q) => q.eq("tourId", tourId))
    .collect();

  return steps.sort((a, b) => a.order - b.order);
}

export async function recordDiagnostic(
  ctx: MutationCtx,
  args: {
    progress: Doc<"tourProgress">;
    step?: Doc<"tourSteps">;
    reason: DiagnosticReason;
    mode: DiagnosticMode;
    currentUrl?: string;
    selector?: string;
    metadata?: Record<string, string | number | boolean | null>;
  }
) {
  await ctx.db.insert("tourProgressDiagnostics", {
    progressId: args.progress._id,
    tourId: args.progress.tourId,
    visitorId: args.progress.visitorId,
    stepOrder: args.step?.order ?? args.progress.currentStep,
    reason: args.reason,
    mode: args.mode,
    currentUrl: args.currentUrl,
    selector: args.selector ?? args.step?.elementSelector,
    metadata: args.metadata,
    createdAt: Date.now(),
  });
}
