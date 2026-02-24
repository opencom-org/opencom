"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@opencom/convex";
import { Button, Input } from "@opencom/ui";
import { Plus, Trash2, ChevronDown, GripVertical, Users, Layers } from "lucide-react";
import type { Id } from "@opencom/convex/dataModel";

export type SegmentReference = {
  type: "segment";
  segmentId: Id<"segments">;
};

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equals"
  | "less_than_or_equals"
  | "is_set"
  | "is_not_set";

export type PropertyReference = {
  source: "system" | "custom" | "event";
  key: string;
  eventFilter?: {
    name: string;
    countOperator?: "at_least" | "at_most" | "exactly";
    count?: number;
    withinDays?: number;
  };
};

export type AudienceCondition = {
  type: "condition";
  property: PropertyReference;
  operator: ConditionOperator;
  value?: string | number | boolean;
};

export type AudienceGroup = {
  type: "group";
  operator: "and" | "or";
  conditions: AudienceRule[];
};

export type AudienceRule = AudienceGroup | AudienceCondition | SegmentReference;

interface AudienceRuleBuilderProps {
  value: AudienceRule | null;
  onChange: (rule: AudienceRule | null) => void;
  eventNames?: string[];
  workspaceId?: Id<"workspaces">;
  showSegmentSelector?: boolean;
}

const SYSTEM_PROPERTIES = [
  { key: "email", label: "Email", type: "string" },
  { key: "name", label: "Name", type: "string" },
  { key: "externalUserId", label: "External User ID", type: "string" },
  { key: "firstSeenAt", label: "First Seen", type: "date" },
  { key: "lastSeenAt", label: "Last Seen", type: "date" },
  { key: "browser", label: "Browser", type: "string" },
  { key: "os", label: "Operating System", type: "string" },
  { key: "device", label: "Device Type", type: "string" },
  { key: "referrer", label: "Referrer", type: "string" },
  { key: "country", label: "Country", type: "string" },
  { key: "city", label: "City", type: "string" },
];

const STRING_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: "is_set", label: "is set" },
  { value: "is_not_set", label: "is not set" },
];

const NUMBER_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "greater_than", label: "greater than" },
  { value: "less_than", label: "less than" },
  { value: "greater_than_or_equals", label: "greater than or equals" },
  { value: "less_than_or_equals", label: "less than or equals" },
  { value: "is_set", label: "is set" },
  { value: "is_not_set", label: "is not set" },
];

function createEmptyCondition(): AudienceCondition {
  return {
    type: "condition",
    property: { source: "system", key: "email" },
    operator: "is_set",
  };
}

function createEmptyGroup(): AudienceGroup {
  return {
    type: "group",
    operator: "and",
    conditions: [createEmptyCondition()],
  };
}

interface ConditionEditorProps {
  condition: AudienceCondition;
  onChange: (condition: AudienceCondition) => void;
  onRemove: () => void;
  eventNames?: string[];
}

