"use client";

import { useState } from "react";
import { Input } from "@opencom/ui";
import { Clock, MousePointer, ScrollText, Zap, LogOut, Globe } from "lucide-react";

export type TriggerType =
  | "immediate"
  | "page_visit"
  | "time_on_page"
  | "scroll_depth"
  | "event"
  | "exit_intent";

export type TriggerConfig = {
  type: TriggerType;
  pageUrl?: string;
  pageUrlMatch?: "exact" | "contains" | "regex";
  delaySeconds?: number;
  scrollPercent?: number;
  eventName?: string;
  eventProperties?: Record<string, unknown>;
};

interface TriggerConfigEditorProps {
  value: TriggerConfig | null;
  onChange: (config: TriggerConfig | null) => void;
  eventNames?: string[];
}

const TRIGGER_OPTIONS: {
  value: TriggerType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "immediate",
    label: "Immediately",
    description: "Show as soon as audience matches",
    icon: <Zap className="h-4 w-4" />,
  },
  {
    value: "page_visit",
    label: "Page Visit",
    description: "Show on specific page/URL",
    icon: <Globe className="h-4 w-4" />,
  },
  {
    value: "time_on_page",
    label: "Time on Page",
    description: "Show after time delay",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    value: "scroll_depth",
    label: "Scroll Depth",
    description: "Show after scrolling",
    icon: <ScrollText className="h-4 w-4" />,
  },
  {
    value: "event",
    label: "Event Fired",
    description: "Show when event occurs",
    icon: <MousePointer className="h-4 w-4" />,
  },
  {
    value: "exit_intent",
    label: "Exit Intent",
    description: "Show when user moves to leave",
    icon: <LogOut className="h-4 w-4" />,
  },
];

export function TriggerConfigEditor({
  value,
  onChange,
  eventNames = [],
}: TriggerConfigEditorProps) {
  const [isEnabled, setIsEnabled] = useState(value !== null);

  const handleToggle = () => {
    if (isEnabled) {
      onChange(null);
      setIsEnabled(false);
    } else {
      onChange({ type: "immediate" });
      setIsEnabled(true);
    }
  };

  const handleTypeChange = (type: TriggerType) => {
    const newConfig: TriggerConfig = { type };

    switch (type) {
      case "page_visit":
        newConfig.pageUrl = "";
        newConfig.pageUrlMatch = "contains";
        break;
      case "time_on_page":
        newConfig.delaySeconds = 5;
        break;
      case "scroll_depth":
        newConfig.scrollPercent = 50;
        break;
      case "event":
        newConfig.eventName = eventNames[0] || "";
        break;
    }

    onChange(newConfig);
  };

  const handleConfigUpdate = (updates: Partial<TriggerConfig>) => {
    if (!value) return;
    onChange({ ...value, ...updates });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isEnabled} onChange={handleToggle} className="rounded" />
          <span className="text-sm font-medium">Configure display trigger</span>
        </label>
      </div>

      {isEnabled && value && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {TRIGGER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleTypeChange(option.value)}
                className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-colors ${
                  value.type === option.value
                    ? "bg-primary/5 border-primary/30 text-primary"
                    : "bg-white border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  {option.icon}
                  <span className="font-medium text-sm">{option.label}</span>
                </div>
                <span className="text-xs text-gray-500">{option.description}</span>
              </button>
            ))}
          </div>

          {value.type === "page_visit" && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <div className="flex gap-2">
                <select
                  value={value.pageUrlMatch || "contains"}
                  onChange={(e) =>
                    handleConfigUpdate({
                      pageUrlMatch: e.target.value as "exact" | "contains" | "regex",
                    })
                  }
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="exact">URL equals</option>
                  <option value="contains">URL contains</option>
                  <option value="regex">URL matches regex</option>
                </select>
                <Input
                  value={value.pageUrl || ""}
                  onChange={(e) => handleConfigUpdate({ pageUrl: e.target.value })}
                  placeholder={value.pageUrlMatch === "regex" ? "^/products/.*" : "/pricing"}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-gray-500">
                {value.pageUrlMatch === "exact" && "The URL must match exactly"}
                {value.pageUrlMatch === "contains" && "The URL must contain this text"}
                {value.pageUrlMatch === "regex" && "The URL must match this regular expression"}
              </p>
            </div>
          )}

          {value.type === "time_on_page" && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm">Show after</span>
                <Input
                  type="number"
                  value={value.delaySeconds || 5}
                  onChange={(e) =>
                    handleConfigUpdate({ delaySeconds: parseInt(e.target.value) || 0 })
                  }
                  className="w-20"
                  min={1}
                  max={300}
                />
                <span className="text-sm">seconds on page</span>
              </div>
              <div className="flex gap-2">
                {[5, 10, 30, 60].map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    onClick={() => handleConfigUpdate({ delaySeconds: seconds })}
                    className={`px-3 py-1 rounded text-sm ${
                      value.delaySeconds === seconds
                        ? "bg-primary/10 text-primary"
                        : "bg-white border hover:bg-gray-50"
                    }`}
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
            </div>
          )}

          {value.type === "scroll_depth" && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm">Show after scrolling</span>
                <Input
                  type="number"
                  value={value.scrollPercent || 50}
                  onChange={(e) =>
                    handleConfigUpdate({ scrollPercent: parseInt(e.target.value) || 0 })
                  }
                  className="w-20"
                  min={1}
                  max={100}
                />
                <span className="text-sm">% of page</span>
              </div>
              <div className="flex gap-2">
                {[25, 50, 75, 90].map((percent) => (
                  <button
                    key={percent}
                    type="button"
                    onClick={() => handleConfigUpdate({ scrollPercent: percent })}
                    className={`px-3 py-1 rounded text-sm ${
                      value.scrollPercent === percent
                        ? "bg-primary/10 text-primary"
                        : "bg-white border hover:bg-gray-50"
                    }`}
                  >
                    {percent}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {value.type === "event" && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm">Show when event</span>
                {eventNames.length > 0 ? (
                  <select
                    value={value.eventName || ""}
                    onChange={(e) => handleConfigUpdate({ eventName: e.target.value })}
                    className="px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">Select event...</option>
                    {eventNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={value.eventName || ""}
                    onChange={(e) => handleConfigUpdate({ eventName: e.target.value })}
                    placeholder="event_name"
                    className="w-48"
                  />
                )}
                <span className="text-sm">is fired</span>
              </div>
            </div>
          )}

          {value.type === "exit_intent" && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                This trigger fires when the user moves their mouse toward the browser&apos;s close
                button or address bar, indicating they may be about to leave the page. Works on
                desktop browsers only.
              </p>
            </div>
          )}

          {value.type === "immediate" && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Content will be shown immediately when the visitor matches the audience rules.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
