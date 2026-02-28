import type { Metadata } from "next";
import Link from "next/link";
import {
  Terminal,
  Server,
  BookOpen,
  Code2,
  ExternalLink,
  Smartphone,
  Bot,
  Layout,
  Blocks,
  Sparkles,
} from "lucide-react";
import { buttonVariants, cn } from "@opencom/ui";
import { Section, SectionHeader, FeatureCard, Screenshot } from "@/components/sections";
import {
  OPENCOM_GITHUB_DOCS_URL,
  OPENCOM_GITHUB_REPO_URL,
  OPENCOM_HOSTED_ONBOARDING_URL,
} from "@/lib/links";
import { createLandingPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = createLandingPageMetadata({
  title: "Documentation | Opencom",
  description:
    "Opencom docs hub for hosted onboarding, self-host setup, widget installation, architecture, and SDK references.",
  path: "/docs",
});

const quickLinks = [
  {
    title: "Hosted Onboarding",
    description: "Try Opencom in the hosted environment at app.opencom.dev.",
    icon: Terminal,
    href: OPENCOM_HOSTED_ONBOARDING_URL,
  },
  {
    title: "GitHub Docs Hub",
    description: "Canonical documentation source for setup and implementation.",
    icon: BookOpen,
    href: OPENCOM_GITHUB_DOCS_URL,
  },
  {
    title: "Self-Host Quick Start",
    description: "Use the maintained README flow for local and self-host setup.",
    icon: Server,
    href: `${OPENCOM_GITHUB_REPO_URL}#quick-start-self-hosters`,
  },
  {
    title: "Widget Installation",
    description: "Install and configure the widget from the canonical guide.",
    icon: Layout,
    href: `${OPENCOM_GITHUB_REPO_URL}#widget-installation`,
  },
  {
    title: "Native SDKs",
    description: "React Native, iOS (Swift), and Android (Kotlin) packages.",
    icon: Smartphone,
    href: `${OPENCOM_GITHUB_REPO_URL}/tree/main/packages`,
  },
  {
    title: "AI Agent Reference",
    description: "Feature scope, model providers, and AI behavior docs.",
    icon: Bot,
    href: `${OPENCOM_GITHUB_REPO_URL}#features`,
  },
  {
    title: "Architecture",
    description: "Monorepo architecture and system design notes.",
    icon: Blocks,
    href: `${OPENCOM_GITHUB_REPO_URL}/blob/main/docs/architecture.md`,
  },
  {
    title: "Contributing Guide",
    description: "Contribution process, standards, and collaboration workflow.",
    icon: Code2,
    href: `${OPENCOM_GITHUB_REPO_URL}/blob/main/CONTRIBUTING.md`,
  },
];

export default function DocsPage() {
  return (
    <>
      <Section className="pt-24">
        <SectionHeader
          badge="Documentation"
          title="GitHub is the source of truth"
          description="Opencom setup evolves fast during alpha. We keep authoritative install, deployment, and implementation docs in the GitHub repo."
        />

        <div className="mx-auto mt-10 max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/85 p-8 shadow-[0_30px_70px_-40px_rgba(15,23,42,0.6)] backdrop-blur md:p-10 dark:border-white/10 dark:bg-card/85">
          <div className="grid gap-7 md:grid-cols-[1.2fr_1fr] md:items-end">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Start Fast
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Two paths, one doc stack
              </h2>
              <p className="mt-4 text-muted-foreground">
                Use hosted onboarding for quick evaluation, then move to GitHub docs for
                self-hosting, environment setup, and production hardening.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <a
                href={OPENCOM_HOSTED_ONBOARDING_URL}
                className={cn(buttonVariants({ size: "lg" }))}
              >
                Open Hosted Onboarding
              </a>
              <a
                href={OPENCOM_GITHUB_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
              >
                GitHub Docs
              </a>
            </div>
          </div>
        </div>
      </Section>

      <Section id="docs-links" className="bg-[#f9fafb] dark:bg-muted/10">
        <SectionHeader
          title="Jump to the exact guide you need"
          description="Pick a lane below to go directly to setup, architecture, SDKs, or operational reference docs."
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => (
            <FeatureCard key={link.title} {...link} />
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeader
          title="Choose your implementation lane"
          description="Hosted onboarding is fastest for evaluation. Self-host lane is best when you need ownership, security controls, or deeper customization."
          centered={false}
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white p-7 shadow-[0_24px_55px_-35px_rgba(15,23,42,0.6)] dark:border-white/10 dark:bg-card/85">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-transparent" />
            <h3 className="relative text-2xl font-semibold tracking-tight">
              Hosted onboarding lane
            </h3>
            <p className="relative mt-4 text-sm leading-relaxed text-muted-foreground">
              Fastest route to validate Opencom web + mobile admin workflows with no infrastructure
              work.
            </p>
            <ul className="relative mt-6 space-y-2 text-sm text-muted-foreground">
              <li>Instant workspace access.</li>
              <li>Live widget and inbox workflows ready out of the box.</li>
              <li>Best for product evaluation and team walkthroughs.</li>
            </ul>
            <a
              href={OPENCOM_HOSTED_ONBOARDING_URL}
              className={cn(buttonVariants({ className: "relative mt-8" }))}
            >
              Launch Hosted Onboarding
            </a>
          </div>

          <div className="rounded-[2rem] border border-slate-200/80 bg-white p-7 shadow-[0_24px_55px_-35px_rgba(15,23,42,0.6)] dark:border-white/10 dark:bg-card/85">
            <h3 className="text-2xl font-semibold tracking-tight">Self-host lane</h3>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Follow maintained docs for environment variables, deployment models, and operational
              guidance.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>Quick start + monorepo setup guidance.</li>
              <li>Widget integration and identity verification.</li>
              <li>Security and production architecture references.</li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={OPENCOM_GITHUB_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants())}
              >
                Open GitHub Docs
              </a>
              <a
                href={`${OPENCOM_GITHUB_REPO_URL}#getting-started`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                README Setup
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </Section>

      <Section className="bg-[#f9fafb] dark:bg-muted/10">
        <SectionHeader
          title="Widget integration"
          description="The live widget is already running on this site. Test the launcher in the corner, then use docs for production snippets and identity verification."
          centered={false}
        />
        <div className="grid gap-10 lg:grid-cols-[1fr_1.25fr] lg:items-start">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white p-7 shadow-[0_24px_55px_-35px_rgba(15,23,42,0.6)] dark:border-white/10 dark:bg-card/85">
            <p className="text-sm leading-relaxed text-muted-foreground">
              For production snippets, identity verification, and advanced widget customization, use
              the maintained GitHub guide.
            </p>
            <a
              href={`${OPENCOM_GITHUB_REPO_URL}#widget-installation`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", className: "mt-7" }))}
            >
              Open Widget Installation Guide
            </a>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Screenshot src="/screenshots/widget-tab-home.png" alt="Widget home tab" />
            <Screenshot src="/screenshots/widget-tour-post-step.png" alt="Widget product tour" />
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeader
          title="Need help?"
          description="For support and implementation questions, use GitHub discussions. For contribution workflows, follow the project contributor docs."
        />
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="https://github.com/opencom-org/opencom/discussions"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ size: "lg" }))}
          >
            GitHub Discussions
          </a>
          <Link
            href="/contributing"
            className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
          >
            Contribute
          </Link>
        </div>
      </Section>
    </>
  );
}
