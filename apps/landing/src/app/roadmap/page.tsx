import type { Metadata } from "next";
import { CheckCircle, Clock, Circle, ExternalLink, Sparkles } from "lucide-react";
import { buttonVariants, cn } from "@opencom/ui";
import { Section, SectionHeader } from "@/components/sections";
import { createLandingPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = createLandingPageMetadata({
  title: "Roadmap | Opencom",
  description:
    "Track Opencom roadmap progress across chat, widget, tours, knowledge base, campaigns, AI, reports, and SDK delivery.",
  path: "/roadmap",
});

type FeatureStatus = "completed" | "in-progress" | "planned";

interface RoadmapItem {
  name: string;
  status: FeatureStatus;
  description?: string;
}

interface RoadmapCategory {
  category: string;
  items: RoadmapItem[];
}

const roadmap: RoadmapCategory[] = [
  {
    category: "Core Infrastructure",
    items: [
      { name: "Convex backend setup", status: "completed" },
      { name: "Authentication system", status: "completed" },
      { name: "Multi-tenant workspaces", status: "completed" },
      { name: "Webhook system", status: "completed" },
      { name: "Identity verification (HMAC)", status: "completed" },
      { name: "Rate limiting", status: "planned" },
    ],
  },
  {
    category: "Live Chat & Inbox",
    items: [
      { name: "Real-time messaging", status: "completed" },
      { name: "Shared team inbox", status: "completed" },
      { name: "Snooze & assignment", status: "completed" },
      { name: "File attachments", status: "completed" },
      { name: "Email channel (Resend)", status: "completed" },
      { name: "CSAT ratings", status: "completed" },
    ],
  },
  {
    category: "Chat Widget",
    items: [
      { name: "Embeddable widget", status: "completed" },
      { name: "6-tab layout (Home, Messages, Help, Tours, Tasks, Tickets)", status: "completed" },
      { name: "Widget customization & branding", status: "completed" },
      { name: "Outbound chat, post & banner", status: "completed" },
      { name: "Survey overlays", status: "completed" },
      { name: "Tour rendering", status: "completed" },
    ],
  },
  {
    category: "Product Tours",
    items: [
      { name: "Tour builder UI", status: "completed" },
      { name: "Pointer & post steps", status: "completed" },
      { name: "Tooltips (hover & beacon)", status: "completed" },
      { name: "Draft/active management", status: "completed" },
      { name: "Video steps", status: "in-progress" },
      { name: "Tour analytics", status: "planned" },
    ],
  },
  {
    category: "Knowledge Hub",
    items: [
      { name: "Article management with folders", status: "completed" },
      { name: "Saved reply snippets", status: "completed" },
      { name: "Full-text search & filters", status: "completed" },
      { name: "Internal & public articles", status: "completed" },
      { name: "AI article suggestions", status: "completed" },
      { name: "Article feedback", status: "in-progress" },
    ],
  },
  {
    category: "Outbound Messages",
    items: [
      { name: "In-app chat messages", status: "completed" },
      { name: "Post announcements", status: "completed" },
      { name: "Banner notifications", status: "completed" },
      { name: "Targeting & scheduling", status: "completed" },
      { name: "A/B testing", status: "planned" },
    ],
  },
  {
    category: "Tickets & Support",
    items: [
      { name: "Ticket creation & management", status: "completed" },
      { name: "Priority levels & statuses", status: "completed" },
      { name: "Custom ticket forms", status: "completed" },
      { name: "Widget ticket submission", status: "completed" },
      { name: "SLA tracking", status: "planned" },
    ],
  },
  {
    category: "Surveys",
    items: [
      { name: "NPS surveys", status: "completed" },
      { name: "Custom satisfaction surveys", status: "completed" },
      { name: "Small & large formats", status: "completed" },
      { name: "Survey analytics", status: "in-progress" },
    ],
  },
  {
    category: "Campaigns & Series",
    items: [
      { name: "Email campaigns", status: "completed" },
      { name: "Push notifications", status: "completed" },
      { name: "Carousel messages", status: "completed" },
      { name: "Campaign series", status: "completed" },
      { name: "Advanced audience targeting", status: "in-progress" },
    ],
  },
  {
    category: "Checklists",
    items: [
      { name: "Multi-step onboarding checklists", status: "completed" },
      { name: "Task completion tracking", status: "completed" },
      { name: "Widget integration", status: "completed" },
      { name: "Conditional task logic", status: "planned" },
    ],
  },
  {
    category: "AI & Automation",
    items: [
      { name: "AI Agent with knowledge base", status: "completed" },
      { name: "Confidence scoring & handoff", status: "completed" },
      { name: "OpenAI & Anthropic support", status: "completed" },
      { name: "AI article suggestions", status: "completed" },
      { name: "Custom AI training", status: "planned" },
    ],
  },
  {
    category: "Reports & Segments",
    items: [
      { name: "Conversation volume metrics", status: "completed" },
      { name: "Response & resolution times", status: "completed" },
      { name: "CSAT & team performance", status: "completed" },
      { name: "AI Agent performance", status: "completed" },
      { name: "Dynamic user segments", status: "completed" },
      { name: "Custom dashboards", status: "planned" },
    ],
  },
  {
    category: "SDKs & Mobile",
    items: [
      { name: "React Native SDK", status: "completed" },
      { name: "iOS SDK (Swift)", status: "planned" },
      { name: "Android SDK (Kotlin)", status: "planned" },
      { name: "Mobile admin app (Expo)", status: "completed" },
      { name: "Carousel support in SDKs", status: "completed" },
    ],
  },
  {
    category: "Developer Experience",
    items: [
      { name: "E2E tests (Playwright)", status: "completed" },
      { name: "Backend tests (Convex)", status: "completed" },
      { name: "Screenshot automation", status: "completed" },
      { name: "Landing website", status: "completed" },
      { name: "Self-hosted deployment guide", status: "in-progress" },
      { name: "Plugin / extension system", status: "planned" },
    ],
  },
];

const statusStyles: Record<FeatureStatus, string> = {
  completed: "text-emerald-500",
  "in-progress": "text-amber-500",
  planned: "text-muted-foreground",
};

const StatusIcon = ({ status }: { status: FeatureStatus }) => {
  switch (status) {
    case "completed":
      return <CheckCircle className={cn("h-4 w-4", statusStyles.completed)} />;
    case "in-progress":
      return <Clock className={cn("h-4 w-4", statusStyles["in-progress"])} />;
    case "planned":
      return <Circle className={cn("h-4 w-4", statusStyles.planned)} />;
  }
};

export default function RoadmapPage() {
  const completedCount = roadmap.reduce(
    (acc, cat) => acc + cat.items.filter((i) => i.status === "completed").length,
    0
  );
  const inProgressCount = roadmap.reduce(
    (acc, cat) => acc + cat.items.filter((i) => i.status === "in-progress").length,
    0
  );
  const plannedCount = roadmap.reduce(
    (acc, cat) => acc + cat.items.filter((i) => i.status === "planned").length,
    0
  );
  const totalCount = completedCount + inProgressCount + plannedCount;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <>
      <Section className="pt-24">
        <SectionHeader
          badge="Roadmap"
          title="What we are building next"
          description="Track our progress as we ship toward complete customer messaging coverage with strong developer ergonomics."
        />

        <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/85 p-8 shadow-[0_30px_70px_-40px_rgba(15,23,42,0.6)] backdrop-blur md:p-10 dark:border-white/10 dark:bg-card/85">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Delivery Progress
              </div>
              <p className="text-sm text-muted-foreground">
                {completedCount} completed of {totalCount} tracked roadmap items.
              </p>
            </div>
            <span className="text-3xl font-bold tracking-tight text-foreground">
              {progressPercent}%
            </span>
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-2 text-sm">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              Completed: {completedCount}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-2 text-sm">
              <Clock className="h-4 w-4 text-amber-500" />
              In progress: {inProgressCount}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-2 text-sm">
              <Circle className="h-4 w-4 text-muted-foreground" />
              Planned: {plannedCount}
            </div>
          </div>
        </div>
      </Section>

      <Section className="bg-[#f9fafb] dark:bg-muted/10">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {roadmap.map((category) => (
            <section
              key={category.category}
              className="rounded-[1.6rem] border border-slate-200/80 bg-white/85 p-6 shadow-[0_18px_35px_-25px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-card/85"
            >
              <h3 className="mb-4 text-lg font-semibold tracking-tight">{category.category}</h3>
              <ul className="space-y-3">
                {category.items.map((item) => (
                  <li key={item.name} className="flex items-start gap-3">
                    <StatusIcon status={item.status} />
                    <span
                      className={cn(
                        "text-sm leading-relaxed",
                        item.status === "completed" ? "text-muted-foreground" : "text-foreground"
                      )}
                    >
                      {item.name}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Want to help ship faster?</h2>
          <p className="mt-3 text-muted-foreground">
            Check open issues and milestones to collaborate on the next wave of features.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="https://github.com/opencom-org/opencom/issues"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              View Issues
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
            <a
              href="https://github.com/opencom-org/opencom/milestones"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
            >
              View Milestones
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </div>
        </div>
      </Section>
    </>
  );
}
