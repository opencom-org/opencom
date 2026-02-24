import { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { buttonVariants, cn } from "@opencom/ui";

interface SectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

export function Section({ children, className, id }: SectionProps) {
  return (
    <section id={id} className={cn("relative overflow-hidden py-20 md:py-28", className)}>
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">{children}</div>
    </section>
  );
}

interface SectionHeaderProps {
  title: string;
  description?: string;
  badge?: string;
  centered?: boolean;
}

export function SectionHeader({ title, description, badge, centered = true }: SectionHeaderProps) {
  return (
    <div className={cn("mb-14 max-w-3xl", centered && "mx-auto text-center")}>
      {badge && (
        <span className="mb-5 inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          {badge}
        </span>
      )}
      <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">{title}</h2>
      {description && (
        <p
          className={cn(
            "mt-5 text-lg leading-relaxed text-muted-foreground",
            centered && "mx-auto max-w-2xl"
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href?: string;
}

function isExternalHref(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

export function FeatureCard({ title, description, icon: Icon, href }: FeatureCardProps) {
  const content = (
    <div className="group relative h-full overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/80 p-6 shadow-[0_18px_35px_-20px_rgba(15,23,42,0.4)] backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_30px_45px_-25px_rgba(124,58,237,0.45)] dark:border-white/10 dark:bg-card/80">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="relative mb-3 text-lg font-semibold">{title}</h3>
      <p className="relative text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );

  if (href) {
    if (isExternalHref(href)) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full">
          {content}
        </a>
      );
    }
    return (
      <Link href={href} className="block h-full">
        {content}
      </Link>
    );
  }
  return content;
}

interface ScreenshotProps {
  src: string;
  alt: string;
  className?: string;
}

export function Screenshot({ src, alt, className }: ScreenshotProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white p-2 shadow-[0_30px_70px_-35px_rgba(15,23,42,0.55)] dark:border-white/10 dark:bg-card",
        className
      )}
    >
      <div className="overflow-hidden rounded-[1.6rem] border border-border/60">
        <div className="flex items-center gap-2 border-b border-border/70 bg-muted/40 px-4 py-3">
          <div className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
          <div className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
          <div className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>
        <Image src={src} alt={alt} width={1200} height={800} className="h-auto w-full" />
      </div>
    </div>
  );
}

interface CTAProps {
  title: string;
  description: string;
  primaryAction: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
}

export function CTA({ title, description, primaryAction, secondaryAction }: CTAProps) {
  const renderAction = (
    action: { label: string; href: string },
    variant: "default" | "outline" = "default"
  ) => {
    const className = cn(buttonVariants({ size: "lg", variant }), "w-full sm:w-auto");

    if (isExternalHref(action.href)) {
      return (
        <a href={action.href} target="_blank" rel="noopener noreferrer" className={className}>
          {action.label}
        </a>
      );
    }
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    );
  };

  return (
    <Section className="bg-[#f9fafb] dark:bg-muted/10">
      <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200/80 bg-white p-10 text-center shadow-[0_35px_80px_-45px_rgba(15,23,42,0.65)] md:p-16 dark:border-white/10 dark:bg-card/90">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent" />
        <h2 className="relative text-4xl font-bold tracking-tight sm:text-5xl">{title}</h2>
        <p className="relative mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          {description}
        </p>
        <div className="relative mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {renderAction(primaryAction)}
          {secondaryAction && renderAction(secondaryAction, "outline")}
        </div>
      </div>
    </Section>
  );
}

interface StatProps {
  value: string;
  label: string;
}

export function Stat({ value, label }: StatProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-5 text-center shadow-sm dark:border-white/10 dark:bg-card/70">
      <div className="text-4xl font-bold text-primary">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

interface StatsGridProps {
  stats: StatProps[];
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
      {stats.map((stat, i) => (
        <Stat key={i} {...stat} />
      ))}
    </div>
  );
}
