import {
  MessageCircle,
  Map,
  BookOpen,
  Smartphone,
  Palette,
  Code2,
  Send,
  Ticket,
  ClipboardCheck,
  Mail,
  ListChecks,
  MousePointerClick,
  BarChart3,
  Users,
  Check,
  Sparkles,
} from "lucide-react";
import { Section, SectionHeader, FeatureCard, Screenshot, CTA } from "@/components/sections";
import { OPENCOM_GITHUB_DOCS_URL, OPENCOM_HOSTED_ONBOARDING_URL } from "@/lib/links";

const featureCategories = [
  {
    id: "chat",
    title: "Live Chat & Inbox",
    description:
      "Real-time customer conversations with a shared team inbox and embeddable chat widget.",
    icon: MessageCircle,
    screenshot: "/screenshots/web-inbox.png",
    features: [
      "Real-time messaging with typing indicators",
      "Shared team inbox with snooze and assignment",
      "Customizable appearance and branding",
      "Mobile-responsive widget with 6 tabs",
      "Offline message support",
      "Conversation history and search",
    ],
  },
  {
    id: "tours",
    title: "Product Tours",
    description: "Guide users through your product with interactive walkthroughs.",
    icon: Map,
    screenshot: "/screenshots/web-tours.png",
    features: [
      "Step-by-step guided tours",
      "Pointer steps and post steps",
      "Conditional triggers",
      "Analytics and completion tracking",
      "Draft and active states",
      "Duplicate and edit tours",
    ],
  },
  {
    id: "knowledge-base",
    title: "Knowledge Hub",
    description: "Self-service help center with searchable articles, snippets, and folders.",
    icon: BookOpen,
    screenshot: "/screenshots/web-knowledge.png",
    features: [
      "Article management with folders",
      "Saved reply snippets",
      "Full-text search and filters",
      "Rich text editor",
      "List and grid views",
      "Internal and public articles",
    ],
  },
  {
    id: "outbound",
    title: "Outbound Messages",
    description: "Proactively engage users with in-app chats, posts, and banners.",
    icon: Send,
    screenshot: "/screenshots/web-outbound.png",
    features: [
      "In-app chat messages",
      "Post announcements",
      "Banner notifications",
      "Draft and active states",
      "Targeting and scheduling",
      "Type and status filtering",
    ],
  },
  {
    id: "tickets",
    title: "Tickets",
    description: "Customer support ticketing with priorities, statuses, and custom forms.",
    icon: Ticket,
    screenshot: "/screenshots/web-tickets.png",
    features: [
      "Priority levels (Urgent, High, Normal, Low)",
      "Status tracking (Submitted, In Progress, Resolved)",
      "Custom ticket forms",
      "Customer and date attribution",
      "Search and filter",
      "Widget ticket submission",
    ],
  },
  {
    id: "surveys",
    title: "Surveys",
    description: "Collect feedback and measure customer sentiment.",
    icon: ClipboardCheck,
    screenshot: "/screenshots/web-surveys.png",
    features: [
      "NPS surveys",
      "Custom satisfaction surveys",
      "Small and large format options",
      "Draft and active states",
      "Question builder",
      "Duplicate and manage surveys",
    ],
  },
  {
    id: "campaigns",
    title: "Campaigns",
    description: "Orchestrate multi-channel outreach campaigns.",
    icon: Mail,
    screenshot: "/screenshots/web-campaigns.png",
    features: [
      "Email campaigns with templates",
      "Push notifications",
      "Carousel messages",
      "Campaign series",
      "Sent and draft status tracking",
      "Search and filter",
    ],
  },
  {
    id: "checklists",
    title: "Checklists",
    description: "Guide users through onboarding with task lists.",
    icon: ListChecks,
    screenshot: "/screenshots/web-checklists.png",
    features: [
      "Multi-step onboarding checklists",
      "Task completion tracking",
      "Draft and active states",
      "Customizable task counts",
      "Widget integration",
      "Duplicate and manage",
    ],
  },
  {
    id: "tooltips",
    title: "Tooltips",
    description: "Contextual hints attached to page elements.",
    icon: MousePointerClick,
    screenshot: "/screenshots/web-tooltips.png",
    features: [
      "On-hover tooltips",
      "Click-triggered beacons",
      "CSS selector targeting",
      "Customizable content",
      "Grid layout management",
      "Edit and delete controls",
    ],
  },
  {
    id: "reports",
    title: "Reports & Analytics",
    description: "Analytics and insights for your support operations.",
    icon: BarChart3,
    screenshot: "/screenshots/web-reports.png",
    features: [
      "Conversation volume metrics",
      "Response and resolution times",
      "Team performance tracking",
      "CSAT score monitoring",
      "AI Agent performance",
      "7, 30, and 90-day time ranges",
    ],
  },
];

const additionalFeatures = [
  {
    title: "Customization",
    description: "Full control over appearance, branding, and behavior to match your product.",
    icon: Palette,
  },
  {
    title: "Developer-Friendly",
    description: "Well-documented APIs, SDKs for React Native, iOS, Android, and Web.",
    icon: Code2,
  },
  {
    title: "User Segments",
    description: "Target specific user groups with custom segments and filters.",
    icon: Users,
  },
  {
    title: "Mobile Admin Apps",
    description: "Native iOS and Android apps to manage conversations on the go.",
    icon: Smartphone,
  },
];

export default function FeaturesPage() {
  return (
    <>
      <Section className="pt-24">
        <SectionHeader
          badge="Features"
          title="Intercom parity, plus quality-of-life upgrades"
          description="Opencom covers the core Intercom workflow surface while adding opinionated quality-of-life improvements for faster team operations."
        />
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-slate-200/80 bg-white/85 p-8 shadow-[0_30px_70px_-40px_rgba(15,23,42,0.6)] backdrop-blur md:p-10 dark:border-white/10 dark:bg-card/85">
          <div className="flex items-center gap-3 text-sm font-medium text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            Shipped fast, designed for operators
          </div>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground md:text-base">
            We are actively shipping toward full Intercom feature parity while improving day-to-day
            usability: clearer configuration flows, practical defaults, and tighter web + mobile
            admin workflows.
          </p>
        </div>
      </Section>

      {featureCategories.map((category, index) => (
        <Section
          key={category.id}
          id={category.id}
          className={index % 2 === 1 ? "bg-[#f9fafb] dark:bg-muted/10" : ""}
        >
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className={index % 2 === 1 ? "lg:order-2" : ""}>
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <category.icon className="h-6 w-6" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{category.title}</h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
                {category.description}
              </p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {category.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/60 px-4 py-3"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={index % 2 === 1 ? "lg:order-1" : ""}>
              <Screenshot src={category.screenshot} alt={`${category.title} screenshot`} />
            </div>
          </div>
        </Section>
      ))}

      <Section>
        <SectionHeader
          title="And more..."
          description="Additional features to help you deliver exceptional customer experiences."
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {additionalFeatures.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </Section>

      <CTA
        title="Ready to get started?"
        description="Start with hosted onboarding for a fast trial, then use GitHub docs as the canonical implementation reference."
        primaryAction={{ label: "Start Hosted Onboarding", href: OPENCOM_HOSTED_ONBOARDING_URL }}
        secondaryAction={{ label: "Read GitHub Docs", href: OPENCOM_GITHUB_DOCS_URL }}
      />
    </>
  );
}
