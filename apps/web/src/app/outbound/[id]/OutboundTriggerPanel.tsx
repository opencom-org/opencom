"use client";

import { Input } from "@opencom/ui";
import type { MessageTrigger } from "@opencom/types";
import { OutboundFieldLabel } from "./OutboundFieldLabel";

interface OutboundTriggerPanelProps {
  value: MessageTrigger;
  onChange: (value: MessageTrigger) => void;
}

export function OutboundTriggerPanel({ value, onChange }: OutboundTriggerPanelProps) {
  return (
    <div className="bg-white border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">Trigger</h2>
      <div className="space-y-4">
        <div>
          <OutboundFieldLabel>Show message when</OutboundFieldLabel>
          <select
            value={value.type}
            onChange={(e) => onChange({ ...value, type: e.target.value as MessageTrigger["type"] })}
            className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="immediate">Immediately on page load</option>
            <option value="page_visit">On specific page visit</option>
            <option value="time_on_page">After time on page</option>
            <option value="scroll_depth">After scroll depth</option>
            <option value="event">After event</option>
          </select>
        </div>

        {value.type === "page_visit" && (
          <div className="space-y-2">
            <OutboundFieldLabel>Page URL</OutboundFieldLabel>
            <Input
              value={value.pageUrl || ""}
              onChange={(e) => onChange({ ...value, pageUrl: e.target.value })}
              placeholder="/pricing or https://example.com/pricing"
            />
            <select
              value={value.pageUrlMatch || "contains"}
              onChange={(e) =>
                onChange({
                  ...value,
                  pageUrlMatch: e.target.value as NonNullable<MessageTrigger["pageUrlMatch"]>,
                })
              }
              className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="exact">Exact match</option>
              <option value="contains">Contains</option>
              <option value="regex">Regex</option>
            </select>
          </div>
        )}

        {value.type === "time_on_page" && (
          <div>
            <OutboundFieldLabel>Delay (seconds)</OutboundFieldLabel>
            <Input
              type="number"
              value={value.delaySeconds || 5}
              onChange={(e) =>
                onChange({ ...value, delaySeconds: Number.parseInt(e.target.value, 10) })
              }
              min={1}
            />
          </div>
        )}

        {value.type === "scroll_depth" && (
          <div>
            <OutboundFieldLabel>Scroll percentage</OutboundFieldLabel>
            <Input
              type="number"
              value={value.scrollPercent || 50}
              onChange={(e) =>
                onChange({ ...value, scrollPercent: Number.parseInt(e.target.value, 10) })
              }
              min={1}
              max={100}
            />
          </div>
        )}

        {value.type === "event" && (
          <div>
            <OutboundFieldLabel>Event name</OutboundFieldLabel>
            <Input
              value={value.eventName || ""}
              onChange={(e) => onChange({ ...value, eventName: e.target.value })}
              placeholder="button_clicked"
            />
          </div>
        )}
      </div>
    </div>
  );
}
