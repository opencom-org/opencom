import { Server, Github } from "lucide-react";
import { OPENCOM_GITHUB_REPO_URL, OPENCOM_GITHUB_DOCS_URL } from "@/lib/links";

export function SelfHostCallout() {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-primary/10 p-3">
            <Server className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Self-host for free</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-lg">
              Opencom is open source (AGPL-3.0). Deploy on your own Convex account — no seat limits,
              no usage limits, no billing. You pay Convex, Resend, and your AI provider directly at
              cost. Every feature is included.
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>All features unlocked</span>
              <span>No limits</span>
              <span>Your data, your infrastructure</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <a
            href={OPENCOM_GITHUB_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Github className="h-4 w-4" />
            Self-hosting docs
          </a>
          <a
            href={OPENCOM_GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View source on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
