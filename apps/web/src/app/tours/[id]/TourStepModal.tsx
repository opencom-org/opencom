import type { FormEvent } from "react";
import { Button, Input } from "@opencom/ui";
import {
  getFragileSelectorWarnings,
  getRouteConsistencyWarning,
  getSelectorQuality,
  stepTypeOptions,
  type AdvanceOn,
  type Position,
  type Size,
  type StepFormData,
  type TourEditorStep,
} from "./tourEditorTypes";
import { TourStepTypeIcon } from "./TourStepTypeIcon";

type TourStepModalProps = {
  isOpen: boolean;
  editingStepId: TourEditorStep["_id"] | null;
  stepFormData: StepFormData;
  targetingPageUrl: string;
  onClose: () => void;
  onStepFormDataChange: (value: StepFormData) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function TourStepModal({
  isOpen,
  editingStepId,
  stepFormData,
  targetingPageUrl,
  onClose,
  onStepFormDataChange,
  onSubmit,
}: TourStepModalProps) {
  const selectorQuality = getSelectorQuality(stepFormData.elementSelector);
  const fragileSelectorWarnings = getFragileSelectorWarnings(stepFormData.elementSelector);
  const routeConsistencyWarning = getRouteConsistencyWarning(
    stepFormData.routePath,
    targetingPageUrl
  );

  const updateField = <K extends keyof StepFormData>(field: K, value: StepFormData[K]) => {
    onStepFormDataChange({
      ...stepFormData,
      [field]: value,
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">{editingStepId ? "Edit Step" : "Add Step"}</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Step Type</label>
            <div className="flex gap-2">
              {stepTypeOptions.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => updateField("type", type)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md border ${
                    stepFormData.type === type
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <TourStepTypeIcon type={type} />
                  <span className="capitalize">{type}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title (optional)</label>
            <Input
              value={stepFormData.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="Welcome to the dashboard"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea
              value={stepFormData.content}
              onChange={(e) => updateField("content", e.target.value)}
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
                  onChange={(e) => updateField("elementSelector", e.target.value)}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                  <select
                    value={stepFormData.position}
                    onChange={(e) => updateField("position", e.target.value as Position)}
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
                    onChange={(e) => updateField("size", e.target.value as Size)}
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
              onChange={(e) => updateField("routePath", e.target.value)}
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
              onChange={(e) => updateField("advanceOn", e.target.value as AdvanceOn)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="click">Click Next button</option>
              <option value="elementClick">Click the highlighted element</option>
              <option value="fieldFill">Fill in the field</option>
            </select>
            {(stepFormData.advanceOn === "elementClick" ||
              stepFormData.advanceOn === "fieldFill") && (
              <p className="text-xs text-blue-600 mt-1" data-testid="tour-step-advance-guidance">
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
              onChange={(e) => updateField("customButtonText", e.target.value)}
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
                onChange={(e) => updateField("mediaUrl", e.target.value)}
                placeholder="https://example.com/image.png"
              />
              <div className="mt-2">
                <select
                  value={stepFormData.mediaType}
                  onChange={(e) =>
                    updateField("mediaType", e.target.value as StepFormData["mediaType"])
                  }
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">No media</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
              </div>
              {stepFormData.type === "video" && stepFormData.mediaUrl.trim() && (
                <p className="text-xs text-blue-600 mt-2" data-testid="tour-step-media-guidance">
                  Preview note: keep video steps concise and test load time on slower pages.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{editingStepId ? "Save Changes" : "Add Step"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
