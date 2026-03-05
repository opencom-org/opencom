"use client";

import { Textarea } from "@opencom/ui";

interface SurveySettingsTabProps {
  format: "small" | "large";
  showProgressBar: boolean;
  setShowProgressBar: (value: boolean) => void;
  showDismissButton: boolean;
  setShowDismissButton: (value: boolean) => void;
  description: string;
  setDescription: (value: string) => void;
  onDirty: () => void;
}

export function SurveySettingsTab({
  format,
  showProgressBar,
  setShowProgressBar,
  showDismissButton,
  setShowDismissButton,
  description,
  setDescription,
  onDirty,
}: SurveySettingsTabProps): React.JSX.Element {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-lg border p-4">
        <label className="block text-sm font-medium mb-4">Display Options</label>
        <div className="space-y-3">
          {format === "large" && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showProgressBar}
                onChange={(event) => {
                  setShowProgressBar(event.target.checked);
                  onDirty();
                }}
              />
              <span className="text-sm">Show progress bar</span>
            </label>
          )}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showDismissButton}
              onChange={(event) => {
                setShowDismissButton(event.target.checked);
                onDirty();
              }}
            />
            <span className="text-sm">Show dismiss button</span>
          </label>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <label className="block text-sm font-medium mb-2">Description</label>
        <Textarea
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            onDirty();
          }}
          placeholder="Internal description for this survey"
          rows={3}
        />
      </div>
    </div>
  );
}
