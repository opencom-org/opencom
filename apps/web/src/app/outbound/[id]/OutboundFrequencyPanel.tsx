"use client";

import type { MessageFrequency } from "@opencom/types";

interface OutboundFrequencyPanelProps {
  value: MessageFrequency;
  onChange: (value: MessageFrequency) => void;
}

export function OutboundFrequencyPanel({ value, onChange }: OutboundFrequencyPanelProps) {
  return (
    <div className="bg-white border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">Frequency</h2>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as MessageFrequency)}
        className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="once">Once per user</option>
        <option value="once_per_session">Once per session</option>
        <option value="always">Every time conditions are met</option>
      </select>
    </div>
  );
}
