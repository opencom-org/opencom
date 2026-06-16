"use client";

import { useState } from "react";
import { Card } from "@opencom/ui";
import { Webhook } from "lucide-react";
import type { Id } from "@opencom/convex/dataModel";
import { useAutomationApiConvex } from "./hooks/useAutomationApiConvex";
import { CredentialsPanel } from "./automation-api/CredentialsPanel";
import { WebhooksPanel } from "./automation-api/WebhooksPanel";
import { DeliveryLogPanel } from "./automation-api/DeliveryLogPanel";

type Tab = "keys" | "webhooks" | "deliveries";

export function AutomationApiSection({
  workspaceId,
}: {
  workspaceId?: Id<"workspaces">;
}): React.JSX.Element | null {
  const [activeTab, setActiveTab] = useState<Tab>("keys");
  const api = useAutomationApiConvex(workspaceId);

  if (!workspaceId) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: "keys", label: "API Keys" },
    { id: "webhooks", label: "Webhooks" },
    { id: "deliveries", label: "Delivery Log" },
  ];

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Webhook className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Automation API</h2>
      </div>

      <div className="flex gap-1 mb-4 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "keys" && (
        <CredentialsPanel workspaceId={workspaceId} api={api} />
      )}
      {activeTab === "webhooks" && (
        <WebhooksPanel workspaceId={workspaceId} api={api} />
      )}
      {activeTab === "deliveries" && (
        <DeliveryLogPanel workspaceId={workspaceId} api={api} />
      )}
    </Card>
  );
}
