"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { Button, Input } from "@opencom/ui";
import {
  ArrowLeft,
  Save,
  Play,
  Pause,
  Plus,
  Trash2,
  GripVertical,
  MousePointer,
  MessageSquare,
  Video,
  Settings,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import type { Id } from "@opencom/convex/dataModel";
import { AudienceRuleBuilder, type AudienceRule } from "@/components/AudienceRuleBuilder";
import { scoreSelectorQuality } from "@opencom/sdk-core";

type StepType = "pointer" | "post" | "video";
type Position = "auto" | "left" | "right" | "above" | "below";
type Size = "small" | "large";
type AdvanceOn = "click" | "elementClick" | "fieldFill";

interface StepFormData {
  type: StepType;
  title: string;
  content: string;
  elementSelector: string;
  routePath: string;
  position: Position;
  size: Size;
  advanceOn: AdvanceOn;
  customButtonText: string;
  mediaUrl: string;
  mediaType: "image" | "video" | "";
}

const defaultStepData: StepFormData = {
  type: "pointer",
  title: "",
  content: "",
  elementSelector: "",
  routePath: "",
  position: "auto",
  size: "small",
  advanceOn: "click",
  customButtonText: "",
  mediaUrl: "",
  mediaType: "",
};

function parseRouteForComparison(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return trimmed;
  }
}

function getRouteConsistencyWarning(stepRoute: string, baseRoute: string): string | null {
  const normalizedStepRoute = parseRouteForComparison(stepRoute);
  const normalizedBaseRoute = parseRouteForComparison(baseRoute);
  if (!normalizedStepRoute || !normalizedBaseRoute) {
    return null;
  }
  if (normalizedStepRoute === normalizedBaseRoute) {
    return null;
  }
  return "This step targets a different route than the tour default. Ensure your flow navigates here before this step.";
}

function getFragileSelectorWarnings(selector: string): string[] {
  if (!selector.trim()) return [];
  const quality = scoreSelectorQuality(selector);
  return quality.grade === "poor" ? quality.warnings : [];
}

