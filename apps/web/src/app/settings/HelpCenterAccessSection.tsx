"use client";

import { Button, Card } from "@opencom/ui";
import { Globe } from "lucide-react";

interface HelpCenterAccessSectionProps {
  policy: "public" | "restricted";
  setPolicy: (policy: "public" | "restricted") => void;
  isSaving: boolean;
  onSave: () => Promise<void>;
}

export function HelpCenterAccessSection({
  policy,
  setPolicy,
  isSaving,
  onSave,
}: HelpCenterAccessSectionProps): React.JSX.Element {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Help Center Access</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Control whether unauthenticated visitors can browse your public Help Center routes.
      </p>

      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPolicy("public")}
            className={`flex-1 px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
              policy === "public"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted border-input"
            }`}
          >
            Public
          </button>
          <button
            type="button"
            onClick={() => setPolicy("restricted")}
            className={`flex-1 px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
              policy === "restricted"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted border-input"
            }`}
          >
            Restricted
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          {policy === "public"
            ? "Anyone with the link can browse published help collections and articles."
            : "Only authenticated workspace members can access help content routes."}
        </p>

        <Button onClick={() => void onSave()} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Access Policy"}
        </Button>
      </div>
    </Card>
  );
}
