import { cronJobs, makeFunctionReference, type FunctionReference } from "convex/server";

// TS2589 hotspot: internal["billing/trialExpiry"].expireTrials triggers deep instantiation.
// Using a fixed typed makeFunctionReference instead.
type InternalMutationRef<Args extends Record<string, unknown>> = FunctionReference<
  "mutation",
  "internal",
  Args,
  unknown
>;

const EXPIRE_TRIALS_REF = makeFunctionReference<"mutation", Record<string, never>, unknown>(
  "billing/trialExpiry:expireTrials"
) as unknown as InternalMutationRef<Record<string, never>>;

const crons = cronJobs();

// ============================================================
// Trial expiry — runs hourly to transition expired trials to "expired" status
// Workspaces in "expired" status enter restricted state (read-only).
// In self-hosted mode, this is a no-op (isBillingEnabled() returns false).
// ============================================================
crons.hourly("billing-expire-trials", { minuteUTC: 0 }, EXPIRE_TRIALS_REF);

export default crons;