export default function TourEditorPage() {
  const params = useParams();
  const tourId = params.id as Id<"tours">;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetingPageUrl, setTargetingPageUrl] = useState("");
  const [displayMode, setDisplayMode] = useState<"first_time_only" | "until_dismissed">(
    "first_time_only"
  );
  const [priority, setPriority] = useState(0);
  const [buttonColor, setButtonColor] = useState("#792cd4");
  const [showConfetti, setShowConfetti] = useState(true);
  const [allowSnooze, setAllowSnooze] = useState(true);
  const [allowRestart, setAllowRestart] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<"steps" | "settings">("steps");
  const [editingStepId, setEditingStepId] = useState<Id<"tourSteps"> | null>(null);
  const [stepFormData, setStepFormData] = useState<StepFormData>(defaultStepData);
  const [isStepModalOpen, setIsStepModalOpen] = useState(false);
  const [audienceRules, setAudienceRules] = useState<AudienceRule | null>(null);

  const selectorQuality = useMemo(
    () =>
      stepFormData.elementSelector.trim()
        ? scoreSelectorQuality(stepFormData.elementSelector)
        : null,
    [stepFormData.elementSelector]
  );
  const fragileSelectorWarnings = useMemo(
    () => getFragileSelectorWarnings(stepFormData.elementSelector),
    [stepFormData.elementSelector]
  );
  const routeConsistencyWarning = useMemo(
    () => getRouteConsistencyWarning(stepFormData.routePath, targetingPageUrl),
    [stepFormData.routePath, targetingPageUrl]
  );

  const { user, isLoading: authLoading } = useAuth();
  const canQueryTourData = !authLoading && !!user;

  const tour = useQuery(api.tours.get, canQueryTourData ? { id: tourId } : "skip");
  const steps = useQuery(api.tourSteps.list, canQueryTourData ? { tourId } : "skip");
  const eventNames = useQuery(
    api.events.getDistinctNames,
    canQueryTourData && tour?.workspaceId ? { workspaceId: tour.workspaceId } : "skip"
  );

  const updateTour = useMutation(api.tours.update);
  const activateTour = useMutation(api.tours.activate);
  const deactivateTour = useMutation(api.tours.deactivate);
  const createStep = useMutation(api.tourSteps.create);
  const updateStep = useMutation(api.tourSteps.update);
  const deleteStep = useMutation(api.tourSteps.remove);
  const reorderSteps = useMutation(api.tourSteps.reorder);
  const createAuthoringSession = useMutation(api.authoringSessions.create);

  useEffect(() => {
    if (tour) {
      setName(tour.name);
      setDescription(tour.description || "");
      setTargetingPageUrl(tour.targetingRules?.pageUrl || "");
      setDisplayMode(tour.displayMode ?? "first_time_only");
      setPriority(tour.priority ?? 0);
      setButtonColor(tour.buttonColor || "#792cd4");
      setShowConfetti(tour.showConfetti ?? true);
      setAllowSnooze(tour.allowSnooze ?? true);
      setAllowRestart(tour.allowRestart ?? true);
      setAudienceRules((tour.audienceRules as AudienceRule | null) ?? null);
    }
  }, [tour]);

  const handleSave = async () => {
    if (!tourId) return;
    setIsSaving(true);
    try {
      await updateTour({
        id: tourId,
        name,
        description: description || undefined,
        targetingRules: targetingPageUrl ? { pageUrl: targetingPageUrl } : undefined,
        audienceRules: audienceRules ?? undefined,
        displayMode,
        priority,
        buttonColor,
        showConfetti,
        allowSnooze,
        allowRestart,
      });
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save tour:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!tour) return;
    if (tour.status === "active") {
      await deactivateTour({ id: tourId });
    } else {
      await activateTour({ id: tourId });
    }
  };

  const handleOpenStepModal = (step?: NonNullable<typeof steps>[number]) => {
    if (step) {
      setEditingStepId(step._id);
      setStepFormData({
        type: step.type,
        title: step.title || "",
        content: step.content,
        elementSelector: step.elementSelector || "",
        routePath: step.routePath || "",
        position: step.position || "auto",
        size: step.size || "small",
        advanceOn: step.advanceOn || "click",
        customButtonText: step.customButtonText || "",
        mediaUrl: step.mediaUrl || "",
        mediaType: step.mediaType || "",
      });
    } else {
      setEditingStepId(null);
      setStepFormData(defaultStepData);
    }
    setIsStepModalOpen(true);
  };

  const handleCloseStepModal = () => {
    setIsStepModalOpen(false);
    setEditingStepId(null);
    setStepFormData(defaultStepData);
  };

  const handleSaveStep = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedSelector = stepFormData.elementSelector.trim();
    const normalizedRoutePath = stepFormData.routePath.trim();
    const requiresSelector =
      stepFormData.type === "pointer" ||
      stepFormData.type === "video" ||
      stepFormData.advanceOn === "elementClick" ||
      stepFormData.advanceOn === "fieldFill";

    if (requiresSelector && !normalizedSelector) {
      alert("This step requires an element selector.");
      return;
    }

    const nextSelectorQuality = normalizedSelector
      ? scoreSelectorQuality(normalizedSelector)
      : undefined;

    try {
      if (editingStepId) {
        await updateStep({
          id: editingStepId,
          type: stepFormData.type,
          title: stepFormData.title || undefined,
          content: stepFormData.content,
          elementSelector: normalizedSelector || undefined,
          routePath: normalizedRoutePath,
          selectorQuality: nextSelectorQuality,
          position: stepFormData.position,
          size: stepFormData.size,
          advanceOn: stepFormData.advanceOn,
          customButtonText: stepFormData.customButtonText || undefined,
          mediaUrl: stepFormData.mediaUrl || undefined,
          mediaType: stepFormData.mediaType || undefined,
        });
      } else {
        await createStep({
          tourId,
          type: stepFormData.type,
          title: stepFormData.title || undefined,
          content: stepFormData.content,
          elementSelector: normalizedSelector || undefined,
          routePath: normalizedRoutePath || undefined,
          selectorQuality: nextSelectorQuality,
          position: stepFormData.position,
          size: stepFormData.size,
          advanceOn: stepFormData.advanceOn,
          customButtonText: stepFormData.customButtonText || undefined,
          mediaUrl: stepFormData.mediaUrl || undefined,
          mediaType: stepFormData.mediaType || undefined,
        });
      }
      handleCloseStepModal();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save step");
    }
  };

  const handleDeleteStep = async (stepId: Id<"tourSteps">) => {
    if (confirm("Are you sure you want to delete this step?")) {
      await deleteStep({ id: stepId });
    }
  };

  const handleMoveStep = async (stepId: Id<"tourSteps">, direction: "up" | "down") => {
    if (!steps) return;
    const currentIndex = steps.findIndex(
      (s: NonNullable<typeof steps>[number]) => s._id === stepId
    );
    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;

    const newOrder = [...steps.map((s: NonNullable<typeof steps>[number]) => s._id)];
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];

    await reorderSteps({ tourId, stepIds: newOrder });
  };

  const handleEditOnSite = async (stepId?: Id<"tourSteps">) => {
    if (!user || !targetingPageUrl) {
      alert("Please set a target page URL in Settings first");
      setActiveTab("settings");
      return;
    }

    try {
      const { token } = await createAuthoringSession({
        tourId,
        stepId,
        targetUrl: targetingPageUrl,
      });

      const separator = targetingPageUrl.includes("?") ? "&" : "?";
      const authoringUrl = `${targetingPageUrl}${separator}opencom_authoring=${token}`;
      window.open(authoringUrl, "_blank");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to start authoring session");
    }
  };

  const getStepIcon = (type: StepType) => {
    switch (type) {
      case "pointer":
        return <MousePointer className="h-4 w-4" />;
      case "post":
        return <MessageSquare className="h-4 w-4" />;
      case "video":
        return <Video className="h-4 w-4" />;
    }
  };

  if (!tour) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/tours">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  tour.status === "active"
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {tour.status}
              </span>
              {hasChanges && <span className="text-sm text-orange-600">Unsaved changes</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleToggleStatus}>
              {tour.status === "active" ? (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Deactivate
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Activate
                </>
              )}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving || !hasChanges}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="bg-white rounded-lg border p-6 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tour Name</label>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="Welcome Tour"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <Input
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="A brief description of this tour"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <Button
            variant={activeTab === "steps" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("steps")}
          >
            Steps ({steps?.length || 0})
          </Button>
          <Button
            variant={activeTab === "settings" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("settings")}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>

        {activeTab === "steps" && (
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-medium">Tour Steps</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleEditOnSite()}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Edit on Site
                </Button>
                <Button size="sm" onClick={() => handleOpenStepModal()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Step
                </Button>
              </div>
            </div>

            {steps?.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MousePointer className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>No steps yet. Add your first step to get started.</p>
              </div>
            ) : (
              <div className="divide-y">
                {steps?.map((step: NonNullable<typeof steps>[number], index: number) => (
                  <div key={step._id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleMoveStep(step._id, "up")}
                        disabled={index === 0}
                        className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                      >
                        <GripVertical className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      {getStepIcon(step.type)}
                      <span className="text-xs uppercase">{step.type}</span>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{step.title || "Untitled Step"}</div>
                      <div className="text-sm text-gray-500 truncate max-w-md">{step.content}</div>
                      {step.elementSelector && (
                        <div className="text-xs text-gray-400 font-mono mt-1">
                          {step.elementSelector}
                        </div>
                      )}
                      {step.routePath && (
                        <div className="text-xs text-blue-600 mt-1" data-testid="tour-step-route">
                          Route: {step.routePath}
                        </div>
                      )}
                      {step.selectorQuality?.warnings?.length ? (
                        <div
                          className="text-xs text-amber-600 mt-1"
                          data-testid="tour-step-selector-warning"
                        >
                          {step.selectorQuality.warnings.length} selector warning
                          {step.selectorQuality.warnings.length > 1 ? "s" : ""}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex gap-1">
                      {(step.type === "pointer" || step.type === "video") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditOnSite(step._id)}
                          title="Select element on site"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleOpenStepModal(step)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteStep(step._id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="bg-white rounded-lg border p-6 space-y-6">
            <div>
              <h3 className="font-medium mb-4">Page Targeting</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Page URL Pattern
                </label>
                <Input
                  value={targetingPageUrl}
                  onChange={(e) => {
                    setTargetingPageUrl(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="https://example.com/dashboard/*"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use * as wildcard. Leave empty to show on all pages.
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-4">Audience Targeting</h3>
              <p className="text-sm text-gray-500 mb-4">
                Target specific users based on their properties, custom attributes, or behavior.
              </p>
              <AudienceRuleBuilder
                value={audienceRules}
                onChange={(rules) => {
                  setAudienceRules(rules);
                  setHasChanges(true);
                }}
                eventNames={eventNames ?? []}
                workspaceId={tour?.workspaceId}
              />
            </div>

            <div>
              <h3 className="font-medium mb-4">Appearance</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Button Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={buttonColor}
                    onChange={(e) => {
                      setButtonColor(e.target.value);
                      setHasChanges(true);
                    }}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <Input
                    value={buttonColor}
                    onChange={(e) => {
                      setButtonColor(e.target.value);
                      setHasChanges(true);
                    }}
                    className="w-32 font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-4">Display Mode</h3>
              <div className="space-y-3">
                <div>
                  <select
                    value={displayMode}
                    onChange={(e) => {
                      setDisplayMode(e.target.value as "first_time_only" | "until_dismissed");
                      setHasChanges(true);
                    }}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="first_time_only">First time only</option>
                    <option value="until_dismissed">Until dismissed</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {displayMode === "first_time_only"
                      ? "Tour shows once per user. After any interaction, it won't auto-trigger again."
                      : 'Tour shows repeatedly until user clicks "Don\'t show again". Completed tours may show again on subsequent visits.'}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-4">Priority</h3>
              <div>
                <Input
                  type="number"
                  value={priority}
                  onChange={(e) => {
                    setPriority(parseInt(e.target.value) || 0);
                    setHasChanges(true);
                  }}
                  min={0}
                  className="w-32"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lower numbers = higher priority. When multiple tours match, they trigger in
                  priority order.
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-4">Behavior</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={showConfetti}
                    onChange={(e) => {
                      setShowConfetti(e.target.checked);
                      setHasChanges(true);
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">Show confetti on completion</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={allowSnooze}
                    onChange={(e) => {
                      setAllowSnooze(e.target.checked);
                      setHasChanges(true);
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">Allow users to snooze (delay 24 hours)</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={allowRestart}
                    onChange={(e) => {
                      setAllowRestart(e.target.checked);
                      setHasChanges(true);
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">Show restart button after first step</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </main>

      {isStepModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingStepId ? "Edit Step" : "Add Step"}</h2>
            <form onSubmit={handleSaveStep} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Step Type</label>
                <div className="flex gap-2">
                  {(["pointer", "post", "video"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setStepFormData({ ...stepFormData, type })}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md border ${
                        stepFormData.type === type
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {getStepIcon(type)}
                      <span className="capitalize">{type}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title (optional)
                </label>
                <Input
                  value={stepFormData.title}
                  onChange={(e) => setStepFormData({ ...stepFormData, title: e.target.value })}
                  placeholder="Welcome to the dashboard"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea
                  value={stepFormData.content}
                  onChange={(e) => setStepFormData({ ...stepFormData, content: e.target.value })}
                  placeholder="Describe what the user should do or learn..."
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={4}
                  required
                />
              </div>

              {(stepFormData.type === "pointer" || stepFormData.type === "video") && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Element Selector
                    </label>
                    <Input
                      data-testid="tour-step-selector-input"
                      value={stepFormData.elementSelector}
                      onChange={(e) =>
                        setStepFormData({ ...stepFormData, elementSelector: e.target.value })
                      }
                      placeholder="#my-button or .nav-item"
                      className="font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      CSS selector for the element to highlight
                    </p>
                    {selectorQuality && (
                      <p
                        className="text-xs text-gray-600 mt-1"
                        data-testid="tour-step-selector-quality"
                      >
                        Selector quality: {selectorQuality.grade} ({selectorQuality.score})
                      </p>
                    )}
                    {fragileSelectorWarnings.map((warning) => (
                      <p
                        key={warning}
                        className="text-xs text-amber-600 mt-1"
                        data-testid="tour-step-selector-fragile-warning"
                      >
                        {warning}
                      </p>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Position
                      </label>
                      <select
                        value={stepFormData.position}
                        onChange={(e) =>
                          setStepFormData({ ...stepFormData, position: e.target.value as Position })
                        }
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="auto">Auto</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                        <option value="above">Above</option>
                        <option value="below">Below</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                      <select
                        value={stepFormData.size}
                        onChange={(e) =>
                          setStepFormData({ ...stepFormData, size: e.target.value as Size })
                        }
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="small">Small</option>
                        <option value="large">Large</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Step Route / URL (optional)
                </label>
                <Input
                  data-testid="tour-step-route-input"
                  value={stepFormData.routePath}
                  onChange={(e) => setStepFormData({ ...stepFormData, routePath: e.target.value })}
                  placeholder="/dashboard/settings or https://example.com/dashboard/settings"
                  className="font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use this when a step should resume on a different page.
                </p>
                {routeConsistencyWarning && (
                  <p className="text-xs text-amber-600 mt-1" data-testid="tour-step-route-warning">
                    {routeConsistencyWarning}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Advance On</label>
                <select
                  value={stepFormData.advanceOn}
                  onChange={(e) =>
                    setStepFormData({ ...stepFormData, advanceOn: e.target.value as AdvanceOn })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="click">Click Next button</option>
                  <option value="elementClick">Click the highlighted element</option>
                  <option value="fieldFill">Fill in the field</option>
                </select>
                {(stepFormData.advanceOn === "elementClick" ||
                  stepFormData.advanceOn === "fieldFill") && (
                  <p
                    className="text-xs text-blue-600 mt-1"
                    data-testid="tour-step-advance-guidance"
                  >
                    {stepFormData.advanceOn === "elementClick"
                      ? "Users must click the targeted element to continue."
                      : "Users must fill the targeted field to continue."}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Button Text (optional)
                </label>
                <Input
                  value={stepFormData.customButtonText}
                  onChange={(e) =>
                    setStepFormData({ ...stepFormData, customButtonText: e.target.value })
                  }
                  placeholder="Got it!"
                />
              </div>

              {(stepFormData.type === "post" || stepFormData.type === "video") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Media URL (optional)
                  </label>
                  <Input
                    value={stepFormData.mediaUrl}
                    onChange={(e) => setStepFormData({ ...stepFormData, mediaUrl: e.target.value })}
                    placeholder="https://example.com/image.png"
                  />
                  <div className="mt-2">
                    <select
                      value={stepFormData.mediaType}
                      onChange={(e) =>
                        setStepFormData({
                          ...stepFormData,
                          mediaType: e.target.value as "image" | "video" | "",
                        })
                      }
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">No media</option>
                      <option value="image">Image</option>
                      <option value="video">Video</option>
                    </select>
                  </div>
                  {stepFormData.type === "video" && stepFormData.mediaUrl.trim() && (
                    <p
                      className="text-xs text-blue-600 mt-2"
                      data-testid="tour-step-media-guidance"
                    >
                      Preview note: keep video steps concise and test load time on slower pages.
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseStepModal}>
                  Cancel
                </Button>
                <Button type="submit">{editingStepId ? "Save Changes" : "Add Step"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
