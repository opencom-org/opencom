"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { appConfirm } from "@/lib/appConfirm";
import { Button, Input } from "@opencom/ui";
import {
  ArrowLeft,
  Save,
  Play,
  Pause,
  Settings,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import type { Id } from "@opencom/convex/dataModel";
import type { AudienceRule } from "@/components/AudienceRuleBuilder";
import { TourEditorSettingsPanel } from "./TourEditorSettingsPanel";
import { TourEditorStepsPanel } from "./TourEditorStepsPanel";
import { TourStepModal } from "./TourStepModal";
import {
  createDefaultStepData,
  getNormalizedStepSaveData,
  toStepFormData,
  type StepFormData,
  type TourDisplayMode,
  type TourEditorStep,
} from "./tourEditorTypes";

export default function TourEditorPage() {
  const params = useParams();
  const tourId = params.id as Id<"tours">;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetingPageUrl, setTargetingPageUrl] = useState("");
  const [displayMode, setDisplayMode] = useState<TourDisplayMode>("first_time_only");
  const [priority, setPriority] = useState(0);
  const [buttonColor, setButtonColor] = useState("#792cd4");
  const [showConfetti, setShowConfetti] = useState(true);
  const [allowSnooze, setAllowSnooze] = useState(true);
  const [allowRestart, setAllowRestart] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<"steps" | "settings">("steps");
  const [editingStepId, setEditingStepId] = useState<Id<"tourSteps"> | null>(null);
  const [stepFormData, setStepFormData] = useState<StepFormData>(() => createDefaultStepData());
  const [isStepModalOpen, setIsStepModalOpen] = useState(false);
  const [audienceRules, setAudienceRules] = useState<AudienceRule | null>(null);

  const { user, isLoading: authLoading } = useAuth();
  const canQueryTourData = !authLoading && !!user;

  // @ts-expect-error Convex generated type graph can exceed TS instantiation depth in app package checks.
  const tour = useQuery(api.tours.get, canQueryTourData ? { id: tourId } : "skip");
  // @ts-expect-error Convex generated type graph can exceed TS instantiation depth in app package checks.
  const steps = useQuery(api.tourSteps.list, canQueryTourData ? { tourId } : "skip");
  const eventNames = useQuery(
    api.events.getDistinctNames,
    canQueryTourData && tour?.workspaceId ? { workspaceId: tour.workspaceId } : "skip"
  );

  // @ts-expect-error Convex generated type graph can exceed TS instantiation depth in app package checks.
  const updateTour = useMutation(api.tours.update);
  // @ts-expect-error Convex generated type graph can exceed TS instantiation depth in app package checks.
  const activateTour = useMutation(api.tours.activate);
  // @ts-expect-error Convex generated type graph can exceed TS instantiation depth in app package checks.
  const deactivateTour = useMutation(api.tours.deactivate);
  // @ts-expect-error Convex generated type graph can exceed TS instantiation depth in app package checks.
  const createStep = useMutation(api.tourSteps.create);
  // @ts-expect-error Convex generated type graph can exceed TS instantiation depth in app package checks.
  const updateStep = useMutation(api.tourSteps.update);
  // @ts-expect-error Convex generated type graph can exceed TS instantiation depth in app package checks.
  const deleteStep = useMutation(api.tourSteps.remove);
  // @ts-expect-error Convex generated type graph can exceed TS instantiation depth in app package checks.
  const reorderSteps = useMutation(api.tourSteps.reorder);
  // @ts-expect-error Convex generated type graph can exceed TS instantiation depth in app package checks.
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

  const handleOpenStepModal = (step?: TourEditorStep) => {
    setEditingStepId(step?._id ?? null);
    setStepFormData(toStepFormData(step));
    setIsStepModalOpen(true);
  };

  const handleCloseStepModal = () => {
    setIsStepModalOpen(false);
    setEditingStepId(null);
    setStepFormData(createDefaultStepData());
  };

  const handleSaveStep = async (e: React.FormEvent) => {
    e.preventDefault();
    const { normalizedSelector, normalizedRoutePath, selectorQuality, validationError } =
      getNormalizedStepSaveData(stepFormData);

    if (validationError) {
      alert(validationError);
      return;
    }

    try {
      if (editingStepId) {
        await updateStep({
          id: editingStepId,
          type: stepFormData.type,
          title: stepFormData.title || undefined,
          content: stepFormData.content,
          elementSelector: normalizedSelector || undefined,
          routePath: normalizedRoutePath,
          selectorQuality,
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
          selectorQuality,
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
    if (await appConfirm("Are you sure you want to delete this step?")) {
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

        {activeTab === "steps" ? (
          <TourEditorStepsPanel
            steps={steps ?? []}
            onAddStep={() => handleOpenStepModal()}
            onDeleteStep={handleDeleteStep}
            onEditOnSite={handleEditOnSite}
            onEditStep={handleOpenStepModal}
            onMoveStep={handleMoveStep}
          />
        ) : (
          <TourEditorSettingsPanel
            targetingPageUrl={targetingPageUrl}
            onTargetingPageUrlChange={(value) => {
              setTargetingPageUrl(value);
              setHasChanges(true);
            }}
            audienceRules={audienceRules}
            onAudienceRulesChange={(value) => {
              setAudienceRules(value);
              setHasChanges(true);
            }}
            eventNames={eventNames ?? []}
            workspaceId={tour.workspaceId}
            buttonColor={buttonColor}
            onButtonColorChange={(value) => {
              setButtonColor(value);
              setHasChanges(true);
            }}
            displayMode={displayMode}
            onDisplayModeChange={(value) => {
              setDisplayMode(value);
              setHasChanges(true);
            }}
            priority={priority}
            onPriorityChange={(value) => {
              setPriority(value);
              setHasChanges(true);
            }}
            showConfetti={showConfetti}
            onShowConfettiChange={(value) => {
              setShowConfetti(value);
              setHasChanges(true);
            }}
            allowSnooze={allowSnooze}
            onAllowSnoozeChange={(value) => {
              setAllowSnooze(value);
              setHasChanges(true);
            }}
            allowRestart={allowRestart}
            onAllowRestartChange={(value) => {
              setAllowRestart(value);
              setHasChanges(true);
            }}
          />
        )}
      </main>

      <TourStepModal
        isOpen={isStepModalOpen}
        editingStepId={editingStepId}
        stepFormData={stepFormData}
        targetingPageUrl={targetingPageUrl}
        onClose={handleCloseStepModal}
        onStepFormDataChange={setStepFormData}
        onSubmit={handleSaveStep}
      />
    </div>
  );
}
