"use client";

import { Input } from "@opencom/ui";
import { AudienceRuleBuilder, type AudienceRule } from "@/components/AudienceRuleBuilder";
import { toInlineAudienceRuleFromBuilder, type InlineAudienceRule } from "@/lib/audienceRules";
import type { Id } from "@opencom/convex/dataModel";
import {
  type SurveyFrequency,
  type SurveyScheduling,
  type SurveyTriggers,
} from "./surveyEditorTypes";

interface SurveyTargetingTabProps {
  workspaceId?: Id<"workspaces">;
  audienceRules: InlineAudienceRule | null;
  setAudienceRules: (rules: InlineAudienceRule | null) => void;
  triggers: SurveyTriggers;
  setTriggers: (triggers: SurveyTriggers) => void;
  frequency: SurveyFrequency;
  setFrequency: (frequency: SurveyFrequency) => void;
  scheduling: SurveyScheduling;
  setScheduling: (scheduling: SurveyScheduling) => void;
  onDirty: () => void;
}

export function SurveyTargetingTab({
  workspaceId,
  audienceRules,
  setAudienceRules,
  triggers,
  setTriggers,
  frequency,
  setFrequency,
  scheduling,
  setScheduling,
  onDirty,
}: SurveyTargetingTabProps): React.JSX.Element {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-lg border p-4">
        <label className="block text-sm font-medium mb-4">Audience</label>
        <AudienceRuleBuilder
          value={audienceRules}
          onChange={(rules: AudienceRule | null) => {
            setAudienceRules(toInlineAudienceRuleFromBuilder(rules));
            onDirty();
          }}
          workspaceId={workspaceId}
          showSegmentSelector={false}
        />
      </div>

      <div className="bg-white rounded-lg border p-4">
        <label className="block text-sm font-medium mb-4">Trigger</label>
        <div className="space-y-4">
          <select
            value={triggers.type}
            onChange={(event) => {
              setTriggers({ ...triggers, type: event.target.value as SurveyTriggers["type"] });
              onDirty();
            }}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="immediate">Show immediately</option>
            <option value="page_visit">On page visit</option>
            <option value="time_on_page">After time on page</option>
            <option value="event">On event</option>
          </select>

          {triggers.type === "page_visit" && (
            <div className="space-y-2">
              <Input
                placeholder="Page URL"
                value={triggers.pageUrl || ""}
                onChange={(event) => {
                  setTriggers({ ...triggers, pageUrl: event.target.value });
                  onDirty();
                }}
              />
              <select
                value={triggers.pageUrlMatch || "contains"}
                onChange={(event) => {
                  setTriggers({
                    ...triggers,
                    pageUrlMatch: event.target.value as NonNullable<SurveyTriggers["pageUrlMatch"]>,
                  });
                  onDirty();
                }}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="exact">Exact match</option>
                <option value="contains">Contains</option>
                <option value="regex">Regex</option>
              </select>
            </div>
          )}

          {triggers.type === "time_on_page" && (
            <div>
              <label className="block text-sm mb-1">Delay (seconds)</label>
              <Input
                type="number"
                value={triggers.delaySeconds || 0}
                onChange={(event) => {
                  setTriggers({ ...triggers, delaySeconds: parseInt(event.target.value) });
                  onDirty();
                }}
                min={0}
              />
            </div>
          )}

          {triggers.type === "event" && (
            <Input
              placeholder="Event name"
              value={triggers.eventName || ""}
              onChange={(event) => {
                setTriggers({ ...triggers, eventName: event.target.value });
                onDirty();
              }}
            />
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <label className="block text-sm font-medium mb-4">Frequency</label>
        <select
          value={frequency}
          onChange={(event) => {
            setFrequency(event.target.value as SurveyFrequency);
            onDirty();
          }}
          className="w-full px-3 py-2 border rounded-md"
        >
          <option value="once">Show once</option>
          <option value="until_completed">Show until completed</option>
        </select>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <label className="block text-sm font-medium mb-4">Scheduling</label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Start Date (optional)</label>
            <Input
              type="datetime-local"
              value={scheduling.startDate ? new Date(scheduling.startDate).toISOString().slice(0, 16) : ""}
              onChange={(event) => {
                setScheduling({
                  ...scheduling,
                  startDate: event.target.value ? new Date(event.target.value).getTime() : undefined,
                });
                onDirty();
              }}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">End Date (optional)</label>
            <Input
              type="datetime-local"
              value={scheduling.endDate ? new Date(scheduling.endDate).toISOString().slice(0, 16) : ""}
              onChange={(event) => {
                setScheduling({
                  ...scheduling,
                  endDate: event.target.value ? new Date(event.target.value).getTime() : undefined,
                });
                onDirty();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
