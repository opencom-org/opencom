import type { Metadata } from "next";
import {
  GitPullRequest,
  Bug,
  FileCode,
  MessageSquare,
  Heart,
  ExternalLink,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { buttonVariants, cn } from "@opencom/ui";
import { Section, SectionHeader, FeatureCard } from "@/components/sections";
import { OPENCOM_GITHUB_REPO_URL } from "@/lib/links";
import { createLandingPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = createLandingPageMetadata({
  title: "Contributing | Opencom",
  description:
    "Contribute to Opencom with focused pull requests, docs updates, issue triage, and community discussions.",
  path: "/contributing",
});

const contributionTypes = [
  {
    title: "Report Bugs",
    description: "Found something broken? Share repro details so we can fix it quickly.",
    icon: Bug,
  },
  {
    title: "Submit PRs",
    description: "Pick up an issue, implement cleanly, and ship a scoped pull request.",
    icon: GitPullRequest,
  },
  {
    title: "Improve Docs",
    description: "Clarify setup, architecture, and troubleshooting docs for new users.",
    icon: FileCode,
  },
  {
    title: "Join Discussions",
    description: "Share product ideas and implementation feedback with the core team.",
    icon: MessageSquare,
  },
];

const contributorDocs = [
  {
    title: "Contributing Guide",
    description:
      "Canonical contributor workflow: setup, conventions, verification, and PR expectations.",
    href: `${OPENCOM_GITHUB_REPO_URL}/blob/main/CONTRIBUTING.md`,
  },
  {
    title: "Setup, Self-Host, and Deploy",
    description:
      "Bootstrap script path, manual setup path, environment variables, and deployment profiles.",
    href: `${OPENCOM_GITHUB_REPO_URL}/blob/main/docs/open-source/setup-self-host-and-deploy.md`,
  },
  {
    title: "Testing and Verification",
    description: "Focused package checks, E2E prep, and CI-equivalent verification commands.",
    href: `${OPENCOM_GITHUB_REPO_URL}/blob/main/docs/open-source/testing-and-verification.md`,
  },
];

const goodFirstIssues = [
  {
    title: "Improve widget accessibility",
    labels: ["good first issue", "accessibility"],
    url: "https://github.com/opencom-org/opencom/issues",
  },
  {
    title: "Add unit tests for conversation module",
    labels: ["good first issue", "testing"],
    url: "https://github.com/opencom-org/opencom/issues",
  },
  {
    title: "Update README with deployment guide",
    labels: ["good first issue", "documentation"],
    url: "https://github.com/opencom-org/opencom/issues",
  },
];

export default function ContributingPage() {
  return (
    <>
      <Section className="pt-24">
        <SectionHeader
          badge="Contributing"
          title="Help build open customer messaging infrastructure"
          description="Opencom is open source and actively evolving. Contributions across product, docs, and developer tooling are all high leverage."
        />

        <div className="mx-auto mb-12 max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/85 p-8 shadow-[0_30px_70px_-40px_rgba(15,23,42,0.6)] backdrop-blur md:p-10 dark:border-white/10 dark:bg-card/85">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We optimize for pragmatic contributions: focused scope, clear testing, and docs
              updates when behavior changes. If you are not sure where to start, begin with labeled
              issues and discussions.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {contributionTypes.map((type) => (
            <FeatureCard key={type.title} {...type} />
          ))}
        </div>
      </Section>

      <Section className="bg-[#f9fafb] dark:bg-muted/10">
        <SectionHeader
          title="Getting started docs (canonical)"
          description="Detailed setup and verification instructions live in GitHub docs so landing content stays minimal and up to date."
          centered={false}
        />
        <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          <div className="rounded-[1.8rem] border border-slate-200/80 bg-white/90 p-7 shadow-[0_18px_35px_-25px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-card/90">
            <h3 className="text-xl font-semibold tracking-tight">Minimal local bootstrap</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              If you just want a local contributor environment quickly, use the repo bootstrap
              script first, then follow the canonical docs below for package-specific workflows.
            </p>
            <pre className="mt-5 overflow-x-auto rounded-xl border border-border/70 bg-muted/50 p-4 text-sm">
              <code>{`git clone https://github.com/opencom-org/opencom.git
cd opencom
./scripts/setup.sh`}</code>
            </pre>
            <a
              href={`${OPENCOM_GITHUB_REPO_URL}#getting-started`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ className: "mt-5" }))}
            >
              Open GitHub Getting Started
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </div>

          <div className="space-y-4">
            {contributorDocs.map((doc) => (
              <a
                key={doc.title}
                href={doc.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_35px_-25px_rgba(15,23,42,0.45)] transition-colors hover:border-primary/40 dark:border-white/10 dark:bg-card/90"
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="font-medium">{doc.title}</h4>
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{doc.description}</p>
              </a>
            ))}
            <a
              href={`${OPENCOM_GITHUB_REPO_URL}/tree/main/docs/open-source`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", className: "w-full" }))}
            >
              Browse OSS Docs Hub
            </a>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
          This page intentionally avoids duplicating full setup instructions. Canonical commands and
          troubleshooting live in GitHub docs.
        </div>
      </Section>

      <Section>
        <SectionHeader
          title="Good first issues"
          description="New contributors can start with focused tasks that have clear implementation boundaries."
        />
        <div className="mx-auto max-w-3xl space-y-4">
          {goodFirstIssues.map((issue) => (
            <a
              key={issue.title}
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-2xl border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_35px_-25px_rgba(15,23,42,0.45)] transition-colors hover:border-primary/40 dark:border-white/10 dark:bg-card/85"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium">{issue.title}</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {issue.labels.map((label) => (
                      <span
                        key={label}
                        className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
              </div>
            </a>
          ))}
          <div className="pt-4 text-center">
            <a
              href="https://github.com/opencom-org/opencom/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              View All Good First Issues
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </div>
        </div>
      </Section>

      <Section className="bg-[#f9fafb] dark:bg-muted/10">
        <SectionHeader
          title="Community resources"
          description="Ask questions, propose ideas, and review contribution standards."
        />
        <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
          <a
            href="https://github.com/opencom-org/opencom/discussions"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_35px_-25px_rgba(15,23,42,0.45)] transition-colors hover:border-primary/40 dark:border-white/10 dark:bg-card/85"
          >
            <MessageSquare className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-medium">GitHub Discussions</h3>
              <p className="text-sm text-muted-foreground">Ask questions and share ideas</p>
            </div>
          </a>

          <a
            href="https://github.com/opencom-org/opencom/blob/main/CONTRIBUTING.md"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_35px_-25px_rgba(15,23,42,0.45)] transition-colors hover:border-primary/40 dark:border-white/10 dark:bg-card/85"
          >
            <BookOpen className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-medium">Contributing Guide</h3>
              <p className="text-sm text-muted-foreground">Full contribution standards</p>
            </div>
          </a>
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200/80 bg-white/85 p-10 text-center shadow-[0_24px_55px_-35px_rgba(15,23,42,0.6)] dark:border-white/10 dark:bg-card/85">
          <Heart className="mx-auto mb-4 h-12 w-12 text-rose-500" />
          <h2 className="text-3xl font-bold tracking-tight">Thanks to everyone contributing</h2>
          <p className="mt-3 text-muted-foreground">
            Opencom exists because contributors turn ideas into shipped improvements.
          </p>
          <a
            href="https://github.com/opencom-org/opencom"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ size: "lg", className: "mt-7" }))}
          >
            Star us on GitHub
            <Heart className="ml-2 h-4 w-4" />
          </a>
        </div>
      </Section>
    </>
  );
}
