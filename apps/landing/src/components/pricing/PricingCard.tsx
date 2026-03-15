import { Check, X } from "lucide-react";
import { buttonVariants } from "@opencom/ui";

export interface PricingFeature {
  text: string;
  included: boolean;
}

export interface PricingCardProps {
  name: string;
  priceUSD: string;
  priceGBP: string;
  period?: string;
  description: string;
  features: PricingFeature[];
  cta: {
    text: string;
    href: string;
    variant?: "default" | "outline";
  };
  highlighted?: boolean;
  badge?: string;
}

export function PricingCard({
  name,
  priceUSD,
  priceGBP,
  period = "/month",
  description,
  features,
  cta,
  highlighted = false,
  badge,
}: PricingCardProps) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-8 shadow-sm transition-shadow hover:shadow-md ${
        highlighted
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-card-foreground"
      }`}
    >
      {badge && (
        <div
          className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold ${
            highlighted ? "bg-background text-foreground" : "bg-primary text-primary-foreground"
          }`}
        >
          {badge}
        </div>
      )}

      <div className="mb-6">
        <h3
          className={`text-lg font-semibold ${highlighted ? "text-primary-foreground" : "text-foreground"}`}
        >
          {name}
        </h3>
        <div className="mt-4 flex items-baseline gap-1">
          <span
            className={`text-4xl font-bold tracking-tight ${highlighted ? "text-primary-foreground" : "text-foreground"}`}
          >
            {priceUSD}
          </span>
          <span
            className={`text-sm ${highlighted ? "text-primary-foreground/70" : "text-muted-foreground"}`}
          >
            USD{period}
          </span>
        </div>
        <div
          className={`mt-1 text-sm ${highlighted ? "text-primary-foreground/70" : "text-muted-foreground"}`}
        >
          {priceGBP} GBP{period}
        </div>
        <p
          className={`mt-3 text-sm ${highlighted ? "text-primary-foreground/80" : "text-muted-foreground"}`}
        >
          {description}
        </p>
      </div>

      <ul className="mb-8 flex-1 space-y-3">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {feature.included ? (
                <Check
                  className={`h-4 w-4 ${highlighted ? "text-primary-foreground" : "text-primary"}`}
                />
              ) : (
                <X
                  className={`h-4 w-4 ${highlighted ? "text-primary-foreground/50" : "text-muted-foreground/50"}`}
                />
              )}
            </div>
            <span
              className={`text-sm ${
                feature.included
                  ? highlighted
                    ? "text-primary-foreground"
                    : "text-foreground"
                  : highlighted
                    ? "text-primary-foreground/50"
                    : "text-muted-foreground"
              }`}
            >
              {feature.text}
            </span>
          </li>
        ))}
      </ul>

      <a
        href={cta.href}
        className={buttonVariants({
          variant: cta.variant ?? (highlighted ? "secondary" : "default"),
          className: "w-full justify-center",
        })}
      >
        {cta.text}
      </a>
    </div>
  );
}
