import { Button } from "@opencom/ui";
import { ExternalLink, GripVertical, MousePointer, Plus, Trash2 } from "lucide-react";
import { TourStepTypeIcon } from "./TourStepTypeIcon";
import type { TourEditorStep } from "./tourEditorTypes";

type TourEditorStepsPanelProps = {
  steps: TourEditorStep[];
  onAddStep: () => void;
  onDeleteStep: (stepId: TourEditorStep["_id"]) => void;
  onEditOnSite: (stepId?: TourEditorStep["_id"]) => void;
  onEditStep: (step: TourEditorStep) => void;
  onMoveStep: (stepId: TourEditorStep["_id"], direction: "up" | "down") => void;
};

export function TourEditorStepsPanel({
  steps,
  onAddStep,
  onDeleteStep,
  onEditOnSite,
  onEditStep,
  onMoveStep,
}: TourEditorStepsPanelProps) {
  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-medium">Tour Steps</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onEditOnSite()}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Edit on Site
          </Button>
          <Button size="sm" onClick={onAddStep}>
            <Plus className="h-4 w-4 mr-2" />
            Add Step
          </Button>
        </div>
      </div>

      {steps.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <MousePointer className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p>No steps yet. Add your first step to get started.</p>
        </div>
      ) : (
        <div className="divide-y">
          {steps.map((step, index) => (
            <div key={step._id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => onMoveStep(step._id, "up")}
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
                <TourStepTypeIcon type={step.type} />
                <span className="text-xs uppercase">{step.type}</span>
              </div>
              <div className="flex-1">
                <div className="font-medium">{step.title || "Untitled Step"}</div>
                <div className="text-sm text-gray-500 truncate max-w-md">{step.content}</div>
                {step.elementSelector && (
                  <div className="text-xs text-gray-400 font-mono mt-1">{step.elementSelector}</div>
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
                    onClick={() => onEditOnSite(step._id)}
                    title="Select element on site"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => onEditStep(step)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteStep(step._id)}
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
  );
}