function ConditionEditor({ condition, onChange, onRemove, eventNames = [] }: ConditionEditorProps) {
  const { property, operator, value } = condition;

  const handlePropertySourceChange = (source: "system" | "custom" | "event") => {
    if (source === "event") {
      onChange({
        ...condition,
        property: {
          source: "event",
          key: "event",
          eventFilter: { name: eventNames[0] || "", countOperator: "at_least", count: 1 },
        },
        operator: "is_set",
        value: undefined,
      });
    } else if (source === "custom") {
      onChange({
        ...condition,
        property: { source: "custom", key: "" },
        operator: "is_set",
        value: undefined,
      });
    } else {
      onChange({
        ...condition,
        property: { source: "system", key: "email" },
        operator: "is_set",
        value: undefined,
      });
    }
  };

  const handleSystemPropertyChange = (key: string) => {
    onChange({
      ...condition,
      property: { ...property, key },
    });
  };

  const handleCustomKeyChange = (key: string) => {
    onChange({
      ...condition,
      property: { ...property, key },
    });
  };

  const handleOperatorChange = (op: ConditionOperator) => {
    const needsValue = !["is_set", "is_not_set"].includes(op);
    onChange({
      ...condition,
      operator: op,
      value: needsValue ? (value ?? "") : undefined,
    });
  };

  const handleValueChange = (val: string) => {
    onChange({
      ...condition,
      value: val,
    });
  };

  const handleEventNameChange = (name: string) => {
    onChange({
      ...condition,
      property: {
        ...property,
        eventFilter: { ...property.eventFilter, name } as PropertyReference["eventFilter"],
      },
    });
  };

  const handleEventCountOperatorChange = (countOperator: "at_least" | "at_most" | "exactly") => {
    onChange({
      ...condition,
      property: {
        ...property,
        eventFilter: { ...property.eventFilter, countOperator } as PropertyReference["eventFilter"],
      },
    });
  };

  const handleEventCountChange = (count: number) => {
    onChange({
      ...condition,
      property: {
        ...property,
        eventFilter: { ...property.eventFilter, count } as PropertyReference["eventFilter"],
      },
    });
  };

  const handleEventWithinDaysChange = (withinDays: number | undefined) => {
    onChange({
      ...condition,
      property: {
        ...property,
        eventFilter: { ...property.eventFilter, withinDays } as PropertyReference["eventFilter"],
      },
    });
  };

  const operators =
    property.source === "system"
      ? SYSTEM_PROPERTIES.find((p) => p.key === property.key)?.type === "date"
        ? NUMBER_OPERATORS
        : STRING_OPERATORS
      : STRING_OPERATORS;

  const needsValue = !["is_set", "is_not_set"].includes(operator);

  return (
    <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
      <div className="flex-1 flex flex-wrap items-center gap-2">
        <select
          value={property.source}
          onChange={(e) =>
            handlePropertySourceChange(e.target.value as "system" | "custom" | "event")
          }
          className="px-2 py-1.5 border rounded text-sm"
        >
          <option value="system">User Property</option>
          <option value="custom">Custom Attribute</option>
          <option value="event">Event</option>
        </select>

        {property.source === "system" && (
          <select
            value={property.key}
            onChange={(e) => handleSystemPropertyChange(e.target.value)}
            className="px-2 py-1.5 border rounded text-sm"
          >
            {SYSTEM_PROPERTIES.map((prop) => (
              <option key={prop.key} value={prop.key}>
                {prop.label}
              </option>
            ))}
          </select>
        )}

        {property.source === "custom" && (
          <Input
            value={property.key}
            onChange={(e) => handleCustomKeyChange(e.target.value)}
            placeholder="attribute_name"
            className="w-40 text-sm"
          />
        )}

        {property.source === "event" && (
          <>
            <select
              value={property.eventFilter?.name || ""}
              onChange={(e) => handleEventNameChange(e.target.value)}
              className="px-2 py-1.5 border rounded text-sm"
            >
              <option value="">Select event...</option>
              {eventNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={property.eventFilter?.countOperator || "at_least"}
              onChange={(e) =>
                handleEventCountOperatorChange(e.target.value as "at_least" | "at_most" | "exactly")
              }
              className="px-2 py-1.5 border rounded text-sm"
            >
              <option value="at_least">at least</option>
              <option value="at_most">at most</option>
              <option value="exactly">exactly</option>
            </select>
            <Input
              type="number"
              value={property.eventFilter?.count ?? 1}
              onChange={(e) => handleEventCountChange(parseInt(e.target.value) || 1)}
              className="w-16 text-sm"
              min={0}
            />
            <span className="text-sm text-gray-500">times</span>
            <select
              value={property.eventFilter?.withinDays ?? ""}
              onChange={(e) =>
                handleEventWithinDaysChange(e.target.value ? parseInt(e.target.value) : undefined)
              }
              className="px-2 py-1.5 border rounded text-sm"
            >
              <option value="">all time</option>
              <option value="1">last 1 day</option>
              <option value="7">last 7 days</option>
              <option value="30">last 30 days</option>
              <option value="90">last 90 days</option>
            </select>
          </>
        )}

        {property.source !== "event" && (
          <>
            <select
              value={operator}
              onChange={(e) => handleOperatorChange(e.target.value as ConditionOperator)}
              className="px-2 py-1.5 border rounded text-sm"
            >
              {operators.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>

            {needsValue && (
              <Input
                value={String(value ?? "")}
                onChange={(e) => handleValueChange(e.target.value)}
                placeholder="value"
                className="w-40 text-sm"
              />
            )}
          </>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="text-red-500 hover:text-red-700"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface GroupEditorProps {
  group: AudienceGroup;
  onChange: (group: AudienceGroup) => void;
  onRemove?: () => void;
  depth?: number;
  eventNames?: string[];
}

function GroupEditor({ group, onChange, onRemove, depth = 0, eventNames = [] }: GroupEditorProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newConditions = [...group.conditions];
    const [removed] = newConditions.splice(draggedIndex, 1);
    newConditions.splice(targetIndex, 0, removed);
    onChange({ ...group, conditions: newConditions });

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleOperatorToggle = () => {
    onChange({
      ...group,
      operator: group.operator === "and" ? "or" : "and",
    });
  };

  const handleConditionChange = (index: number, rule: AudienceRule) => {
    const newConditions = [...group.conditions];
    newConditions[index] = rule;
    onChange({ ...group, conditions: newConditions });
  };

  const handleRemoveCondition = (index: number) => {
    const newConditions = group.conditions.filter((_, i) => i !== index);
    if (newConditions.length === 0) {
      onRemove?.();
    } else {
      onChange({ ...group, conditions: newConditions });
    }
  };

  const handleAddCondition = () => {
    onChange({
      ...group,
      conditions: [...group.conditions, createEmptyCondition()],
    });
  };

  const handleAddGroup = () => {
    onChange({
      ...group,
      conditions: [...group.conditions, createEmptyGroup()],
    });
  };

  return (
    <div className={`border rounded-lg p-4 ${depth > 0 ? "bg-gray-50" : "bg-white"}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-gray-600">Match</span>
        <button
          type="button"
          onClick={handleOperatorToggle}
          className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded text-sm font-medium hover:bg-primary/20"
        >
          {group.operator.toUpperCase()}
          <ChevronDown className="h-3 w-3" />
        </button>
        <span className="text-sm text-gray-600">of the following conditions</span>
        {onRemove && (
          <Button variant="ghost" size="sm" onClick={onRemove} className="ml-auto text-red-500">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {group.conditions.map((rule, index) => (
          <div
            key={index}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-start gap-2 transition-all ${
              draggedIndex === index ? "opacity-50" : ""
            } ${dragOverIndex === index ? "border-t-2 border-primary" : ""}`}
          >
            <div className="cursor-grab active:cursor-grabbing p-2 text-gray-400 hover:text-gray-600">
              <GripVertical className="h-4 w-4" />
            </div>
            <div className="flex-1">
              {rule.type === "condition" ? (
                <ConditionEditor
                  condition={rule}
                  onChange={(c) => handleConditionChange(index, c)}
                  onRemove={() => handleRemoveCondition(index)}
                  eventNames={eventNames}
                />
              ) : rule.type === "group" ? (
                <GroupEditor
                  group={rule}
                  onChange={(g) => handleConditionChange(index, g)}
                  onRemove={() => handleRemoveCondition(index)}
                  depth={depth + 1}
                  eventNames={eventNames}
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-3">
        <Button variant="outline" size="sm" onClick={handleAddCondition}>
          <Plus className="h-4 w-4 mr-1" />
          Add Condition
        </Button>
        {depth < 2 && (
          <Button variant="outline" size="sm" onClick={handleAddGroup}>
            <Plus className="h-4 w-4 mr-1" />
            Add Group
          </Button>
        )}
      </div>
    </div>
  );
}

export function AudienceRuleBuilder({
  value,
  onChange,
  eventNames = [],
  workspaceId,
  showSegmentSelector = true,
}: AudienceRuleBuilderProps) {
  const [isEnabled, setIsEnabled] = useState(value !== null);
  const [targetingMode, setTargetingMode] = useState<"custom" | "segment">(
    value?.type === "segment" ? "segment" : "custom"
  );

  const segments = useQuery(api.segments.list, workspaceId ? { workspaceId } : "skip");

  const preview = useQuery(
    api.tours.previewAudienceRules,
    workspaceId && isEnabled && value ? { workspaceId, audienceRules: value } : "skip"
  );

  const handleToggle = () => {
    if (isEnabled) {
      onChange(null);
      setIsEnabled(false);
    } else {
      onChange(createEmptyGroup());
      setIsEnabled(true);
      setTargetingMode("custom");
    }
  };

  const handleChange = (rule: AudienceGroup) => {
    onChange(rule);
  };

  const handleModeChange = (mode: "custom" | "segment") => {
    setTargetingMode(mode);
    if (mode === "custom") {
      onChange(createEmptyGroup());
    } else {
      onChange(null);
    }
  };

  const handleSegmentSelect = (segmentId: string) => {
    if (segmentId) {
      onChange({
        type: "segment",
        segmentId: segmentId as Id<"segments">,
      });
    } else {
      onChange(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isEnabled} onChange={handleToggle} className="rounded" />
          <span className="text-sm font-medium">Enable audience targeting</span>
        </label>
      </div>

      {isEnabled && showSegmentSelector && segments && segments.length > 0 && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleModeChange("custom")}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              targetingMode === "custom"
                ? "bg-primary/10 text-primary border border-primary/30"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Users className="h-4 w-4" />
            Custom Rules
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("segment")}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              targetingMode === "segment"
                ? "bg-primary/10 text-primary border border-primary/30"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Layers className="h-4 w-4" />
            Saved Segment
          </button>
        </div>
      )}

      {isEnabled && targetingMode === "segment" && (
        <div className="space-y-3">
          <select
            value={value?.type === "segment" ? value.segmentId : ""}
            onChange={(e) => handleSegmentSelect(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">Select a segment...</option>
            {segments?.map((segment) => (
              <option key={segment._id} value={segment._id}>
                {segment.name}
              </option>
            ))}
          </select>
          {value?.type === "segment" && preview && (
            <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg text-sm">
              <Layers className="h-4 w-4 text-primary" />
              <span className="text-primary">
                <strong>{preview.matching}</strong> of <strong>{preview.total}</strong> visitors in
                this segment
              </span>
              {preview.total > 0 && (
                <span className="text-primary/80">
                  ({Math.round((preview.matching / preview.total) * 100)}%)
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {isEnabled && targetingMode === "custom" && value && value.type === "group" && (
        <>
          <GroupEditor group={value} onChange={handleChange} eventNames={eventNames} />
          {preview && (
            <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg text-sm">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-primary">
                <strong>{preview.matching}</strong> of <strong>{preview.total}</strong> visitors
                match these rules
              </span>
              {preview.total > 0 && (
                <span className="text-primary/80">
                  ({Math.round((preview.matching / preview.total) * 100)}%)
                </span>
              )}
            </div>
          )}
        </>
      )}

      {isEnabled && targetingMode === "custom" && !value && (
        <Button variant="outline" onClick={() => onChange(createEmptyGroup())}>
          <Plus className="h-4 w-4 mr-2" />
          Add Targeting Rules
        </Button>
      )}
    </div>
  );
}
