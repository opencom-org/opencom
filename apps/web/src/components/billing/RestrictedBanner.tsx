"use client";

import { XCircle } from "lucide-react";
import type { Id } from "@opencom/convex/dataModel";
import { useBillingStatus } from "./useBillingStatus";

interface RestrictedBannerProps {
  workspaceId: Id<"workspaces"> | undefined;
}

const RESTRICTED_MESSAGES: Record<string, string> = {
  expired: "Your free trial has ended. Your workspace is in read-only mode.",
  canceled: "Your subscription has been canceled. Your workspace is in read-only mode.",
  past_due: "Your subscription payment failed. Your workspace is in read-only mode.",
  unpaid: "Your subscription is unpaid. Your workspace is in read-only mode.",
};

/**
 * Non-dismissible banner shown when the workspace is in a restricted billing state.
 * Blocked states: expired, canceled, past_due, unpaid.
 * Hidden when billing is disabled or subscription is active/trialing.
 */
export function RestrictedBanner({ workspaceId }: RestrictedBannerProps) {
  const billingStatus = useBillingStatus(workspaceId);

  // Don't render while loading or when billing is disabled
  if (!billingStatus || !billingStatus.billingEnabled) {
    return null;
  }

  // Only show for restricted states
  if (!billingStatus.isRestricted) {
    return null;
  }

  const message =
    RESTRICTED_MESSAGES[billingStatus.status] ??
    "Your workspace subscription is inactive. Your workspace is in read-only mode.";

  return (
    <div className="flex items-center justify-between gap-4 bg-destructive/10 border-b border-destructive/30 px-4 py-3 text-sm text-destructive">
      <div className="flex items-center gap-2">
        <XCircle className="h-4 w-4 shrink-0" />
        <span>
          <strong>Workspace restricted.</strong> {message} Your data is safe and can be exported at
          any time.
        </span>
      </div>
      <a
        href="/settings?section=billing"
        className="shrink-0 font-semibold underline underline-offset-4 hover:no-underline whitespace-nowrap"
      >
        Reactivate subscription
      </a>
    </div>
  );
}
