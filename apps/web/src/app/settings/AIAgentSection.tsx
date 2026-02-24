"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { Button, Card, Input } from "@opencom/ui";
import { AlertTriangle, Bot } from "lucide-react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";

export function AIAgentSection({
  workspaceId,
}: {
  workspaceId?: Id<"workspaces">;
}): React.JSX.Element | null {
  const aiSettings = useQuery(api.aiAgent.getSettings, workspaceId ? { workspaceId } : "skip");

  const availableModels = useQuery(api.aiAgent.listAvailableModels, {});

  const updateSettings = useMutation(api.aiAgent.updateSettings);

  const [enabled, setEnabled] = useState(false);
  const [model, setModel] = useState("openai/gpt-5-nano");
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.6);
  const [knowledgeSources, setKnowledgeSources] = useState<string[]>(["articles"]);
  const [personality, setPersonality] = useState("");
  const [handoffMessage, setHandoffMessage] = useState("");
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(false);
  const [embeddingModel, setEmbeddingModel] = useState("text-embedding-3-small");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (aiSettings) {
      setEnabled(aiSettings.enabled);
      setModel(aiSettings.model);
      setConfidenceThreshold(aiSettings.confidenceThreshold);
      setKnowledgeSources(aiSettings.knowledgeSources as string[]);
      setPersonality(aiSettings.personality ?? "");
      setHandoffMessage(aiSettings.handoffMessage ?? "");
      setSuggestionsEnabled(aiSettings.suggestionsEnabled ?? false);
      setEmbeddingModel(aiSettings.embeddingModel ?? "text-embedding-3-small");
    }
  }, [aiSettings]);

  const handleSave = async () => {
    if (!workspaceId) return;
    setIsSaving(true);
    try {
      await updateSettings({
        workspaceId,
        enabled,
        model,
        confidenceThreshold,
        knowledgeSources: knowledgeSources as ("articles" | "internalArticles" | "snippets")[],
        personality: personality || undefined,
        handoffMessage: handoffMessage || undefined,
        suggestionsEnabled,
        embeddingModel,
      });
    } catch (error) {
      console.error("Failed to save AI settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleKnowledgeSource = (source: string) => {
    if (knowledgeSources.includes(source)) {
      setKnowledgeSources(knowledgeSources.filter((s) => s !== source));
    } else {
      setKnowledgeSources([...knowledgeSources, source]);
    }
  };

  if (!workspaceId) return null;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Bot className="h-5 w-5" />
        <h2 className="text-lg font-semibold">AI Agent</h2>
        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Beta</span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Enable an AI-powered agent to automatically respond to customer messages using your
        knowledge base.
      </p>

      {aiSettings?.lastConfigError && (
        <div
          className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900"
          data-testid="ai-config-diagnostic"
        >
          <p className="text-sm font-medium flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Runtime configuration issue detected
          </p>
          <p className="mt-1 text-sm">{aiSettings.lastConfigError.message}</p>
          <p className="mt-1 text-xs text-amber-800/80">
            Code: {aiSettings.lastConfigError.code}
            {aiSettings.lastConfigError.provider
              ? ` • Provider: ${aiSettings.lastConfigError.provider}`
              : ""}
            {aiSettings.lastConfigError.model
              ? ` • Model: ${aiSettings.lastConfigError.model}`
              : ""}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div>
            <p className="font-medium">Enable AI Agent</p>
            <p className="text-sm text-muted-foreground">
              Automatically respond to visitor messages
            </p>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? "bg-primary" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {enabled && (
          <>
            {/* Model Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">AI Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              >
                {availableModels?.map((m: NonNullable<typeof availableModels>[number]) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.provider})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Choose the AI model for generating responses.
              </p>
            </div>

            {/* Knowledge Sources */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Knowledge Sources</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "articles", label: "Help Articles" },
                  { id: "internalArticles", label: "Internal Docs" },
                  { id: "snippets", label: "Snippets" },
                ].map((source) => (
                  <button
                    key={source.id}
                    onClick={() => toggleKnowledgeSource(source.id)}
                    className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                      knowledgeSources.includes(source.id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    {source.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Select which content sources the AI can use to answer questions.
              </p>
            </div>

            {/* Confidence Threshold */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Confidence Threshold: {Math.round(confidenceThreshold * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={confidenceThreshold * 100}
                onChange={(e) => setConfidenceThreshold(Number(e.target.value) / 100)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Hand off to human agents when AI confidence is below this threshold.
              </p>
            </div>

            {/* Personality */}
            <div className="space-y-2">
              <label className="text-sm font-medium">AI Personality (Optional)</label>
              <textarea
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder="e.g., Be friendly and professional. Use simple language."
                className="w-full px-3 py-2 border rounded-md text-sm min-h-[60px] bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Customize how the AI communicates with customers.
              </p>
            </div>

            {/* Handoff Message */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Handoff Message</label>
              <Input
                value={handoffMessage}
                onChange={(e) => setHandoffMessage(e.target.value)}
                placeholder="Let me connect you with a human agent..."
              />
              <p className="text-xs text-muted-foreground">
                Message shown when transferring to a human agent.
              </p>
            </div>

            {/* AI Suggestions */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">AI Article Suggestions</p>
                  <p className="text-sm text-muted-foreground">
                    Show AI-powered content suggestions in the inbox
                  </p>
                </div>
                <button
                  onClick={() => setSuggestionsEnabled(!suggestionsEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    suggestionsEnabled ? "bg-primary" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      suggestionsEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {suggestionsEnabled && (
                <div className="mt-3 space-y-2">
                  <label className="text-sm font-medium">Embedding Model</label>
                  <select
                    value={embeddingModel}
                    onChange={(e) => setEmbeddingModel(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                  >
                    <option value="text-embedding-3-small">
                      text-embedding-3-small (Recommended)
                    </option>
                    <option value="text-embedding-3-large">
                      text-embedding-3-large (Higher quality)
                    </option>
                    <option value="text-embedding-ada-002">text-embedding-ada-002 (Legacy)</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Model used for generating content embeddings for semantic search.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save AI Settings"}
        </Button>
      </div>
    </Card>
  );
}
