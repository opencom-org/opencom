"use client";

import { ArrowUpRight, Sparkles } from "lucide-react";

interface UpgradePromptProps {
  /** The feature that requires an upgrade */
  feature: string;
  /** Short description of what the upgrade unlocks */
  description?: string;
  /** Whether to show an inline compact variant (default: full card) */
  compact?: boolean;
}

/**
 * Upgrade prompt shown at gated feature entry points.
 * Used when a feature requires a Pro subscription.
 *
 * Renders nothing if shown inline when feature is available.
 */
export function UpgradePrompt({ feature, description, compact = false }: UpgradePromptProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-muted-foreground">
          <strong className="text-foreground">{feature}</strong> requires a Pro subscription.
        </span>
        <a
          href="/settings?section=billing"
          className="ml-auto flex items-center gap-1 text-primary font-medium hover:underline whitespace-nowrap"
        >
          Upgrade
          <ArrowUpRight className="h-3 w-3" />
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-muted/30 p-8 text-center">
      <div className="rounded-full bg-primary/10 p-3">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">{feature} requires Pro</h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">
          {description ??
            `Upgrade to the Pro plan to unlock ${feature} and other advanced features.`}
        </p>
      </div>
      <a
        href="/settings?section=billing"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <Sparkles className="h-4 w-4" />
        Upgrade to Pro
        <ArrowUpRight className="h-4 w-4" />
      </a>
      <p className="text-xs text-muted-foreground">
        7-day free trial includes Pro features. No credit card required.
      </p>
    </div>
  );
}
