"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type StatusTone = "neutral" | "success" | "warning" | "danger";

interface SettingsSectionContainerProps {
  id: string;
  title: string;
  description: string;
  statusLabel?: string;
  statusTone?: StatusTone;
  isExpanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}

const STATUS_TONE_CLASSNAMES: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
};

export function SettingsSectionContainer({
  id,
  title,
  description,
  statusLabel,
  statusTone = "neutral",
  isExpanded,
  onToggle,
  children,
}: SettingsSectionContainerProps): React.JSX.Element {
  return (
    <section id={id} tabIndex={-1} className="scroll-mt-28 space-y-3">
      <div className="rounded-lg border bg-muted/20 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {statusLabel && (
              <span
                className={`rounded-full px-2 py-1 text-[11px] font-medium ${STATUS_TONE_CLASSNAMES[statusTone]}`}
              >
                {statusLabel}
              </span>
            )}
            <button
              type="button"
              onClick={onToggle}
              data-testid={`settings-section-toggle-${id}`}
              className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground"
              aria-expanded={isExpanded}
              aria-controls={`${id}-content`}
            >
              {isExpanded ? (
                <>
                  Hide <ChevronUp className="h-3 w-3" />
                </>
              ) : (
                <>
                  Show <ChevronDown className="h-3 w-3" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div id={`${id}-content`} className="space-y-4">
          {children}
        </div>
      )}
    </section>
  );
}
