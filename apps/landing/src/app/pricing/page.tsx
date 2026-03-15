import type { Metadata } from "next";
import { PricingCard } from "@/components/pricing/PricingCard";
import { FeatureComparison } from "@/components/pricing/FeatureComparison";
import { SelfHostCallout } from "@/components/pricing/SelfHostCallout";
import { OPENCOM_HOSTED_ONBOARDING_URL } from "@/lib/links";

export const metadata: Metadata = {
  title: "Pricing | Opencom",
  description:
    "Simple, transparent pricing for Opencom hosted service. Starter at $15/mo, Pro at $45/mo. Full open-source product available to self-host for free.",
  openGraph: {
    title: "Pricing | Opencom",
    description:
      "Simple, transparent pricing. Starter at $15/mo, Pro at $45/mo. Or self-host for free — full product, no limits.",
    type: "website",
  },
};

const STARTER_FEATURES = [
  { text: "Up to 3 seats (all roles)", included: true },
  { text: "Full product: inbox, help center, tickets, tours, and more", included: true },
  { text: "10,000 emails/month included (all types)", included: true },
  { text: "Conversation reply emails", included: true },
  { text: "Reports & analytics", included: true },
  { text: "Data export", included: true },
  { text: "AI agent", included: false },
  { text: "Email campaigns", included: false },
  { text: "Automated series", included: false },
];

const PRO_FEATURES = [
  { text: "Up to 10 seats + PAYG beyond", included: true },
  { text: "Everything in Starter", included: true },
  { text: "AI agent enabled", included: true },
  { text: "$20/month in AI credits included", included: true },
  { text: "Email campaigns", included: true },
  { text: "Automated series", included: true },
  { text: "10,000 emails/month + PAYG beyond", included: true },
  { text: "PAYG for seats, AI, and emails", included: true },
  { text: "Configurable hard caps per dimension", included: true },
];

export default function PricingPage() {
  return (
    <div className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Cost-reflective pricing that covers infrastructure without creating artificial limits.
            7-day free trial — no credit card required.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Prices at USD/GBP nominal parity. Stripe handles currency at checkout.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-2">
          <PricingCard
            name="Starter"
            priceUSD="$15"
            priceGBP="£15"
            description="For small teams that need the full support product without AI or bulk email."
            features={STARTER_FEATURES}
            cta={{
              text: "Start free trial",
              href: OPENCOM_HOSTED_ONBOARDING_URL,
              variant: "outline",
            }}
          />
          <PricingCard
            name="Pro"
            priceUSD="$45"
            priceGBP="£45"
            description="For teams that need AI, campaigns, and series automation — with pay-as-you-go beyond limits."
            features={PRO_FEATURES}
            cta={{
              text: "Start free trial",
              href: OPENCOM_HOSTED_ONBOARDING_URL,
            }}
            highlighted={true}
            badge="Most popular"
          />
        </div>

        {/* Trial callout */}
        <div className="mx-auto mt-10 max-w-4xl">
          <div className="rounded-xl bg-muted/50 border border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">7-day free trial</strong> on the Pro tier, full
              access, no credit card required. At trial end, choose a plan or your workspace enters
              read-only mode. Your data is always safe and exportable.
            </p>
          </div>
        </div>

        {/* PAYG explanation */}
        <div className="mx-auto mt-16 max-w-4xl">
          <h2 className="text-2xl font-bold tracking-tight text-foreground text-center">
            Pay-as-you-go overages (Pro only)
          </h2>
          <p className="mt-4 text-center text-muted-foreground">
            On the Pro tier, usage beyond included limits is billed at cost. You control whether to
            allow overages or set hard caps.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold text-foreground">AI Credits</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                $20/mo included. Beyond that, billed at actual provider token rates via Vercel AI
                Gateway — no markup, pay what AI costs.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold text-foreground">Emails</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                10,000/mo included (all types). Beyond that, billed per email at cost-plus rate to
                cover Resend costs.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold text-foreground">Seats</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                10 seats included. Add more team members with PAYG billing per additional seat per
                month.
              </p>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Hard caps available: enable per-dimension caps to block overages entirely and stay
            within budget. Default: warnings at 80%/100%, PAYG continues.
          </p>
        </div>

        {/* Feature comparison */}
        <div className="mx-auto mt-16 max-w-4xl">
          <h2 className="text-2xl font-bold tracking-tight text-foreground text-center mb-8">
            Full feature comparison
          </h2>
          <FeatureComparison />
        </div>

        {/* Self-host callout */}
        <div className="mx-auto mt-16 max-w-4xl">
          <SelfHostCallout />
        </div>

        {/* FAQ / Notes */}
        <div className="mx-auto mt-16 max-w-2xl text-center">
          <p className="text-sm text-muted-foreground">
            All plans include full product access. Pricing differences reflect actual infrastructure
            costs (AI compute, email delivery), not artificial feature locks. Questions?{" "}
            <a
              href="/support"
              className="text-primary underline underline-offset-4 hover:no-underline"
            >
              Contact us
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
