"use client";

import { CreditCard } from "lucide-react";
import type { Id } from "@opencom/convex/dataModel";
import { useBillingStatus } from "./useBillingStatus";

interface BillingSettingsProps {
  workspaceId: Id<"workspaces"> | undefined;
}

/**
 * Billing settings component — stub for the public repository.
 *
 * In self-hosted deployments: renders nothing (billing is disabled).
 * In hosted deployments: this file is REPLACED by the opencom-billing overlay
 * with a full billing management UI (plan display, usage meters, invoices, etc.).
 *
 * The stub shows a loading placeholder when billing is enabled but the full
 * overlay is not deployed.
 *
 * IMPORTANT: Do not add business logic to this file. It must remain a thin
 * stub so the overlay can replace it cleanly.
 */
export function BillingSettings({ workspaceId }: BillingSettingsProps) {
  const billingStatus = useBillingStatus(workspaceId);

  // Self-hosted or billing not configured: render nothing
  if (!billingStatus?.billingEnabled) {
    return null;
  }

  // Billing is enabled but overlay is not deployed: show placeholder
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-muted/30 p-8 text-center">
      <div className="rounded-full bg-primary/10 p-3">
        <CreditCard className="h-6 w-6 text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">Billing Settings</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Billing settings are loading. If this persists, contact support.
        </p>
      </div>
    </div>
  );
}
