import { Check, X, Minus } from "lucide-react";

interface ComparisonRow {
  feature: string;
  starter: boolean | "partial" | string;
  pro: boolean | "partial" | string;
  description?: string;
}

const COMPARISON_ROWS: ComparisonRow[] = [
  // Core product
  { feature: "Conversations inbox", starter: true, pro: true },
  { feature: "Help center / articles", starter: true, pro: true },
  { feature: "Tickets", starter: true, pro: true },
  { feature: "Product tours", starter: true, pro: true },
  { feature: "Checklists", starter: true, pro: true },
  { feature: "Tooltips", starter: true, pro: true },
  { feature: "Carousels", starter: true, pro: true },
  { feature: "Outbound messages", starter: true, pro: true },
  { feature: "Surveys", starter: true, pro: true },
  { feature: "Reports & analytics", starter: true, pro: true },
  // Team
  { feature: "Seats", starter: "Up to 3", pro: "Up to 10 + PAYG" },
  // Email
  { feature: "Emails included/month", starter: "10,000", pro: "10,000 + PAYG" },
  { feature: "Conversation reply emails", starter: true, pro: true },
  { feature: "OTP / transactional emails", starter: true, pro: true },
  // Campaigns
  { feature: "Email campaigns", starter: false, pro: true },
  { feature: "Automated series", starter: false, pro: true },
  // AI
  { feature: "AI agent", starter: false, pro: true },
  { feature: "AI credits included", starter: false, pro: "$20/mo (PAYG beyond)" },
  // Platform
  {
    feature: "Configurable hard caps",
    starter: false,
    pro: true,
    description: "Prevent PAYG overages",
  },
  { feature: "Data export", starter: true, pro: true },
  { feature: "Custom integrations", starter: true, pro: true },
];

function CellIcon({ value }: { value: boolean | "partial" | string }) {
  if (value === true) {
    return <Check className="mx-auto h-4 w-4 text-primary" />;
  }
  if (value === false) {
    return <X className="mx-auto h-4 w-4 text-muted-foreground/50" />;
  }
  if (value === "partial") {
    return <Minus className="mx-auto h-4 w-4 text-muted-foreground" />;
  }
  return <span className="text-sm text-foreground">{value}</span>;
}

export function FeatureComparison() {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Feature</th>
            <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">Starter</th>
            <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">Pro</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {COMPARISON_ROWS.map((row, i) => (
            <tr key={i} className="hover:bg-muted/20 transition-colors">
              <td className="px-6 py-3">
                <div className="text-sm text-foreground">{row.feature}</div>
                {row.description && (
                  <div className="text-xs text-muted-foreground">{row.description}</div>
                )}
              </td>
              <td className="px-6 py-3 text-center">
                <CellIcon value={row.starter} />
              </td>
              <td className="px-6 py-3 text-center">
                <CellIcon value={row.pro} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
