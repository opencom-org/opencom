"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { Button, Card } from "@opencom/ui";
import { Zap } from "lucide-react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";

export function AutomationSettingsSection({
  workspaceId,
}: {
  workspaceId?: Id<"workspaces">;
}): React.JSX.Element | null {
  const automationSettings = useQuery(
    api.automationSettings.get,
    workspaceId ? { workspaceId } : "skip"
  );

  const upsertSettings = useMutation(api.automationSettings.upsert);

  const [suggestArticlesEnabled, setSuggestArticlesEnabled] = useState(false);
  const [showReplyTimeEnabled, setShowReplyTimeEnabled] = useState(false);
  const [collectEmailEnabled, setCollectEmailEnabled] = useState(false);
  const [askForRatingEnabled, setAskForRatingEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (automationSettings) {
      setSuggestArticlesEnabled(automationSettings.suggestArticlesEnabled);
      setShowReplyTimeEnabled(automationSettings.showReplyTimeEnabled);
      setCollectEmailEnabled(automationSettings.collectEmailEnabled);
      setAskForRatingEnabled(automationSettings.askForRatingEnabled);
    }
  }, [automationSettings]);

  const handleSave = async () => {
    if (!workspaceId) return;
    setIsSaving(true);
    try {
      await upsertSettings({
        workspaceId,
        suggestArticlesEnabled,
        showReplyTimeEnabled,
        collectEmailEnabled,
        askForRatingEnabled,
      });
    } catch (error) {
      console.error("Failed to save automation settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!workspaceId) return null;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Automation & Self-Serve</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Configure automated features to help visitors find answers faster and streamline your
        workflow.
      </p>

      <div className="space-y-4">
        {/* Suggest Articles Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div>
            <p className="font-medium">Suggest Articles</p>
            <p className="text-sm text-muted-foreground">
              Show relevant help articles as visitors type their message
            </p>
          </div>
          <button
            onClick={() => setSuggestArticlesEnabled(!suggestArticlesEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              suggestArticlesEnabled ? "bg-primary" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                suggestArticlesEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Show Reply Time Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div>
            <p className="font-medium">Show Reply Time</p>
            <p className="text-sm text-muted-foreground">
              Display expected reply time based on office hours
            </p>
          </div>
          <button
            onClick={() => setShowReplyTimeEnabled(!showReplyTimeEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              showReplyTimeEnabled ? "bg-primary" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                showReplyTimeEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Collect Email Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div>
            <p className="font-medium">Collect Email</p>
            <p className="text-sm text-muted-foreground">
              Prompt anonymous visitors to provide their email address
            </p>
          </div>
          <button
            onClick={() => setCollectEmailEnabled(!collectEmailEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              collectEmailEnabled ? "bg-primary" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                collectEmailEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Ask for Rating Toggle */}
        <div
          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
          data-testid="settings-ask-for-rating-row"
        >
          <div>
            <p className="font-medium">Ask for Rating</p>
            <p className="text-sm text-muted-foreground">
              Request CSAT rating when conversations are closed
            </p>
          </div>
          <button
            onClick={() => setAskForRatingEnabled(!askForRatingEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              askForRatingEnabled ? "bg-primary" : "bg-gray-300"
            }`}
            data-testid="settings-ask-for-rating-toggle"
            type="button"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                askForRatingEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full"
          data-testid="settings-automation-save"
        >
          {isSaving ? "Saving..." : "Save Automation Settings"}
        </Button>
      </div>
    </Card>
  );
}
