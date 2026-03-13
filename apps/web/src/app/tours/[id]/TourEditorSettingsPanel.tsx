import { Input } from "@opencom/ui";
import { AudienceRuleBuilder, type AudienceRule } from "@/components/AudienceRuleBuilder";
import type { TourDisplayMode, TourEditorTour } from "./tourEditorTypes";

type TourEditorSettingsPanelProps = {
  targetingPageUrl: string;
  onTargetingPageUrlChange: (value: string) => void;
  audienceRules: AudienceRule | null;
  onAudienceRulesChange: (value: AudienceRule | null) => void;
  eventNames: string[];
  workspaceId: TourEditorTour["workspaceId"];
  buttonColor: string;
  onButtonColorChange: (value: string) => void;
  displayMode: TourDisplayMode;
  onDisplayModeChange: (value: TourDisplayMode) => void;
  priority: number;
  onPriorityChange: (value: number) => void;
  showConfetti: boolean;
  onShowConfettiChange: (value: boolean) => void;
  allowSnooze: boolean;
  onAllowSnoozeChange: (value: boolean) => void;
  allowRestart: boolean;
  onAllowRestartChange: (value: boolean) => void;
};

export function TourEditorSettingsPanel({
  targetingPageUrl,
  onTargetingPageUrlChange,
  audienceRules,
  onAudienceRulesChange,
  eventNames,
  workspaceId,
  buttonColor,
  onButtonColorChange,
  displayMode,
  onDisplayModeChange,
  priority,
  onPriorityChange,
  showConfetti,
  onShowConfettiChange,
  allowSnooze,
  onAllowSnoozeChange,
  allowRestart,
  onAllowRestartChange,
}: TourEditorSettingsPanelProps) {
  return (
    <div className="bg-white rounded-lg border p-6 space-y-6">
      <div>
        <h3 className="font-medium mb-4">Page Targeting</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Page URL Pattern</label>
          <Input
            value={targetingPageUrl}
            onChange={(e) => onTargetingPageUrlChange(e.target.value)}
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
          onChange={onAudienceRulesChange}
          eventNames={eventNames}
          workspaceId={workspaceId}
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
              onChange={(e) => onButtonColorChange(e.target.value)}
              className="w-10 h-10 rounded border cursor-pointer"
            />
            <Input
              value={buttonColor}
              onChange={(e) => onButtonColorChange(e.target.value)}
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
              onChange={(e) => onDisplayModeChange(e.target.value as TourDisplayMode)}
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
              const nextPriority = Number.parseInt(e.target.value, 10);
              onPriorityChange(Number.isNaN(nextPriority) ? 0 : nextPriority);
            }}
            min={0}
            className="w-32"
          />
          <p className="text-xs text-gray-500 mt-1">
            Lower numbers = higher priority. When multiple tours match, they trigger in priority
            order.
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
              onChange={(e) => onShowConfettiChange(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show confetti on completion</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allowSnooze}
              onChange={(e) => onAllowSnoozeChange(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Allow users to snooze (delay 24 hours)</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allowRestart}
              onChange={(e) => onAllowRestartChange(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show restart button after first step</span>
          </label>
        </div>
      </div>
    </div>
  );
}
