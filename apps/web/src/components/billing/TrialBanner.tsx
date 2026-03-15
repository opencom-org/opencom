"use client";

import { AlertTriangle, Clock } from "lucide-react";
import type { Id } from "@opencom/convex/dataModel";
import { useBillingStatus } from "./useBillingStatus";

interface TrialBannerProps {
  workspaceId: Id<"workspaces"> | undefined;
}

/**
 * Shows a trial countdown banner when the workspace is on a free trial.
 * - Hidden when billing is disabled (self-hosted)
 * - Hidden when subscription is active (not trialing)
 * - Urgent style when <= 2 days remaining
 * - CTA to choose a plan
 */
export function TrialBanner({ workspaceId }: TrialBannerProps) {
  const billingStatus = useBillingStatus(workspaceId);

  // Don't render while loading or when billing is disabled
  if (!billingStatus || !billingStatus.billingEnabled) {
    return null;
  }

  // Only show for trialing subscriptions
  if (billingStatus.status !== "trialing") {
    return null;
  }

  const daysRemaining = billingStatus.trialDaysRemaining;
  const isUrgent = daysRemaining !== null && daysRemaining <= 2;

  return (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-2 text-sm ${
        isUrgent
          ? "bg-destructive/10 border-b border-destructive/20 text-destructive"
          : "bg-primary/5 border-b border-primary/10 text-primary"
      }`}
    >
      <div className="flex items-center gap-2">
        {isUrgent ? (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        ) : (
          <Clock className="h-4 w-4 shrink-0" />
        )}
        <span>
          {daysRemaining === null
            ? "Free trial active — choose a plan to continue."
            : daysRemaining === 0
              ? "Your free trial expires today."
              : daysRemaining === 1
                ? "Your free trial expires tomorrow."
                : `${daysRemaining} days left in your free trial.`}
        </span>
      </div>
      <a
        href="/settings?section=billing"
        className="shrink-0 font-medium underline underline-offset-4 hover:no-underline"
      >
        Choose a plan
      </a>
    </div>
  );
}
