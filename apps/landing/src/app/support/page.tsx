import type { Metadata } from "next";
import { Clock3, LifeBuoy, MessageCircle, MousePointerClick } from "lucide-react";
import { Screenshot, Section, SectionHeader } from "@/components/sections";
import { WidgetCtaPanel } from "@/components/support/widget-cta-panel";
import { createLandingPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = createLandingPageMetadata({
  title: "Support | Opencom",
  description:
    "Get Opencom support directly in the widget. Open Home or start a new chat from the support page.",
  path: "/support",
});

export default function SupportPage() {
  return (
    <>
      <Section className="pt-24">
        <SectionHeader
          badge="Support"
          title="Need help? Reach us through the widget."
          description="The fastest path to Opencom support is the widget launcher in the bottom-right corner of this page."
        />

        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-8 shadow-[0_24px_55px_-35px_rgba(15,23,42,0.6)] md:p-10 dark:border-white/10 dark:bg-card/85">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
              <LifeBuoy className="h-3.5 w-3.5" />
              Contact Support
            </div>

            <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Open the widget and send us a message
            </h2>

            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Start with Home for quick self-serve resources, or open a new chat for direct help
              from our team. The launcher always sits in the bottom-right corner.
            </p>

            <ul className="mt-7 space-y-4 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 rounded-md border border-primary/20 bg-primary/10 p-1 text-primary">
                  <MousePointerClick className="h-4 w-4" />
                </span>
                Click the launcher in the bottom-right to open support.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 rounded-md border border-primary/20 bg-primary/10 p-1 text-primary">
                  <MessageCircle className="h-4 w-4" />
                </span>
                Use the Messages tab to start a new chat with context from your current page.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 rounded-md border border-primary/20 bg-primary/10 p-1 text-primary">
                  <Clock3 className="h-4 w-4" />
                </span>
                Share issue details, expected behavior, and reproduction steps for a faster reply.
              </li>
            </ul>

            <div className="mt-8">
              <WidgetCtaPanel />
            </div>
          </div>

          <div className="space-y-6">
            <Screenshot src="/screenshots/widget-tab-home.png" alt="Opencom widget Home tab" />
            <Screenshot src="/screenshots/widget-outbound-chat.png" alt="Opencom widget chat view" />
          </div>
        </div>
      </Section>
    </>
  );
}
